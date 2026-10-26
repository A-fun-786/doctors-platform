import os
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic.config import Config
from alembic import command

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.core.cache import set_cached_slots, get_cached_slots
from app.main import app
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.services import schedule_service
from datetime import date, time, datetime

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
        id=uuid.uuid4(),
        email="working_hours_doc@example.com",
        full_name="Dr. Shift Specialist",
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


# ==============================================================================
# Phase 5 Test 1: GET /doctor/working-hours returns default shifts when column is null
# ==============================================================================
def test_1_get_working_hours_default_fallback(client, auth_headers, test_doctor, db_session):
    """When doctor.working_hours column is null, GET returns the 2-shift standard fallback."""
    # Assert column is null prior to invocation
    db_session.refresh(test_doctor)
    assert test_doctor.working_hours is None

    response = client.get("/api/v1/doctor/working-hours", headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "shifts" in data
    assert "closed_days" in data
    assert len(data["shifts"]) == 2
    assert data["shifts"][0]["id"] == "morning"
    assert data["shifts"][0]["start"] == "10:00"
    assert data["shifts"][0]["end"] == "13:00"
    assert data["shifts"][0]["enabled"] is True
    assert data["shifts"][1]["id"] == "evening"
    assert data["shifts"][1]["start"] == "16:00"
    assert data["shifts"][1]["end"] == "20:00"
    assert data["shifts"][1]["enabled"] is True
    assert data["closed_days"] == [0]


test_get_working_hours_default = test_1_get_working_hours_default_fallback


# ==============================================================================
# Phase 5 Test 2: PUT /doctor/working-hours validates start < end and persists
# ==============================================================================
def test_2_put_working_hours_valid_and_validation_error(client, auth_headers, test_doctor, db_session):
    """Validates start < end, persists valid shifts to DB, and rejects invalid inverted ranges with 422."""
    # 1. Valid payload with start < end persists cleanly
    valid_payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Morning Clinic",
                "start": "09:00",
                "end": "12:30",
                "enabled": True,
            },
            {
                "id": "afternoon",
                "label": "Afternoon Rounds",
                "start": "14:00",
                "end": "18:00",
                "enabled": True,
            },
        ],
        "closed_days": [0, 6],
    }

    res_valid = client.put("/api/v1/doctor/working-hours", json=valid_payload, headers=auth_headers)
    assert res_valid.status_code == 200, res_valid.text
    data = res_valid.json()
    assert len(data["shifts"]) == 2
    assert data["shifts"][0]["start"] == "09:00"
    assert data["shifts"][0]["end"] == "12:30"
    assert data["closed_days"] == [0, 6]

    # Verify persistence in DB
    db_session.expire_all()
    reloaded_doc = db_session.query(Doctor).filter(Doctor.id == test_doctor.id).first()
    assert reloaded_doc.working_hours is not None
    assert len(reloaded_doc.working_hours["shifts"]) == 2
    assert reloaded_doc.working_hours["closed_days"] == [0, 6]

    # 2. Inverted range (start >= end) is rejected with 422 Unprocessable Entity
    invalid_payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Inverted Shift",
                "start": "14:00",
                "end": "10:00",
                "enabled": True,
            }
        ],
        "closed_days": [0],
    }
    res_invalid = client.put("/api/v1/doctor/working-hours", json=invalid_payload, headers=auth_headers)
    assert res_invalid.status_code == 422, res_invalid.text


# Phase 1 Test 2: individual test functions for granular reporting
def test_put_working_hours_valid(client, auth_headers, test_doctor, db_session):
    """Valid shift configuration is stored to DB and returned."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Morning Clinic",
                "start": "09:00",
                "end": "12:30",
                "enabled": True,
            },
            {
                "id": "afternoon",
                "label": "Afternoon Rounds",
                "start": "14:00",
                "end": "18:00",
                "enabled": True,
            },
        ],
        "closed_days": [0, 6],
    }

    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert len(data["shifts"]) == 2
    assert data["shifts"][0]["start"] == "09:00"
    assert data["shifts"][0]["end"] == "12:30"
    assert data["closed_days"] == [0, 6]

    # Verify persistence in DB
    db_session.expire_all()
    reloaded_doc = db_session.query(Doctor).filter(Doctor.id == test_doctor.id).first()
    assert reloaded_doc.working_hours is not None
    assert len(reloaded_doc.working_hours["shifts"]) == 2
    assert reloaded_doc.working_hours["closed_days"] == [0, 6]


def test_put_working_hours_rejects_inverted_range(client, auth_headers):
    """Inverted ranges (start >= end) are rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Invalid Shift",
                "start": "14:00",
                "end": "10:00",
                "enabled": True,
            }
        ],
        "closed_days": [0],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "strictly after start time" in response.text


