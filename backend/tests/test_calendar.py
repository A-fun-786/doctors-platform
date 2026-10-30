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
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.services.calendar_service import get_doctor_calendar

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


# ==============================================================================
# Phase 4 Test Cases (4.1 to 4.11 + Edge Cases)
# ==============================================================================

def test_4_1_calendar_mixed_event_types(client, db_session, doctor_a, headers_a):
    """
    Test 4.1: Calendar with mixed event types.
    Oct 12: AVAILABLE 09:00–13:00, BOOKED 09:30–10:00 (Patient A),
    BLOCKED 11:00–12:00 (Personal work), LEAVE 12:00–13:00.
    Expected: HTTP 200, single date with 6 events sorted chronologically:
    AVAILABLE 09:00-09:30, APPOINTMENT 09:30-10:00, AVAILABLE 10:00-10:30,
    AVAILABLE 10:30-11:00, BLOCKED 11:00-12:00, LEAVE 12:00-13:00.
    """
    q_date = date(2026, 10, 12)
    schedules = [
        Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(11, 0), end_time=time(12, 0), type="BLOCKED", reason="Personal work"),
        Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(12, 0), end_time=time(13, 0), type="LEAVE"),
    ]
    db_session.add_all(schedules)
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient A",
        date=q_date,
        start_time=time(9, 30),
        end_time=time(10, 0),
        status="BOOKED",
    )
    db_session.add(apt)
    db_session.commit()

    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_a)
    assert res.status_code == 200
    data = res.json()
    assert "dates" in data
    assert len(data["dates"]) == 1

    day = data["dates"][0]
    assert day["date"] == "2026-10-12"
    events = day["events"]
    assert len(events) == 6

    # Verify event types and times in order
    assert events[0] == {"type": "AVAILABLE", "start": "09:00", "end": "09:30"}
    assert events[1]["type"] == "APPOINTMENT"
    assert events[1]["start"] == "09:30"
    assert events[1]["end"] == "10:00"
    assert events[1]["patient_name"] == "Patient A"
    assert events[1]["status"] == "BOOKED"
    assert "appointment_id" in events[1]

    assert events[2] == {"type": "AVAILABLE", "start": "10:00", "end": "10:30"}
    assert events[3] == {"type": "AVAILABLE", "start": "10:30", "end": "11:00"}

    assert events[4]["type"] == "BLOCKED"
    assert events[4]["start"] == "11:00"
    assert events[4]["end"] == "12:00"
    assert events[4]["reason"] == "Personal work"

    assert events[5]["type"] == "LEAVE"
    assert events[5]["start"] == "12:00"
    assert events[5]["end"] == "13:00"


def test_4_2_calendar_multiple_days(client, db_session, doctor_a, headers_a):
    """
    Test 4.2: Calendar — multiple days.
    Oct 12: AVAILABLE 09:00-11:00 + 1 appointment 09:30-10:00.
    Oct 13: AVAILABLE 09:00-10:00 only.
    Oct 14: HOLIDAY 00:00-23:59.
    Expected: dates array has 3 entries. Oct 12: AVAILABLE + APPOINTMENT.
    Oct 13: AVAILABLE only. Oct 14: single HOLIDAY event.
    """
    d1 = date(2026, 10, 12)
    d2 = date(2026, 10, 13)
    d3 = date(2026, 10, 14)

    db_session.add(Schedule(doctor_id=doctor_a.id, date=d1, start_time=time(9, 0), end_time=time(11, 0), type="AVAILABLE"))
    db_session.add(Appointment(doctor_id=doctor_a.id, patient_name="Pat A", date=d1, start_time=time(9, 30), end_time=time(10, 0), status="BOOKED"))
    db_session.add(Schedule(doctor_id=doctor_a.id, date=d2, start_time=time(9, 0), end_time=time(10, 0), type="AVAILABLE"))
    db_session.add(Schedule(doctor_id=doctor_a.id, date=d3, start_time=time(0, 0), end_time=time(23, 59), type="HOLIDAY", reason="National Holiday"))
    db_session.commit()

    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-14", headers=headers_a)
    assert res.status_code == 200
    dates = res.json()["dates"]
    assert len(dates) == 3

    # Oct 12: AVAILABLE + APPOINTMENT
    assert dates[0]["date"] == "2026-10-12"
    types_d1 = [e["type"] for e in dates[0]["events"]]
    assert "AVAILABLE" in types_d1
    assert "APPOINTMENT" in types_d1

    # Oct 13: AVAILABLE only
    assert dates[1]["date"] == "2026-10-13"
    assert all(e["type"] == "AVAILABLE" for e in dates[1]["events"])
    assert len(dates[1]["events"]) == 2  # 09:00-09:30, 09:30-10:00

    # Oct 14: single HOLIDAY event
    assert dates[2]["date"] == "2026-10-14"
    assert len(dates[2]["events"]) == 1
    assert dates[2]["events"][0]["type"] == "HOLIDAY"
    assert dates[2]["events"][0]["reason"] == "National Holiday"


