import uuid
from datetime import date, time, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.main import app
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.tenant import Tenant

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_limiter():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def doctor_a(db_session):
    doc = Doctor(
        email="doctor.a@example.com",
        full_name="Dr. Alice Smith",
        auth_provider="email",
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def headers_a(doctor_a):
    token = create_access_token(str(doctor_a.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def doctor_b(db_session):
    doc = Doctor(
        email="doctor.b@example.com",
        full_name="Dr. Bob Jones",
        auth_provider="email",
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def headers_b(doctor_b):
    token = create_access_token(str(doctor_b.id))
    return {"Authorization": f"Bearer {token}"}


def test_2_1_single_available_entry(client, headers_a):
    """Test 2.1: Single AVAILABLE entry creation."""
    payload = {
        "date": "2026-10-15",
        "start_time": "09:00:00",
        "end_time": "13:00:00",
        "type": "AVAILABLE",
        "reason": "Regular clinic hours",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert uuid.UUID(data["id"])
    assert data["type"] == "AVAILABLE"
    assert data["date"] == "2026-10-15"
    assert data["start_time"] == "09:00:00"
    assert data["end_time"] == "13:00:00"
    assert data["reason"] == "Regular clinic hours"


def test_2_2_bulk_schedule_entries(client, headers_a):
    """Test 2.2: Bulk schedule entries creation (array of 3 distinct non-overlapping entries)."""
    payload = [
        {
            "date": "2026-10-16",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "type": "AVAILABLE",
        },
        {
            "date": "2026-10-16",
            "start_time": "14:00:00",
            "end_time": "17:00:00",
            "type": "AVAILABLE",
        },
        {
            "date": "2026-10-17",
            "start_time": "10:00:00",
            "end_time": "15:00:00",
            "type": "AVAILABLE",
        },
    ]
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3
    ids = [item["id"] for item in data]
    assert len(set(ids)) == 3


def test_2_3_reject_invalid_time_range(client, headers_a):
    """Test 2.3: Reject invalid time range (13:00 to 09:00)."""
    payload = {
        "date": "2026-10-15",
        "start_time": "13:00:00",
        "end_time": "09:00:00",
        "type": "AVAILABLE",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 422


def test_2_4_reject_invalid_schedule_type(client, headers_a):
    """Test 2.4: Reject invalid schedule type (VACATION)."""
    payload = {
        "date": "2026-10-15",
        "start_time": "09:00:00",
        "end_time": "13:00:00",
        "type": "VACATION",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 422


def test_2_5_create_leave_entry(client, headers_a):
    """Test 2.5: Create LEAVE entry."""
    payload = {
        "date": "2026-10-18",
        "start_time": "10:00:00",
        "end_time": "14:00:00",
        "type": "LEAVE",
        "reason": "Personal doctor appointment",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "LEAVE"
    assert data["reason"] == "Personal doctor appointment"


def test_2_6_create_holiday_entry(client, headers_a):
    """Test 2.6: Create HOLIDAY entry (full day)."""
    payload = {
        "date": "2026-10-25",
        "start_time": "00:00:00",
        "end_time": "23:59:59",
        "type": "HOLIDAY",
        "reason": "National Holiday",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "HOLIDAY"
    assert data["reason"] == "National Holiday"


def test_2_7_create_blocked_entry(client, headers_a):
    """Test 2.7: Create BLOCKED entry."""
    payload = {
        "date": "2026-10-19",
        "start_time": "11:00:00",
        "end_time": "12:30:00",
        "type": "BLOCKED",
        "reason": "Staff weekly sync",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload, headers=headers_a)
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "BLOCKED"
    assert data["reason"] == "Staff weekly sync"


def test_2_8_list_schedule_range(client, headers_a):
    """Test 2.8: List schedule range."""
    # Create entries across several dates
    client.post("/api/v1/doctor/schedule", json={
        "date": "2026-10-01", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"
    }, headers=headers_a)
    client.post("/api/v1/doctor/schedule", json={
        "date": "2026-10-05", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"
    }, headers=headers_a)
    client.post("/api/v1/doctor/schedule", json={
        "date": "2026-10-10", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"
    }, headers=headers_a)

    # Query range Oct 03 to Oct 08
    res = client.get("/api/v1/doctor/schedule?from=2026-10-03&to=2026-10-08", headers=headers_a)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["date"] == "2026-10-05"


def test_2_9_list_empty_range(client, headers_a):
    """Test 2.9: List empty range."""
    res = client.get("/api/v1/doctor/schedule?from=2099-01-01&to=2099-01-02", headers=headers_a)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_2_10_delete_entry(client, headers_a):
    """Test 2.10: Delete entry."""
    res = client.post("/api/v1/doctor/schedule", json={
        "date": "2026-10-20", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"
    }, headers=headers_a)
    assert res.status_code == 201
    entry_id = res.json()["id"]

    # Delete the entry
    del_res = client.delete(f"/api/v1/doctor/schedule/{entry_id}", headers=headers_a)
    assert del_res.status_code == 204

    # Verify no longer returned in list
    list_res = client.get("/api/v1/doctor/schedule?from=2026-10-20&to=2026-10-20", headers=headers_a)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0


def test_2_11_delete_cross_doctor(client, headers_a, headers_b):
    """Test 2.11: Doctor B attempts to delete Doctor A entry -> 404."""
    res = client.post("/api/v1/doctor/schedule", json={
        "date": "2026-10-21", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"
    }, headers=headers_a)
    assert res.status_code == 201
    entry_id = res.json()["id"]

    # Doctor B attempts to delete
    del_res = client.delete(f"/api/v1/doctor/schedule/{entry_id}", headers=headers_b)
    assert del_res.status_code == 404


def test_2_12_delete_nonexistent_id(client, headers_a):
    """Test 2.12: Delete nonexistent ID -> 404."""
    random_id = uuid.uuid4()
    del_res = client.delete(f"/api/v1/doctor/schedule/{random_id}", headers=headers_a)
    assert del_res.status_code == 404


def test_2_13_unauthenticated_access(client):
    """Test 2.13: POST /doctor/schedule without token -> 401."""
    payload = {
        "date": "2026-10-15",
        "start_time": "09:00:00",
        "end_time": "13:00:00",
        "type": "AVAILABLE",
    }
    response = client.post("/api/v1/doctor/schedule", json=payload)
    assert response.status_code == 401


def test_2_14_rate_limit_creation(client, headers_a):
    """Test 2.14: Rate limit schedule creation (30 per minute allowed, 31st returns 429)."""
    status_codes = []
    # Submit 31 non-overlapping requests across unique dates
    base_date = date(2027, 1, 1)
    for i in range(31):
        target_date = (base_date + timedelta(days=i)).isoformat()
        res = client.post(
            "/api/v1/doctor/schedule",
            json={
                "date": target_date,
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "type": "AVAILABLE",
            },
            headers=headers_a,
        )
        status_codes.append(res.status_code)

    assert status_codes[:30] == [201] * 30
    assert status_codes[30] == 429


def test_overlapping_available_rejection(client, headers_a):
    """Verify rejection of overlapping AVAILABLE windows in same batch and across requests."""
    # Batch overlap
    batch_payload = [
        {"date": "2026-11-01", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"},
        {"date": "2026-11-01", "start_time": "11:00:00", "end_time": "14:00:00", "type": "AVAILABLE"},
    ]
    res1 = client.post("/api/v1/doctor/schedule", json=batch_payload, headers=headers_a)
    assert res1.status_code == 400
    assert "Overlapping AVAILABLE schedule window" in res1.json()["detail"]

    # Persisted overlap
    res2 = client.post("/api/v1/doctor/schedule", json={
        "date": "2026-11-02", "start_time": "09:00:00", "end_time": "12:00:00", "type": "AVAILABLE"
    }, headers=headers_a)
    assert res2.status_code == 201

    res3 = client.post("/api/v1/doctor/schedule", json={
        "date": "2026-11-02", "start_time": "11:30:00", "end_time": "13:30:00", "type": "AVAILABLE"
    }, headers=headers_a)
    assert res3.status_code == 400
    assert "Overlapping AVAILABLE schedule window" in res3.json()["detail"]