def test_put_working_hours_rejects_equal_start_end(client, auth_headers):
    """Zero-duration shift (start == end) is rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Zero Shift",
                "start": "10:00",
                "end": "10:00",
                "enabled": True,
            }
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_put_working_hours_rejects_non_30m_intervals(client, auth_headers):
    """Shifts with non-30m boundaries (e.g. 10:15 or 12:45) are rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Odd minutes",
                "start": "10:15",
                "end": "13:00",
                "enabled": True,
            }
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "30-minute intervals" in response.text


def test_put_working_hours_rejects_overlapping_enabled_shifts(client, auth_headers):
    """Overlapping active shifts are rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "shift1",
                "label": "Shift 1",
                "start": "10:00",
                "end": "13:00",
                "enabled": True,
            },
            {
                "id": "shift2",
                "label": "Shift 2",
                "start": "12:30",
                "end": "15:00",
                "enabled": True,
            },
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "Overlapping shifts detected" in response.text


def test_put_working_hours_allows_disabled_overlap(client, auth_headers):
    """Disabled shifts do not cause overlap validation errors."""
    payload = {
        "shifts": [
            {
                "id": "shift1",
                "label": "Active Shift",
                "start": "10:00",
                "end": "13:00",
                "enabled": True,
            },
            {
                "id": "shift2",
                "label": "Inactive Draft Shift",
                "start": "12:00",
                "end": "15:00",
                "enabled": False,
            },
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 200


def test_put_working_hours_rejects_more_than_4_shifts(client, auth_headers):
    """More than 4 shifts per day is rejected with 422."""
    payload = {
        "shifts": [
            {"id": f"s{i}", "label": f"Shift {i}", "start": f"{8+i*2:02d}:00", "end": f"{9+i*2:02d}:00", "enabled": True}
            for i in range(5)
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_put_working_hours_invalidates_cache(client, auth_headers, test_doctor):
    """Updating working hours automatically invalidates slot cache for current doctor."""
    q_date = date(2026, 11, 1)
    set_cached_slots(test_doctor.id, q_date, [{"start": "10:00", "end": "10:30"}])
    assert get_cached_slots(test_doctor.id, q_date) is not None

    payload = {
        "shifts": [
            {"id": "m", "label": "Morning", "start": "10:00", "end": "12:00", "enabled": True}
        ],
        "closed_days": [0],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert get_cached_slots(test_doctor.id, q_date) is None


# ==============================================================================
# Phase 5 Test 5: Alembic migration 009 bidirectional upgrade/downgrade test
# ==============================================================================
def test_5_migration_009_upgrade_downgrade(tmp_path):
    """Verify migration 009 applies and rolls back cleanly."""
    db_file = tmp_path / "test_mig_009.db"
    db_url = f"sqlite:///{db_file}"

    ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("script_location", str(ini_path.parent / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade to head (009)
    command.upgrade(alembic_cfg, "head")

    # 2. Downgrade to 008
    command.downgrade(alembic_cfg, "008_add_patient_details_to_appointments")

    # 3. Re-upgrade to head (009)
    command.upgrade(alembic_cfg, "head")


test_alembic_migration_009_bidirectional = test_5_migration_009_upgrade_downgrade


# ==============================================================================
# Phase 2 Test 3: Slot generation from shifts & closed day guard
# ==============================================================================
def test_3_slot_generation_from_shifts_and_closed_day(db_session, test_doctor):
    """
    Asserts 14 slots on weekdays, 0 on Sunday (closed_days=[6]).
    Default shifts: Morning 10:00-13:00 (6 slots), Evening 16:00-20:00 (8 slots).
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [6],
    }
    db_session.add(test_doctor)
    db_session.commit()

    # Wednesday: 2026-11-04 (weekday == 2, not closed)
    weekday_date = date(2026, 11, 4)
    weekday_slots = schedule_service.generate_available_slots(test_doctor.id, weekday_date, db_session)
    assert len(weekday_slots) == 14
    assert weekday_slots[0] == {"start": "10:00", "end": "10:30"}
    assert weekday_slots[5] == {"start": "12:30", "end": "13:00"}
    assert weekday_slots[6] == {"start": "16:00", "end": "16:30"}
    assert weekday_slots[13] == {"start": "19:30", "end": "20:00"}

    # Sunday: 2026-11-08 (weekday == 6, closed)
    sunday_date = date(2026, 11, 8)
    sunday_slots = schedule_service.generate_available_slots(test_doctor.id, sunday_date, db_session)
    assert sunday_slots == []


