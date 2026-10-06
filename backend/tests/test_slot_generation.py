import uuid
from datetime import date, time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.main import app
from app.models.appointment import Appointment
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.tenant import Tenant
from app.services import schedule_service

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
def test_doctor(db_session):
    doc = Doctor(
        email="doctor.slot@example.com",
        full_name="Dr. Gregory House",
        auth_provider="email",
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def auth_headers(test_doctor):
    token = create_access_token(str(test_doctor.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_tenant(db_session, test_doctor):
    tenant = Tenant(
        doctor_id=test_doctor.id,
        slug="dr-ahmed",
        clinic_name="Dr. Ahmed Clinic",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    return tenant


def test_2_15_basic_4h_window(db_session, test_doctor):
    """Test 2.15: Basic 4h window AVAILABLE 09:00–13:00 produces 8 slots."""
    q_date = date(2026, 11, 10)
    db_session.add(Schedule(
        doctor_id=test_doctor.id,
        date=q_date,
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    ))
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 8
    expected = [
        {"start": "09:00", "end": "09:30"},
        {"start": "09:30", "end": "10:00"},
        {"start": "10:00", "end": "10:30"},
        {"start": "10:30", "end": "11:00"},
        {"start": "11:00", "end": "11:30"},
        {"start": "11:30", "end": "12:00"},
        {"start": "12:00", "end": "12:30"},
        {"start": "12:30", "end": "13:00"},
    ]
    assert slots == expected


def test_2_16_multiple_available_windows(db_session, test_doctor):
    """Test 2.16: Multiple AVAILABLE windows (09:00–13:00 & 16:00–20:00) produces 16 slots."""
    q_date = date(2026, 11, 11)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(16, 0), end_time=time(20, 0), type="AVAILABLE"),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 16
    assert slots[0] == {"start": "09:00", "end": "09:30"}
    assert slots[7] == {"start": "12:30", "end": "13:00"}
    assert slots[8] == {"start": "16:00", "end": "16:30"}
    assert slots[15] == {"start": "19:30", "end": "20:00"}


def test_2_17_leave_subtraction(db_session, test_doctor):
    """Test 2.17: LEAVE subtraction (09:00–13:00 AVAILABLE, 10:00–12:00 LEAVE -> 4 slots)."""
    q_date = date(2026, 11, 12)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(10, 0), end_time=time(12, 0), type="LEAVE"),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 4
    expected = [
        {"start": "09:00", "end": "09:30"},
        {"start": "09:30", "end": "10:00"},
        {"start": "12:00", "end": "12:30"},
        {"start": "12:30", "end": "13:00"},
    ]
    assert slots == expected


def test_2_18_holiday_full_day(db_session, test_doctor):
    """Test 2.18: HOLIDAY full-day (09:00–13:00 AVAILABLE + HOLIDAY 00:00–23:59 -> 0 slots)."""
    q_date = date(2026, 11, 13)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(0, 0), end_time=time(23, 59), type="HOLIDAY"),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert slots == []


def test_2_19_blocked_window(db_session, test_doctor):
    """Test 2.19: BLOCKED window (09:00–13:00 AVAILABLE + BLOCKED 11:00–12:00 -> 6 slots)."""
    q_date = date(2026, 11, 14)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(11, 0), end_time=time(12, 0), type="BLOCKED"),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 6
    starts = [s["start"] for s in slots]
    assert "11:00" not in starts
    assert "11:30" not in starts


def test_2_20_booked_appointment(db_session, test_doctor):
    """Test 2.20: BOOKED appointment (09:00–13:00 AVAILABLE + BOOKED 10:00–10:30 -> 7 slots)."""
    q_date = date(2026, 11, 15)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Appointment(
            doctor_id=test_doctor.id,
            patient_name="John Doe",
            date=q_date,
            start_time=time(10, 0),
            end_time=time(10, 30),
            status="BOOKED",
        ),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 7
    starts = [s["start"] for s in slots]
    assert "10:00" not in starts


