import uuid
from datetime import date, time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.main import app
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.staff import StaffMember
from app.models.appointment import Appointment

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
def clinic_setup(db_session):
    primary_doc = Doctor(
        id=uuid.uuid4(),
        email="owner@overlapclinic.com",
        full_name="Dr. Sarah Connor",
        speciality="General Medicine",
        is_active=True,
        working_hours={
            "shifts": [{"start": "08:00", "end": "18:00", "enabled": True}],
            "closed_days": [],
        },
    )
    db_session.add(primary_doc)

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=primary_doc.id,
        slug="overlap-clinic",
        clinic_name="Overlap Defense Clinic",
        status="active",
        service_appointment=True,
    )
    db_session.add(tenant)

    staff_doctor = StaffMember(
        id=uuid.uuid4(),
        doctor_id=primary_doc.id,
        full_name="Dr. Kyle Reese",
        phone="+1 555-0199",
        role="Doctor",
        department="General",
        status="active",
        can_login=True,
    )
    db_session.add(staff_doctor)
    db_session.commit()

    token = create_access_token(str(primary_doc.id))
    headers = {"Authorization": f"Bearer {token}"}

    return {
        "doctor": primary_doc,
        "tenant": tenant,
        "staff": staff_doctor,
        "headers": headers,
    }


def test_adjacent_slots_no_collision(client, clinic_setup):
    """Adjacent intervals [10:00, 10:30) and [10:30, 11:00) must both succeed."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    # Appointment 1: 10:00 - 10:30
    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Alpha",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res1.status_code == 201

    # Appointment 2: 10:30 - 11:00 (Touches boundary, no overlap)
    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Beta",
            "date": target_date,
            "start_time": "10:30:00",
            "end_time": "11:00:00",
        },
    )
    assert res2.status_code == 201


def test_tail_overlap_rejected_with_409(client, clinic_setup):
    """Existing: 10:00-11:00. Attempt: 10:30-11:30 (Tail overlap). Must return 409."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Alpha",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Beta",
            "date": target_date,
            "start_time": "10:30:00",
            "end_time": "11:30:00",
        },
    )
    assert res2.status_code == 409
    assert "already booked" in res2.json()["detail"]


def test_head_overlap_rejected_with_409(client, clinic_setup):
    """Existing: 10:00-11:00. Attempt: 09:30-10:30 (Head overlap). Must return 409."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Alpha",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Beta",
            "date": target_date,
            "start_time": "09:30:00",
            "end_time": "10:30:00",
        },
    )
    assert res2.status_code == 409
    assert "already booked" in res2.json()["detail"]


def test_enclosed_interval_rejected_with_409(client, clinic_setup):
    """Existing: 10:00-11:00. Attempt: 10:15-10:45 (Enclosed sub-interval). Must return 409."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Alpha",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Beta",
            "date": target_date,
            "start_time": "10:15:00",
            "end_time": "10:45:00",
        },
    )
    assert res2.status_code == 409
    assert "already booked" in res2.json()["detail"]


def test_enclosing_interval_rejected_with_409(client, clinic_setup):
    """Existing: 10:15-10:45. Attempt: 10:00-11:00 (Enclosing super-interval). Must return 409."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Alpha",
            "date": target_date,
            "start_time": "10:15:00",
            "end_time": "10:45:00",
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Beta",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res2.status_code == 409
    assert "already booked" in res2.json()["detail"]


def test_same_time_different_practitioners_allowed(client, clinic_setup):
    """Primary doctor and Staff doctor can both be booked at overlapping times."""
    headers = clinic_setup["headers"]
    staff_id = clinic_setup["staff"].id
    target_date = "2026-12-01"

    # Primary Doctor: 10:00 - 11:00
    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient for Primary",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "staff_id": None,
        },
    )
    assert res1.status_code == 201

    # Staff Doctor: 10:15 - 10:45 (Overlaps in time, but different practitioner)
    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient for Staff",
            "date": target_date,
            "start_time": "10:15:00",
            "end_time": "10:45:00",
            "staff_id": str(staff_id),
        },
    )
    assert res2.status_code == 201


def test_cancelled_appointment_does_not_block_overlapping_slot(client, clinic_setup):
    """A cancelled appointment frees the time window for overlapping bookings."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient to Cancel",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res1.status_code == 201
    appt_id = res1.json()["id"]

    # Cancel the appointment
    res_cancel = client.post(
        f"/api/v1/doctor/appointments/{appt_id}/cancel",
        headers=headers,
        json={"cancellation_reason": "Patient requested reschedule"},
    )
    assert res_cancel.status_code == 200

    # Book overlapping window 10:30 - 11:00
    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "New Patient",
            "date": target_date,
            "start_time": "10:30:00",
            "end_time": "11:00:00",
        },
    )
    assert res2.status_code == 201