def test_4_3_cancelled_appointment_in_calendar(client, db_session, doctor_a, headers_a):
    """
    Test 4.3: CANCELLED appointment in calendar.
    BOOKED then CANCELLED at 10:00.
    Expected: Calendar does NOT show cancelled appointment as blocking the slot.
    The 10:00–10:30 slot appears as AVAILABLE.
    """
    q_date = date(2026, 10, 12)
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(9, 0), end_time=time(11, 0), type="AVAILABLE"))
    db_session.add(Appointment(
        doctor_id=doctor_a.id,
        patient_name="Cancelled Pat",
        date=q_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="CANCELLED",
    ))
    db_session.commit()

    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_a)
    assert res.status_code == 200
    events = res.json()["dates"][0]["events"]

    # 10:00–10:30 appears as AVAILABLE
    slot_10 = [e for e in events if e["start"] == "10:00" and e["end"] == "10:30"]
    assert len(slot_10) == 1
    assert slot_10[0]["type"] == "AVAILABLE"

    # CANCELLED appointment is not blocking and not shown as an active appointment event
    assert not any(e["type"] == "APPOINTMENT" for e in events)


def test_4_4_completed_appointment_in_calendar(client, db_session, doctor_a, headers_a):
    """
    Test 4.4: COMPLETED appointment in calendar.
    COMPLETED appointment at 10:00.
    Expected: Calendar shows event {type: APPOINTMENT, status: COMPLETED, ...}.
    Visible in history but slot is occupied (not AVAILABLE).
    """
    q_date = date(2026, 10, 12)
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(9, 0), end_time=time(11, 0), type="AVAILABLE"))
    db_session.add(Appointment(
        doctor_id=doctor_a.id,
        patient_name="Completed Pat",
        date=q_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="COMPLETED",
    ))
    db_session.commit()

    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_a)
    assert res.status_code == 200
    events = res.json()["dates"][0]["events"]

    apt_event = [e for e in events if e["start"] == "10:00" and e["end"] == "10:30"]
    assert len(apt_event) == 1
    assert apt_event[0]["type"] == "APPOINTMENT"
    assert apt_event[0]["status"] == "COMPLETED"
    assert apt_event[0]["patient_name"] == "Completed Pat"

    # Not available at 10:00
    assert not any(e["type"] == "AVAILABLE" and e["start"] == "10:00" for e in events)


def test_4_5_empty_date_range(client, headers_a):
    """
    Test 4.5: Empty date range.
    No schedule or appointments exist for Jan 2099.
    Expected: HTTP 200, dates: [] empty array.
    """
    res = client.get("/api/v1/doctor/calendar?from=2099-01-01&to=2099-01-31", headers=headers_a)
    assert res.status_code == 200
    assert res.json() == {"dates": []}


def test_4_6_max_31_day_range(client, headers_a):
    """
    Test 4.6: Max 31-day range.
    Date range > 31 days returns HTTP 400.
    """
    res = client.get("/api/v1/doctor/calendar?from=2026-10-01&to=2026-11-15", headers=headers_a)
    assert res.status_code == 400
    assert "exceeds 31 days" in res.json()["detail"].lower()


def test_4_7_invalid_date_format(client, headers_a):
    """
    Test 4.7: Invalid date format.
    FastAPI validation returns HTTP 422.
    """
    res = client.get("/api/v1/doctor/calendar?from=October&to=November", headers=headers_a)
    assert res.status_code == 422


def test_4_8_calendar_event_ordering(client, db_session, doctor_a, headers_a):
    """
    Test 4.8: Calendar event ordering.
    AVAILABLE 09:00–13:00 + BOOKED 10:00 + BLOCKED 11:00–12:00 + BOOKED 09:30.
    Expected: Events sorted by start time:
    AVAILABLE 09:00, APPOINTMENT 09:30, APPOINTMENT 10:00, AVAILABLE 10:30,
    BLOCKED 11:00, AVAILABLE 12:00, AVAILABLE 12:30.
    """
    q_date = date(2026, 10, 12)
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"))
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(11, 0), end_time=time(12, 0), type="BLOCKED", reason="Mtg"))
    db_session.add(Appointment(doctor_id=doctor_a.id, patient_name="Pat 1", date=q_date, start_time=time(10, 0), end_time=time(10, 30), status="BOOKED"))
    db_session.add(Appointment(doctor_id=doctor_a.id, patient_name="Pat 2", date=q_date, start_time=time(9, 30), end_time=time(10, 0), status="BOOKED"))
    db_session.commit()

    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_a)
    assert res.status_code == 200
    events = res.json()["dates"][0]["events"]

    sequence = [(e["type"], e["start"]) for e in events]
    expected_sequence = [
        ("AVAILABLE", "09:00"),
        ("APPOINTMENT", "09:30"),
        ("APPOINTMENT", "10:00"),
        ("AVAILABLE", "10:30"),
        ("BLOCKED", "11:00"),
        ("AVAILABLE", "12:00"),
        ("AVAILABLE", "12:30"),
    ]
    assert sequence == expected_sequence