def test_2_21_cancelled_appointment(db_session, test_doctor):
    """Test 2.21: CANCELLED appointment (09:00–13:00 AVAILABLE + CANCELLED 10:00–10:30 -> 8 slots)."""
    q_date = date(2026, 11, 16)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Appointment(
            doctor_id=test_doctor.id,
            patient_name="Jane Doe",
            date=q_date,
            start_time=time(10, 0),
            end_time=time(10, 30),
            status="CANCELLED",
        ),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 8
    starts = [s["start"] for s in slots]
    assert "10:00" in starts


def test_2_22_completed_appointment(db_session, test_doctor):
    """Test 2.22: COMPLETED appointment (09:00–13:00 AVAILABLE + COMPLETED 10:00–10:30 -> 7 slots)."""
    q_date = date(2026, 11, 17)
    db_session.add_all([
        Schedule(doctor_id=test_doctor.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Appointment(
            doctor_id=test_doctor.id,
            patient_name="Alice Brown",
            date=q_date,
            start_time=time(10, 0),
            end_time=time(10, 30),
            status="COMPLETED",
        ),
    ])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 7
    starts = [s["start"] for s in slots]
    assert "10:00" not in starts


def test_2_23_no_available_schedule(db_session, test_doctor):
    """Test 2.23: No AVAILABLE schedule entries on date -> 0 slots []."""
    q_date = date(2026, 11, 18)
    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert slots == []


def test_2_24_non_aligned_window(db_session, test_doctor):
    """Test 2.24: Non-aligned window (09:00–10:15 -> 2 slots, 15m dropped)."""
    q_date = date(2026, 11, 19)
    db_session.add(Schedule(
        doctor_id=test_doctor.id,
        date=q_date,
        start_time=time(9, 0),
        end_time=time(10, 15),
        type="AVAILABLE",
    ))
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    assert len(slots) == 2
    assert slots == [
        {"start": "09:00", "end": "09:30"},
        {"start": "09:30", "end": "10:00"},
    ]


def test_2_25_public_slot_endpoint(client, db_session, test_doctor, test_tenant):
    """Test 2.25: Public slot endpoint returns 8 slots, unauthenticated."""
    q_date = "2026-11-20"
    db_session.add(Schedule(
        doctor_id=test_doctor.id,
        date=date(2026, 11, 20),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    ))
    db_session.commit()

    res = client.get(f"/api/v1/public/tenants/{test_tenant.slug}/available-slots?date={q_date}")
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) == 8
    assert slots[0] == {"start": "09:00", "end": "09:30"}


def test_2_26_public_nonexistent_slug(client):
    """Test 2.26: Public slot endpoint with nonexistent slug -> 404."""
    res = client.get("/api/v1/public/tenants/nonexistent-slug/available-slots?date=2026-11-20")
    assert res.status_code == 404


def test_2_27_public_slot_rate_limit(client, test_tenant):
    """Test 2.27: Public slot rate limit: 31 queries in 1 min -> 30 succeed, 31st returns 429."""
    status_codes = []
    for _ in range(31):
        res = client.get(f"/api/v1/public/tenants/{test_tenant.slug}/available-slots?date=2026-11-20")
        status_codes.append(res.status_code)

    assert status_codes[:30] == [200] * 30
    assert status_codes[30] == 429


def test_doctor_authenticated_available_slots(client, db_session, test_doctor, auth_headers):
    """Verify GET /api/v1/doctor/available-slots with authenticated doctor."""
    q_date = "2026-11-21"
    db_session.add(Schedule(
        doctor_id=test_doctor.id,
        date=date(2026, 11, 21),
        start_time=time(9, 0),
        end_time=time(10, 0),
        type="AVAILABLE",
    ))
    db_session.commit()

    res = client.get(f"/api/v1/doctor/available-slots?date={q_date}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data == [
        {"start": "09:00", "end": "09:30"},
        {"start": "09:30", "end": "10:00"},
    ]
