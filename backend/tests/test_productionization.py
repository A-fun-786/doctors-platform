"""
Tests for Phase 8 Productionization additions:
- Request ID correlation middleware
- Security headers middleware
- In-memory public slot availability caching
- Appointment creation idempotency key support
- Database session retry mechanism
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time, timedelta, timezone
import threading
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core import time as clinic_time
from app.core.database import Base, get_db, create_session_with_retry
from app.core.cache import clear_all_caches, get_cached_slots
from app.core.rate_limit import limiter
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.idempotency import IdempotencyRecord
from app.models.tenant import Tenant
from app.models.schedule import Schedule
from app.core.security import create_access_token
from app.schemas.appointment import AppointmentCreateRequest
from app.services import appointment_service, idempotency_service


@pytest.fixture(autouse=True)
def reset_caches():
    clear_all_caches()
    limiter.reset()
    yield
    clear_all_caches()
    limiter.reset()


@pytest.fixture(autouse=True)
def freeze_clinic_now(monkeypatch):
    monkeypatch.setattr(clinic_time, "get_clinic_now", lambda now=None: now or datetime(2026, 10, 1, 8, 0))


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
    # even after in-memory caches are cleared (simulating another worker/replica)
    clear_all_caches()
    res2 = client.post("/api/v1/doctor/appointments", json=payload, headers=req_headers)
    assert res2.status_code in (200, 201)
    data2 = res2.json()
    assert data2["id"] == data1["id"]
    assert data2["patient_name"] == "Idempotent Patient"
    assert test_db.query(Appointment).filter(Appointment.doctor_id == doctor.id).count() == 1


def test_idempotency_key_rejects_mismatched_payload(client, auth_doctor, test_db):
    """Reusing an Idempotency-Key with a different payload must be rejected with 422."""
    doctor, tenant, headers = auth_doctor
    test_db.add(
        Schedule(
            doctor_id=doctor.id,
            date=date(2026, 11, 11),
            start_time=time(9, 0),
            end_time=time(11, 0),
            type="AVAILABLE",
        )
    )
    test_db.commit()

    payload1 = {
        "date": "2026-11-11",
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "patient_name": "Patient One",
    }
    payload2 = {
        "date": "2026-11-11",
        "start_time": "09:30:00",
        "end_time": "10:00:00",
        "patient_name": "Patient Two",
    }
    req_headers = {**headers, "Idempotency-Key": "shared-key-mismatch-1"}

    res1 = client.post("/api/v1/doctor/appointments", json=payload1, headers=req_headers)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/doctor/appointments", json=payload2, headers=req_headers)
    assert res2.status_code == 422
    assert "different request payload" in res2.json()["detail"]
    assert test_db.query(Appointment).filter(Appointment.doctor_id == doctor.id).count() == 1


def test_idempotency_key_validation_errors(client, auth_doctor, test_db):
    """Blank or oversized Idempotency-Key headers must be rejected with 400."""
    doctor, _, headers = auth_doctor
    test_db.add(
        Schedule(
            doctor_id=doctor.id,
            date=date(2026, 11, 12),
            start_time=time(9, 0),
            end_time=time(11, 0),
            type="AVAILABLE",
        )
    )
    test_db.commit()

    payload = {
        "date": "2026-11-12",
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "patient_name": "Blank Key Patient",
    }

    res_blank = client.post(
        "/api/v1/doctor/appointments",
        json=payload,
        headers={**headers, "Idempotency-Key": "   "},
    )
    assert res_blank.status_code == 400

    res_long = client.post(
        "/api/v1/doctor/appointments",
        json=payload,
        headers={**headers, "Idempotency-Key": "k" * 256},
    )
    assert res_long.status_code == 400
    assert test_db.query(Appointment).filter(Appointment.doctor_id == doctor.id).count() == 0


def test_idempotency_key_expired_record_allows_reuse(client, auth_doctor, test_db):
    """Once an idempotency record expires, the key may be reused safely."""
    doctor, _, headers = auth_doctor
    test_db.add(
        Schedule(
            doctor_id=doctor.id,
            date=date(2026, 11, 13),
            start_time=time(9, 0),
            end_time=time(11, 0),
            type="AVAILABLE",
        )
    )
    test_db.commit()

    key = "expiring-key-1"
    payload1 = {
        "date": "2026-11-13",
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "patient_name": "First Booking",
    }
    res1 = client.post(
        "/api/v1/doctor/appointments",
        json=payload1,
        headers={**headers, "Idempotency-Key": key},
    )
    assert res1.status_code == 201

    record = test_db.query(IdempotencyRecord).filter(IdempotencyRecord.idempotency_key == key).one()
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    test_db.commit()

    payload2 = {
        "date": "2026-11-13",
        "start_time": "09:30:00",
        "end_time": "10:00:00",
        "patient_name": "Second Booking After Expiry",
    }
    res2 = client.post(
        "/api/v1/doctor/appointments",
        json=payload2,
        headers={**headers, "Idempotency-Key": key},
    )
    assert res2.status_code == 201
    assert res2.json()["id"] != res1.json()["id"]
    assert test_db.query(Appointment).filter(Appointment.doctor_id == doctor.id).count() == 2


def test_idempotency_key_tenant_isolation_and_failed_validation_not_poisoned(client, auth_doctor, test_db):
    """Different doctors may use the same Idempotency-Key; failed validation does not lock the key."""
    doctor1, _, headers1 = auth_doctor
    doctor2 = Doctor(
        full_name="Dr. Second Practice",
        email="doctor.second@example.com",
        hashed_password="test-hash",
        phone="555-0200",
        speciality="Dermatology",
        auth_provider="email",
        is_active=True,
    )
    test_db.add(doctor2)
    test_db.commit()
    test_db.refresh(doctor2)
    headers2 = {"Authorization": f"Bearer {create_access_token(str(doctor2.id))}"}

    for doc in (doctor1, doctor2):
        test_db.add(
            Schedule(
                doctor_id=doc.id,
                date=date(2026, 11, 14),
                start_time=time(9, 0),
                end_time=time(11, 0),
                type="AVAILABLE",
            )
        )
    test_db.commit()

    key = "shared-across-tenants-key"
    # First attempt for doctor1 outside schedule fails with 400 and must NOT poison key
    bad_payload = {
        "date": "2026-11-14",
        "start_time": "14:00:00",
        "end_time": "14:30:00",
        "patient_name": "Retry Patient",
    }
    res_bad = client.post(
        "/api/v1/doctor/appointments",
        json=bad_payload,
        headers={**headers1, "Idempotency-Key": key},
    )
    assert res_bad.status_code == 400

    good_payload = {
        "date": "2026-11-14",
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "patient_name": "Retry Patient",
    }
    res_doc1 = client.post(
        "/api/v1/doctor/appointments",
        json=good_payload,
        headers={**headers1, "Idempotency-Key": key},
    )
    res_doc2 = client.post(
        "/api/v1/doctor/appointments",
        json=good_payload,
        headers={**headers2, "Idempotency-Key": key},
    )
    assert res_doc1.status_code == 201
    assert res_doc2.status_code == 201
    assert res_doc1.json()["id"] != res_doc2.json()["id"]


def test_idempotency_key_concurrent_requests_safe(tmp_path):
    """Concurrent submissions with the same Idempotency-Key create only one appointment and replay cleanly."""
    db_path = tmp_path / "concurrent_idempotency.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False, "timeout": 15},
    )
    Base.metadata.create_all(bind=engine)
    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with SessionFactory() as setup_db:
        doctor = Doctor(
            full_name="Dr. Concurrent Test",
            email="doctor.concurrent@example.com",
            hashed_password="test-hash",
            phone="555-0300",
            speciality="General Medicine",
            auth_provider="email",
            is_active=True,
        )
        setup_db.add(doctor)
        setup_db.commit()
        setup_db.refresh(doctor)

        setup_db.add(
            Schedule(
                doctor_id=doctor.id,
                date=date(2026, 11, 15),
                start_time=time(9, 0),
                end_time=time(11, 0),
                type="AVAILABLE",
            )
        )
        setup_db.commit()
        doctor_id = doctor.id

    payload = AppointmentCreateRequest(
        date=date(2026, 11, 15),
        start_time=time(9, 0),
        end_time=time(9, 30),
        patient_name="Concurrent Patient",
    )
    barrier = threading.Barrier(2)

    def submit():
        with SessionFactory() as session:
            barrier.wait(timeout=5)
            return appointment_service.create_appointment_with_idempotency(
                doctor_id=doctor_id,
                payload=payload,
                db=session,
                idempotency_key="concurrent-key-1",
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(submit)
        f2 = pool.submit(submit)
        (resp1, _), (resp2, _) = f1.result(), f2.result()

    assert resp1.id == resp2.id
    with SessionFactory() as verify_db:
        assert verify_db.query(Appointment).filter(Appointment.doctor_id == doctor_id).count() == 1
        assert verify_db.query(IdempotencyRecord).filter(IdempotencyRecord.doctor_id == doctor_id).count() == 1
    engine.dispose()


def test_idempotency_race_integrity_error_recovery(test_db, auth_doctor, monkeypatch):
    """Simulate a concurrent insert winning between initial lookup and flush."""
    doctor, _, _ = auth_doctor
    test_db.add(
        Schedule(
            doctor_id=doctor.id,
            date=date(2026, 11, 16),
            start_time=time(9, 0),
            end_time=time(11, 0),
            type="AVAILABLE",
        )
    )
    test_db.commit()

    payload = AppointmentCreateRequest(
        date=date(2026, 11, 16),
        start_time=time(9, 0),
        end_time=time(9, 30),
        patient_name="Race Winner Patient",
    )
    key = "race-recovery-key"
    # First request succeeds and commits the record
    winner_resp, replayed1 = appointment_service.create_appointment_with_idempotency(
        doctor_id=doctor.id,
        payload=payload,
        db=test_db,
        idempotency_key=key,
    )
    assert replayed1 is False

    # Force initial lookup to return None once (simulating TOCTOU race), while subsequent
    # post-IntegrityError lookup uses the real implementation and replays winner_resp.
    real_lookup = idempotency_service.lookup_idempotency_record
    calls = {"count": 0}

    def racing_lookup(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            return None
        return real_lookup(*args, **kwargs)

    monkeypatch.setattr(idempotency_service, "lookup_idempotency_record", racing_lookup)

    loser_resp, replayed2 = appointment_service.create_appointment_with_idempotency(
        doctor_id=doctor.id,
        payload=payload,
        db=test_db,
        idempotency_key=key,
    )
    assert replayed2 is True
    assert loser_resp.id == winner_resp.id
    assert test_db.query(Appointment).filter(Appointment.doctor_id == doctor.id).count() == 1


def test_public_slot_caching_and_invalidation(client, auth_doctor, test_db):
    """Verify that public available slots query uses TTL cache and invalidates on schedule change."""
    doctor, tenant, headers = auth_doctor

    # Set up initial schedule
    sched = Schedule(
        doctor_id=doctor.id,
        date=date(2026, 11, 25),
        start_time=time(10, 0),
        end_time=time(11, 0),
        type="AVAILABLE",
    )
    test_db.add(sched)
    test_db.commit()

    # Query public slots
    res1 = client.get(f"/api/v1/public/tenants/{tenant.slug}/available-slots?date=2026-11-25")
    assert res1.status_code == 200
    slots1 = res1.json()
    assert len(slots1) == 2  # 10:00-10:30, 10:30-11:00

    # Verify cache is populated
    cached = get_cached_slots(doctor.id, date(2026, 11, 25))
    assert cached is not None
    assert len(cached) == 2

    # Add schedule entry through API to trigger cache invalidation
    new_sched_payload = {
        "date": "2026-11-25",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
        "type": "AVAILABLE",
    }
    client.post("/api/v1/doctor/schedule", json=new_sched_payload, headers=headers)

    # Verify cache was invalidated
    cached_after = get_cached_slots(doctor.id, date(2026, 11, 25))
    assert cached_after is None

    # Query public slots again: cache should repopulate with 4 slots
    res2 = client.get(f"/api/v1/public/tenants/{tenant.slug}/available-slots?date=2026-11-25")
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
