from datetime import date, datetime, time, timedelta, timezone
from fastapi import HTTPException
import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.security import create_access_token
from app.core.time import get_clinic_now
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.services import appointment_service, schedule_service


@pytest.fixture
def doctor_with_headers(db_session):
    doc = Doctor(
        email="past.guard.doc@example.com",
        full_name="Dr. Past Guard",
        auth_provider="email",
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    token = create_access_token(str(doc.id))
    return doc, {"Authorization": f"Bearer {token}"}


def test_create_rejects_past_date_even_with_available_schedule(client, db_session, doctor_with_headers):
    doc, headers = doctor_with_headers
    past_date = date.today() - timedelta(days=3)
    db_session.add(
        Schedule(
            doctor_id=doc.id,
            date=past_date,
            start_time=time(9, 0),
            end_time=time(13, 0),
            type="AVAILABLE",
        )
    )
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Backdated Patient",
            "date": past_date.isoformat(),
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 400
    assert "past" in res.json()["detail"].lower()


def test_create_rejects_elapsed_same_day_slot_and_boundary(client, db_session, doctor_with_headers, monkeypatch):
    doc, headers = doctor_with_headers
    today = date(2026, 11, 23)
    db_session.add(
        Schedule(
            doctor_id=doc.id,
            date=today,
            start_time=time(9, 0),
            end_time=time(17, 0),
            type="AVAILABLE",
        )
    )
    db_session.commit()

    # Clinic clock is 11:00:00 sharp
    monkeypatch.setattr(
        appointment_service,
        "get_clinic_now",
        lambda now=None: now or datetime(2026, 11, 23, 11, 0, 0),
    )

    # Strictly elapsed slot (10:00-10:30) -> rejected
    res_elapsed = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Morning Patient",
            "date": today.isoformat(),
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res_elapsed.status_code == 400
    assert "elapsed" in res_elapsed.json()["detail"].lower()

    # Exact boundary (10:30-11:00 where end_time == now.time()) -> rejected, matching slot generator
    res_boundary = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Boundary Patient",
            "date": today.isoformat(),
            "start_time": "10:30:00",
            "end_time": "11:00:00",
        },
    )
    assert res_boundary.status_code == 400

    # In-progress slot (11:00-11:30 where end_time > now.time()) -> allowed
    res_current = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Walk-in Patient",
            "date": today.isoformat(),
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
    )
    assert res_current.status_code == 201


def test_reschedule_rejects_past_date_and_elapsed_time(client, db_session, doctor_with_headers, monkeypatch):
    doc, headers = doctor_with_headers
    today = date(2026, 11, 23)
    yesterday = date(2026, 11, 22)
    tomorrow = date(2026, 11, 24)

    db_session.add_all(
        [
            Schedule(doctor_id=doc.id, date=yesterday, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
            Schedule(doctor_id=doc.id, date=today, start_time=time(9, 0), end_time=time(17, 0), type="AVAILABLE"),
            Schedule(doctor_id=doc.id, date=tomorrow, start_time=time(9, 0), end_time=time(13, 0), type="AVAILABLE"),
        ]
    )
    appt = Appointment(
        doctor_id=doc.id,
        patient_name="Reschedule Guard Patient",
        date=tomorrow,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(appt)
    db_session.commit()
    db_session.refresh(appt)

    monkeypatch.setattr(
        appointment_service,
        "get_clinic_now",
        lambda now=None: now or datetime(2026, 11, 23, 14, 0, 0),
    )

    # Past date reschedule -> 400
    res_past_date = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={"date": yesterday.isoformat(), "start_time": "10:00:00", "end_time": "10:30:00"},
    )
    assert res_past_date.status_code == 400

    # Same-day elapsed slot (13:30-14:00 at 14:00 -> end_time == now.time()) -> 400
    res_elapsed_time = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={"date": today.isoformat(), "start_time": "13:30:00", "end_time": "14:00:00"},
    )
    assert res_elapsed_time.status_code == 400

    # Earlier same-day elapsed slot (10:00-10:30 at 14:00) -> 400
    res_earlier_time = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={"date": today.isoformat(), "start_time": "10:00:00", "end_time": "10:30:00"},
    )
    assert res_earlier_time.status_code == 400

    # Appointment must remain unchanged on tomorrow 10:00
    db_session.refresh(appt)
    assert appt.date == tomorrow
    assert appt.start_time == time(10, 0)

    # Same-day future slot (15:00-15:30) -> 200 OK
    res_future = client.patch(
        f"/api/v1/doctor/appointments/{appt.id}",
        headers=headers,
        json={"date": today.isoformat(), "start_time": "15:00:00", "end_time": "15:30:00"},
    )
    assert res_future.status_code == 200
    assert res_future.json()["date"] == today.isoformat()
    assert res_future.json()["start_time"] == "15:00:00"


def test_clinic_timezone_consistency_between_slots_and_mutations(db_session, doctor_with_headers, monkeypatch):
    doc, _ = doctor_with_headers
    monkeypatch.setenv("CLINIC_TIMEZONE", "America/New_York")
    get_settings.cache_clear()
    try:
        # 2026-11-24 02:00 UTC == 2026-11-23 21:00 EST (still Nov 23 in America/New_York)
        utc_now = datetime(2026, 11, 24, 2, 0, 0, tzinfo=timezone.utc)
        clinic_now = get_clinic_now(utc_now)
        assert clinic_now.date() == date(2026, 11, 23)

        nov22 = date(2026, 11, 22)
        nov23 = date(2026, 11, 23)
        nov24 = date(2026, 11, 24)
        db_session.add_all(
            [
                Schedule(doctor_id=doc.id, date=nov22, start_time=time(9, 0), end_time=time(10, 0), type="AVAILABLE"),
                Schedule(doctor_id=doc.id, date=nov23, start_time=time(21, 0), end_time=time(22, 0), type="AVAILABLE"),
                Schedule(doctor_id=doc.id, date=nov24, start_time=time(9, 0), end_time=time(10, 0), type="AVAILABLE"),
            ]
        )
        db_session.commit()

        from app.schemas.appointment import AppointmentCreateRequest

        # Nov 22 is past in America/New_York -> rejected
        with pytest.raises(HTTPException) as exc_past:
            appointment_service.create_appointment(
                doctor_id=doc.id,
                payload=AppointmentCreateRequest(
                    patient_name="TZ Past",
                    date=nov22,
                    start_time=time(9, 0),
                    end_time=time(9, 30),
                ),
                db=db_session,
                now=utc_now,
            )
        assert exc_past.value.status_code == 400

        # Nov 23 21:30-22:00 is still in the future in America/New_York (21:00 EST),
        # even though UTC is already Nov 24 -> both slot generator and booking agree!
        slots = schedule_service.generate_available_slots(doc.id, nov23, db_session, now=utc_now)
        assert {"start": "21:30", "end": "22:00"} in slots

        created = appointment_service.create_appointment(
            doctor_id=doc.id,
            payload=AppointmentCreateRequest(
                patient_name="TZ Same Evening",
                date=nov23,
                start_time=time(21, 30),
                end_time=time(22, 0),
            ),
            db=db_session,
            now=utc_now,
        )
        assert created.date == nov23
    finally:
        get_settings.cache_clear()


def test_invalid_clinic_timezone_rejected():
    with pytest.raises(ValidationError):
        Settings(CLINIC_TIMEZONE="Mars/Olympus_Mons")