def test_completed_appointment_blocks_overlapping_slot(client, clinic_setup, db_session):
    """Completed appointments occupied practitioner time and must block overlapping slots."""
    headers = clinic_setup["headers"]
    doctor = clinic_setup["doctor"]
    target_date = date(2026, 12, 1)

    completed_appt = Appointment(
        doctor_id=doctor.id,
        staff_id=None,
        patient_name="Completed Patient",
        date=target_date,
        start_time=time(10, 0),
        end_time=time(11, 0),
        status="COMPLETED",
    )
    db_session.add(completed_appt)
    db_session.commit()

    # Attempt to book 10:30 - 11:00
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "New Patient",
            "date": str(target_date),
            "start_time": "10:30:00",
            "end_time": "11:00:00",
        },
    )
    assert res.status_code == 409
    assert "already booked" in res.json()["detail"]


def test_reschedule_overlapping_slot_rejected(client, clinic_setup):
    """Rescheduling to an overlapping slot occupied by another appointment must return 409."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    # Appointment 1: 09:00 - 10:00
    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient 1",
            "date": target_date,
            "start_time": "09:00:00",
            "end_time": "10:00:00",
        },
    )
    assert res1.status_code == 201
    appt1_id = res1.json()["id"]

    # Appointment 2: 10:00 - 11:00
    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient 2",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res2.status_code == 201

    # Attempt to reschedule Appointment 1 into Appointment 2 (10:15 - 10:45)
    res_resched = client.patch(
        f"/api/v1/doctor/appointments/{appt1_id}",
        headers=headers,
        json={
            "date": target_date,
            "start_time": "10:15:00",
            "end_time": "10:45:00",
        },
    )
    assert res_resched.status_code == 409
    assert "Target slot already occupied" in res_resched.json()["detail"]


def test_reschedule_to_own_slot_succeeds(client, clinic_setup):
    """Rescheduling an appointment to its own slot (or sub-slot) ignores itself."""
    headers = clinic_setup["headers"]
    target_date = "2026-12-01"

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Self",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res.status_code == 201
    appt_id = res.json()["id"]

    # Reschedule to same time
    res_resched = client.patch(
        f"/api/v1/doctor/appointments/{appt_id}",
        headers=headers,
        json={
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "11:00:00",
        },
    )
    assert res_resched.status_code == 200


def test_database_trigger_blocks_raw_overlapping_insert(db_session, clinic_setup):
    """Raw insert directly into DB bypassing application layer triggers SQLite IntegrityError."""
    doctor = clinic_setup["doctor"]
    q_date = date(2026, 12, 1)

    a1 = Appointment(
        doctor_id=doctor.id,
        staff_id=None,
        date=q_date,
        start_time=time(10, 0),
        end_time=time(11, 0),
        patient_name="Raw 1",
        status="BOOKED",
    )
    db_session.add(a1)
    db_session.commit()

    a2 = Appointment(
        doctor_id=doctor.id,
        staff_id=None,
        date=q_date,
        start_time=time(10, 30),
        end_time=time(11, 30),
        patient_name="Raw 2",
        status="BOOKED",
    )
    db_session.add(a2)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.commit()
    db_session.rollback()

    assert "Slot overlap detected" in str(exc_info.value)


def test_database_trigger_blocks_raw_overlapping_update(db_session, clinic_setup):
    """Raw update directly into DB to overlap an existing appointment triggers SQLite IntegrityError."""
    doctor = clinic_setup["doctor"]
    q_date = date(2026, 12, 1)

    a1 = Appointment(
        doctor_id=doctor.id,
        staff_id=None,
        date=q_date,
        start_time=time(10, 0),
        end_time=time(11, 0),
        patient_name="Raw 1",
        status="BOOKED",
    )
    a2 = Appointment(
        doctor_id=doctor.id,
        staff_id=None,
        date=q_date,
        start_time=time(11, 0),
        end_time=time(12, 0),
        patient_name="Raw 2",
        status="BOOKED",
    )
    db_session.add_all([a1, a2])
    db_session.commit()

    # Now update a2 to overlap a1
    a2.start_time = time(10, 30)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.commit()
    db_session.rollback()

    assert "Slot overlap detected" in str(exc_info.value)