def test_4_9_multiple_availability_windows(client, db_session, doctor_a, headers_a):
    """
    Test 4.9: Multiple availability windows.
    AVAILABLE 09:00–13:00 + AVAILABLE 16:00–20:00 + BOOKED 16:30.
    Expected: Morning and afternoon blocks both appear. 16:30 slot shows
    as APPOINTMENT, surrounding slots as AVAILABLE.
    """
    q_date = date(2026, 10, 12)
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"))
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(16, 0), end_time=time(20, 0), type="AVAILABLE"))
    db_session.add(Appointment(doctor_id=doctor_a.id, patient_name="Pat 3", date=q_date, start_time=time(16, 30), end_time=time(17, 0), status="BOOKED"))
    db_session.commit()

    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_a)
    assert res.status_code == 200
    events = res.json()["dates"][0]["events"]

    # Morning slots (09:00 - 13:00 -> 8 slots)
    morning_slots = [e for e in events if e["start"] < "13:00"]
    assert len(morning_slots) == 8
    assert all(e["type"] == "AVAILABLE" for e in morning_slots)

    # Afternoon slots (16:00 - 20:00)
    afternoon_events = [e for e in events if e["start"] >= "16:00"]
    assert len(afternoon_events) == 8  # 7 available + 1 appointment

    # 16:30 is APPOINTMENT
    slot_1630 = [e for e in afternoon_events if e["start"] == "16:30"]
    assert len(slot_1630) == 1
    assert slot_1630[0]["type"] == "APPOINTMENT"
    assert slot_1630[0]["patient_name"] == "Pat 3"

    # 16:00 and 17:00 are AVAILABLE
    slot_1600 = [e for e in afternoon_events if e["start"] == "16:00"]
    assert len(slot_1600) == 1 and slot_1600[0]["type"] == "AVAILABLE"

    slot_1700 = [e for e in afternoon_events if e["start"] == "17:00"]
    assert len(slot_1700) == 1 and slot_1700[0]["type"] == "AVAILABLE"


def test_4_10_cross_doctor_isolation(client, db_session, doctor_a, headers_a, doctor_b, headers_b):
    """
    Test 4.10: Cross-doctor isolation.
    Doctor A has appointments/schedules. Doctor B queries calendar.
    Expected: Doctor B gets empty data, Doctor A data never leaked.
    """
    q_date = date(2026, 10, 12)
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(9, 0), end_time=time(11, 0), type="AVAILABLE"))
    db_session.add(Appointment(doctor_id=doctor_a.id, patient_name="Pat A", date=q_date, start_time=time(9, 30), end_time=time(10, 0), status="BOOKED"))
    db_session.commit()

    res_b = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json() == {"dates": []}

    res_a = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12", headers=headers_a)
    assert res_a.status_code == 200
    assert len(res_a.json()["dates"]) == 1


def test_4_11_unauthenticated_calendar(client):
    """
    Test 4.11: Unauthenticated calendar request returns HTTP 401.
    """
    res = client.get("/api/v1/doctor/calendar?from=2026-10-12&to=2026-10-12")
    assert res.status_code == 401


def test_4_12_inverted_date_range(client, headers_a):
    """
    Test 4.12: Date range with to < from returns HTTP 400.
    """
    res = client.get("/api/v1/doctor/calendar?from=2026-10-15&to=2026-10-10", headers=headers_a)
    assert res.status_code == 400
    assert "must be on or after" in res.json()["detail"]


def test_4_13_missing_query_parameters(client, headers_a):
    """
    Test 4.13: Missing required from or to parameters returns HTTP 422.
    """
    res1 = client.get("/api/v1/doctor/calendar?from=2026-10-12", headers=headers_a)
    assert res1.status_code == 422

    res2 = client.get("/api/v1/doctor/calendar?to=2026-10-12", headers=headers_a)
    assert res2.status_code == 422


def test_4_14_service_direct_invocation(db_session, doctor_a):
    """
    Test 4.14: Direct service invocation of get_doctor_calendar.
    """
    q_date = date(2026, 10, 20)
    db_session.add(Schedule(doctor_id=doctor_a.id, date=q_date, start_time=time(10, 0), end_time=time(12, 0), type="AVAILABLE"))
    db_session.commit()

    cal = get_doctor_calendar(
        doctor_id=doctor_a.id,
        from_date=q_date,
        to_date=q_date,
        db=db_session,
    )
    assert "dates" in cal
    assert len(cal["dates"]) == 1
    assert cal["dates"][0]["date"] == "2026-10-20"
    assert len(cal["dates"][0]["events"]) == 4