# ==============================================================================
# Phase 2 Test 4: Precedence - Explicit AVAILABLE records override shifts
# ==============================================================================
def test_4_precedence_explicit_available_wins(db_session, test_doctor):
    """
    When explicit Schedule(type='AVAILABLE') records exist for a date,
    they take absolute precedence and the doctor's recurring shifts are ignored.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [6],
    }
    db_session.add(test_doctor)

    target_date = date(2026, 11, 5)  # Thursday
    # Add an explicit one-off AVAILABLE window 08:00 - 09:00 (2 slots)
    explicit_schedule = Schedule(
        doctor_id=test_doctor.id,
        date=target_date,
        start_time=time(8, 0),
        end_time=time(9, 0),
        type="AVAILABLE",
    )
    db_session.add(explicit_schedule)
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, target_date, db_session)
    assert len(slots) == 2
    assert slots == [
        {"start": "08:00", "end": "08:30"},
        {"start": "08:30", "end": "09:00"},
    ]


# ==============================================================================
# Phase 2 Additional Tests: Past-Slot Guard, Exclusions, and Disabled Shifts
# ==============================================================================
def test_past_slot_guard_filters_expired_intervals(db_session, test_doctor):
    """
    When query_date == date.today(), candidate intervals where end_time <= now.time()
    are filtered out.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [],
    }
    db_session.add(test_doctor)
    db_session.commit()

    today_date = date(2026, 11, 4)
    # Simulated current time at 11:15 AM
    simulated_now = datetime(2026, 11, 4, 11, 15)

    slots = schedule_service.generate_available_slots(
        test_doctor.id,
        today_date,
        db_session,
        now=simulated_now,
    )

    # Morning slots 10:00-10:30 (end 10:30 <= 11:15) and 10:30-11:00 (end 11:00 <= 11:15) must be dropped.
    # 11:00-11:30 (end 11:30 > 11:15) should be kept.
    # Remaining: 4 morning slots + 8 evening slots = 12 slots.
    assert len(slots) == 12
    starts = [s["start"] for s in slots]
    assert "10:00" not in starts
    assert "10:30" not in starts
    assert "11:00" in starts
    assert "16:00" in starts

    # If current time is 20:30 PM (after all shifts end)
    simulated_late_now = datetime(2026, 11, 4, 20, 30)
    slots_late = schedule_service.generate_available_slots(
        test_doctor.id,
        today_date,
        db_session,
        now=simulated_late_now,
    )
    assert slots_late == []


def test_shift_slot_generation_with_leave_and_appointment_exclusions(db_session, test_doctor):
    """
    Exclusions (LEAVE, BLOCKED, HOLIDAY) and occupied appointments (BOOKED, COMPLETED)
    are correctly subtracted from shift-generated candidate slots.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [],
    }
    db_session.add(test_doctor)

    q_date = date(2026, 11, 4)
    # Doctor takes leave between 16:00 and 17:00 (removes 16:00-16:30 and 16:30-17:00)
    leave = Schedule(
        doctor_id=test_doctor.id,
        date=q_date,
        start_time=time(16, 0),
        end_time=time(17, 0),
        type="LEAVE",
    )
    # Patient has a booked appointment at 10:00 - 10:30
    apt = Appointment(
        doctor_id=test_doctor.id,
        date=q_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
        patient_name="John Doe",
        patient_contact="john@example.com",
    )
    db_session.add_all([leave, apt])
    db_session.commit()

    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    # Total candidate slots = 14. Exclusions = 2 (leave) + 1 (booked) = 3. Valid slots = 11.
    assert len(slots) == 11
    starts = [s["start"] for s in slots]
    assert "10:00" not in starts
    assert "10:30" in starts
    assert "16:00" not in starts
    assert "16:30" not in starts
    assert "17:00" in starts


def test_shift_slot_generation_disabled_shift_ignored(db_session, test_doctor):
    """
    Disabled shifts within doctor.working_hours do not generate candidate slots.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": False},
        ],
        "closed_days": [],
    }
    db_session.add(test_doctor)
    db_session.commit()

    q_date = date(2026, 11, 4)
    slots = schedule_service.generate_available_slots(test_doctor.id, q_date, db_session)
    # Only morning shift (10:00-13:00) produces 6 slots; evening shift is disabled.
    assert len(slots) == 6
    starts = [s["start"] for s in slots]
    assert starts == ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]


