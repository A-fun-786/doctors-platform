"""
Tests for Phase 8 Productionization additions:
- Request ID correlation middleware
- Security headers middleware
- In-memory public slot availability caching
- Appointment creation idempotency key support
- Database session retry mechanism
"""
from datetime import date, time
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db, create_session_with_retry
from app.core.cache import clear_all_caches, get_cached_slots
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.schedule import Schedule
from app.core.security import create_access_token


@pytest.fixture(autouse=True)
def reset_caches():
    clear_all_caches()
    yield
    clear_all_caches()


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_doctor(test_db):
    doctor = Doctor(
        full_name="Dr. Production Test",
        email="doctor.prod@example.com",
        hashed_password="test-hash",
        phone="555-0100",
        speciality="General Medicine",
        auth_provider="email",
        is_active=True,
    )
    test_db.add(doctor)
    test_db.commit()
    test_db.refresh(doctor)

    tenant = Tenant(
        doctor_id=doctor.id,
        clinic_name="Production Practice",
        slug="prod-practice",
        status="active",
    )
    test_db.add(tenant)
    test_db.commit()

    token = create_access_token(str(doctor.id))
    headers = {"Authorization": f"Bearer {token}"}
    return doctor, tenant, headers


def test_security_headers_present_on_response(client):
    """Verify that all production security headers are injected."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-xss-protection"] == "1; mode=block"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"


def test_request_id_correlation(client):
    """Verify that X-Request-Id header is propagated or auto-generated."""
    # Case 1: Auto-generated request ID
    res1 = client.get("/health")
    assert res1.status_code == 200
    req_id1 = res1.headers.get("x-request-id")
    assert req_id1 is not None
    assert len(req_id1) >= 16

    # Case 2: Supplied request ID is echoed back
    custom_id = "test-custom-request-id-12345"
    res2 = client.get("/health", headers={"X-Request-Id": custom_id})
    assert res2.status_code == 200
    assert res2.headers.get("x-request-id") == custom_id


def test_idempotency_key_appointment_creation(client, auth_doctor, test_db):
    """Verify that posting with identical Idempotency-Key returns cached response without duplicate conflicts."""
    doctor, tenant, headers = auth_doctor

    # Set up schedule
    sched = Schedule(
        doctor_id=doctor.id,
        date=date(2026, 11, 10),
        start_time=time(9, 0),
        end_time=time(11, 0),
        type="AVAILABLE",
    )
    test_db.add(sched)
    test_db.commit()

    payload = {
        "date": "2026-11-10",
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "patient_name": "Idempotent Patient",
        "patient_contact": "555-0199",
        "reason": "Routine Checkup",
    }

    idempotency_key = "idemp-key-unique-abc-123"
    req_headers = {**headers, "Idempotency-Key": idempotency_key}

    # First request: Creates appointment
    res1 = client.post("/api/v1/doctor/appointments", json=payload, headers=req_headers)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["patient_name"] == "Idempotent Patient"

    # Second request with same idempotency key: Returns same data without 409 conflict
    res2 = client.post("/api/v1/doctor/appointments", json=payload, headers=req_headers)
    assert res2.status_code in (200, 201)
    data2 = res2.json()
    assert data2["id"] == data1["id"]
    assert data2["patient_name"] == "Idempotent Patient"


def test_public_slot_caching_and_invalidation(client, auth_doctor, test_db):
    """Verify that public available slots query uses TTL cache and invalidates on schedule change."""
    doctor, tenant, headers = auth_doctor

    # Set up initial schedule
    sched = Schedule(
        doctor_id=doctor.id,
        date=date(2026, 11, 15),
        start_time=time(10, 0),
        end_time=time(11, 0),
        type="AVAILABLE",
    )
    test_db.add(sched)
    test_db.commit()

    # Query public slots
    res1 = client.get(f"/api/v1/public/tenants/{tenant.slug}/available-slots?date=2026-11-15")
    assert res1.status_code == 200
    slots1 = res1.json()
    assert len(slots1) == 2  # 10:00-10:30, 10:30-11:00

    # Verify cache is populated
    cached = get_cached_slots(doctor.id, date(2026, 11, 15))
    assert cached is not None
    assert len(cached) == 2

    # Add schedule entry through API to trigger cache invalidation
    new_sched_payload = {
        "date": "2026-11-15",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
        "type": "AVAILABLE",
    }
    client.post("/api/v1/doctor/schedule", json=new_sched_payload, headers=headers)

    # Verify cache was invalidated
    cached_after = get_cached_slots(doctor.id, date(2026, 11, 15))
    assert cached_after is None

    # Query public slots again: cache should repopulate with 4 slots
    res2 = client.get(f"/api/v1/public/tenants/{tenant.slug}/available-slots?date=2026-11-15")
    assert res2.status_code == 200
    slots2 = res2.json()
    assert len(slots2) == 4


def test_database_retry_mechanism():
    """Verify create_session_with_retry retries on transient OperationalError."""
    attempt_count = 0

    def mock_session():
        nonlocal attempt_count
        attempt_count += 1
        if attempt_count < 3:
            raise OperationalError("transient failure", params=None, orig=Exception("DB reset"))
        mock_sess = MagicMock()
        return mock_sess

    with patch("app.core.database.SessionLocal", side_effect=mock_session):
        sess = create_session_with_retry()
        assert sess is not None
        assert attempt_count == 3
