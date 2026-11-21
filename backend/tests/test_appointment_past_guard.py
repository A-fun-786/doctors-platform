import uuid
from datetime import date, datetime, time, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import config as app_config
from app.core import time as clinic_time
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
def doctor_setup(db_session):
    doc = Doctor(
        id=uuid.uuid4(),
        email="owner@pastguard.com",
        full_name="Dr. Past Guard",
        speciality="General Medicine",
        is_active=True,
        working_hours={
            "shifts": [{"start": "09:00", "end": "18:00", "enabled": True}],
            "closed_days": [],
        },
    )
    db_session.add(doc)
    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="past-guard-clinic",
        clinic_name="Past Guard Clinic",
        status="active",
        service_appointment=True,
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(doc)

    token = create_access_token(str(doc.id))
    headers = {"Authorization": f"Bearer {token}"}
    return doc, headers


def test_create_appointment_rejects_past_date(client, doctor_setup, monkeypatch):
    _, headers = doctor_setup
    monkeypatch.setattr(clinic_time, "get_clinic_now", lambda now=None: now or datetime(2026, 11, 21, 10, 0))

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Past Date Patient",
            "date": "2026-11-20",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 400
    assert "past date" in res.json()["detail"].lower()


def test_create_appointment_rejects_elapsed_and_boundary_same_day_slots(client, doctor_setup, monkeypatch):
    _, headers = doctor_setup
    monkeypatch.setattr(clinic_time, "get_clinic_now", lambda now=None: now or datetime(2026, 11, 21, 11, 0))

    # Earlier elapsed slot: 10:00-10:30
    res_earlier = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Elapsed Patient",
            "date": "2026-11-21",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res_earlier.status_code == 400
    assert "elapsed" in res_earlier.json()["detail"].lower()

    # Exact end_time == now.time() boundary: 10:30-11:00 at 11:00
    res_boundary = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Boundary Patient",
            "date": "2026-11-21",
            "start_time": "10:30:00",
            "end_time": "11:00:00",
        },
    )
    assert res_boundary.status_code == 400
    assert "elapsed" in res_boundary.json()["detail"].lower()


def test_create_appointment_allows_ongoing_and_future_slots(client, doctor_setup, monkeypatch):
    _, headers = doctor_setup
    monkeypatch.setattr(clinic_time, "get_clinic_now", lambda now=None: now or datetime(2026, 11, 21, 11, 15))

    # Ongoing slot (11:00-11:30 at 11:15) matches generate_available_slots behavior
    res_ongoing = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Walk-in Patient",
            "date": "2026-11-21",
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
    )
    assert res_ongoing.status_code == 201

    # Future date slot
    res_future = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Future Patient",
            "date": "2026-11-22",
            "start_time": "09:00:00",
            "end_time": "09:30:00",
        },
    )
    assert res_future.status_code == 201


def test_reschedule_appointment_rejects_past_date_and_elapsed_time(client, db_session, doctor_setup, monkeypatch):
    doc, headers = doctor_setup
    monkeypatch.setattr(clinic_time, "get_clinic_now", lambda now=None: now or datetime(2026, 11, 21, 12, 0))

    appt = Appointment(
        doctor_id=doc.id,
        patient_name="Reschedule Patient",
        date=date(2026, 11, 22),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(appt)
    db_session.commit()
    db_session.refresh(appt)

    # Reschedule to past date -> 400
    res_past_date = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={
            "date": "2026-11-20",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res_past_date.status_code == 400
    assert "past date" in res_past_date.json()["detail"].lower()

    # Reschedule to today's elapsed slot -> 400
    res_elapsed = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={
            "date": "2026-11-21",
            "start_time": "11:30:00",
            "end_time": "12:00:00",
        },
    )
    assert res_elapsed.status_code == 400
    assert "elapsed" in res_elapsed.json()["detail"].lower()

    # Reschedule to today's future slot -> 200
    res_valid = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={
            "date": "2026-11-21",
            "start_time": "14:00:00",
            "end_time": "14:30:00",
        },
    )
    assert res_valid.status_code == 200
    assert res_valid.json()["date"] == "2026-11-21"
    assert res_valid.json()["start_time"] == "14:00:00"


def test_clinic_timezone_utc_midnight_rollover_consistency(client, db_session, doctor_setup, monkeypatch):
    """Verify slot generation and mutation guard share CLINIC_TIMEZONE around UTC midnight."""
    doc, headers = doctor_setup
    monkeypatch.setattr(app_config.get_settings(), "CLINIC_TIMEZONE", "Asia/Kolkata")

    # 2026-11-21 18:45 UTC == 2026-11-22 00:15 IST (already Nov 22 in clinic timezone)
    utc_now = datetime(2026, 11, 21, 18, 45, tzinfo=timezone.utc)
    real_get_clinic_now = clinic_time.get_clinic_now
    monkeypatch.setattr(clinic_time, "get_clinic_now", lambda now=None: real_get_clinic_now(now or utc_now))

    db_session.add(Schedule(
        doctor_id=doc.id,
        date=date(2026, 11, 21),
        start_time=time(9, 0),
        end_time=time(10, 0),
        type="AVAILABLE",
    ))
    db_session.commit()

    # Past date in clinic timezone returns no available slots and rejects booking
    assert schedule_service.generate_available_slots(doc.id, date(2026, 11, 21), db_session) == []
    res_old = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Late UTC Patient",
            "date": "2026-11-21",
            "start_time": "09:00:00",
            "end_time": "09:30:00",
        },
    )
    assert res_old.status_code == 400

    # Current clinic date (2026-11-22 00:15 IST) allows morning booking
    slots_today = schedule_service.generate_available_slots(doc.id, date(2026, 11, 22), db_session)
    assert len(slots_today) > 0
    res_today = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "IST Morning Patient",
            "date": "2026-11-22",
            "start_time": "09:00:00",
            "end_time": "09:30:00",
        },
    )
    assert res_today.status_code == 201


def test_invalid_clinic_timezone_rejected():
    with pytest.raises(ValueError, match="Invalid CLINIC_TIMEZONE"):
        app_config.Settings(CLINIC_TIMEZONE="Invalid/Timezone")