# ==============================================================================
# Phase 2 Harmonization: Open Working Hours Booking & Leave Lifecycle Tests
# ==============================================================================
def test_booking_directly_within_working_hours_without_schedule_succeeds(client, auth_headers, test_doctor, db_session):
    """
    A doctor with configured working hours can book an appointment directly
    without ever having to mark manual 'AVAILABLE' schedule entries.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [6],
    }
    db_session.add(test_doctor)
    db_session.commit()

    # Wednesday 2026-11-04, 10:00-10:30 is within Morning Shift
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=auth_headers,
        json={
            "patient_name": "Direct Booking Patient",
            "patient_contact": "+91 99999 88888",
            "date": "2026-11-04",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
            "reason": "General Consultation",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "BOOKED"
    assert data["patient_name"] == "Direct Booking Patient"
    assert data["start_time"] == "10:00:00"
    assert data["end_time"] == "10:30:00"


def test_booking_outside_working_hours_rejected(client, auth_headers, test_doctor, db_session):
    """
    Attempting to book a slot outside enabled working shifts is rejected with HTTP 400.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [6],
    }
    db_session.add(test_doctor)
    db_session.commit()

    # 14:00-14:30 falls in the inter-shift break (13:00-16:00)
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=auth_headers,
        json={
            "patient_name": "Break Time Patient",
            "date": "2026-11-04",
            "start_time": "14:00:00",
            "end_time": "14:30:00",
        },
    )
    assert res.status_code == 400
    assert "Slot does not fall within doctor's working hours" in res.json()["detail"]


def test_booking_on_closed_day_rejected(client, auth_headers, test_doctor, db_session):
    """
    Attempting to book an appointment on a configured closed day is rejected with HTTP 400.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
        ],
        "closed_days": [6],  # Sunday is closed
    }
    db_session.add(test_doctor)
    db_session.commit()

    # Sunday 2026-11-08
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=auth_headers,
        json={
            "patient_name": "Sunday Patient",
            "date": "2026-11-08",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 400
    assert "Clinic is closed on this date" in res.json()["detail"]


def test_booking_during_leave_rejected_and_cancellation_restores_booking(client, auth_headers, test_doctor, db_session):
    """
    1. A LEAVE slot blocks patient appointments from being booked (HTTP 400).
    2. Deleting / cancelling the LEAVE immediately restores the slot as open for booking.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
        ],
        "closed_days": [],
    }
    db_session.add(test_doctor)
    db_session.commit()

    # 1. Doctor marks leave on Wednesday 2026-11-04 from 10:00 to 11:00
    leave_res = client.post(
        "/api/v1/doctor/schedule",
        headers=auth_headers,
        json={
            "entries": [
                {
                    "date": "2026-11-04",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00",
                    "type": "LEAVE",
                    "reason": "Medical Conference",
                }
            ]
        },
    )
    assert leave_res.status_code == 201
    leave_id = leave_res.json()[0]["id"]

    # 2. Attempt to book appointment during leave period -> Rejected
    appt_fail = client.post(
        "/api/v1/doctor/appointments",
        headers=auth_headers,
        json={
            "patient_name": "Conference Blocked Patient",
            "date": "2026-11-04",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert appt_fail.status_code == 400
    assert "Slot overlaps with LEAVE period" in appt_fail.json()["detail"]

    # 3. Doctor cancels leave
    del_res = client.delete(f"/api/v1/doctor/schedule/{leave_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # 4. Now the slot is restored and can be booked directly
    appt_ok = client.post(
        "/api/v1/doctor/appointments",
        headers=auth_headers,
        json={
            "patient_name": "Restored Slot Patient",
            "date": "2026-11-04",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert appt_ok.status_code == 201
    assert appt_ok.json()["status"] == "BOOKED"


def test_reschedule_within_working_hours_succeeds(client, auth_headers, test_doctor, db_session):
    """
    Rescheduling an appointment directly against working hours succeeds when moving
    to another open shift interval, and fails when moving outside working hours.
    """
    test_doctor.working_hours = {
        "shifts": [
            {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
            {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
        ],
        "closed_days": [],
    }
    db_session.add(test_doctor)
    db_session.commit()

    # Create initial appointment in morning shift
    init_res = client.post(
        "/api/v1/doctor/appointments",
        headers=auth_headers,
        json={
            "patient_name": "Reschedule Patient",
            "date": "2026-11-04",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert init_res.status_code == 201
    appt_id = init_res.json()["id"]

    # Reschedule to outside working hours -> 400
    reschedule_fail = client.patch(
        f"/api/v1/doctor/appointments/{appt_id}",
        headers=auth_headers,
        json={
            "date": "2026-11-04",
            "start_time": "14:00:00",
            "end_time": "14:30:00",
        },
    )
    assert reschedule_fail.status_code == 400
    assert "Slot does not fall within doctor's working hours" in reschedule_fail.json()["detail"]

    # Reschedule to evening shift 16:30 -> 200 OK
    reschedule_ok = client.patch(
        f"/api/v1/doctor/appointments/{appt_id}",
        headers=auth_headers,
        json={
            "date": "2026-11-04",
            "start_time": "16:30:00",
            "end_time": "17:00:00",
        },
    )
    assert reschedule_ok.status_code == 200
    assert reschedule_ok.json()["start_time"] == "16:30:00"
    assert reschedule_ok.json()["end_time"] == "17:00:00"


