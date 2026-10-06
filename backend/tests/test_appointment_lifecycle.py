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
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.appointment import Appointment
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


@pytest.fixture
def tenant_a(db_session, doctor_a):
    t = Tenant(
        doctor_id=doctor_a.id,
        clinic_name="Alice Clinic",
        slug="dr-alice",
        status="active",
        service_appointment=True,
        service_medicine_inventory=True,
        service_lab_reports=True,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


# ==============================================================================
# 3.1 – 3.8: Appointment Creation Tests
# ==============================================================================

def test_3_1_create_appointment_valid_slot(client, db_session, doctor_a, headers_a):
    # Setup AVAILABLE 09:00–13:00 on 2026-10-12
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    db_session.add(sched)
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "BOOKED"
    assert data["patient_name"] == "Patient A"
    assert "id" in data
    assert "created_at" in data


def test_3_2_create_with_optional_fields(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    db_session.add(sched)
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "patient_contact": "9876543210",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
            "reason": "General checkup",
            "notes": "First visit",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["patient_contact"] == "9876543210"
    assert data["reason"] == "General checkup"
    assert data["notes"] == "First visit"


def test_3_3_create_outside_available_window(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    db_session.add(sched)
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "date": "2026-10-12",
            "start_time": "14:00:00",
            "end_time": "14:30:00",
        },
    )
    assert res.status_code == 400
    assert "Slot does not fall within any AVAILABLE schedule window" in res.json()["detail"]


def test_3_4_create_during_leave_period(client, db_session, doctor_a, headers_a):
    sched1 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    sched2 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(12, 0),
        type="LEAVE",
    )
    db_session.add_all([sched1, sched2])
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "date": "2026-10-12",
            "start_time": "10:30:00",
            "end_time": "11:00:00",
        },
    )
    assert res.status_code == 400
    assert "Slot overlaps with LEAVE period" in res.json()["detail"]


def test_3_5_create_during_holiday(client, db_session, doctor_a, headers_a):
    sched1 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    sched2 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(0, 0),
        end_time=time(23, 59),
        type="HOLIDAY",
    )
    db_session.add_all([sched1, sched2])
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "date": "2026-10-12",
            "start_time": "09:00:00",
            "end_time": "09:30:00",
        },
    )
    assert res.status_code == 400
    assert "Slot overlaps with HOLIDAY" in res.json()["detail"]


def test_3_6_create_during_blocked_period(client, db_session, doctor_a, headers_a):
    sched1 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    sched2 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(11, 0),
        end_time=time(12, 0),
        type="BLOCKED",
    )
    db_session.add_all([sched1, sched2])
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "date": "2026-10-12",
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
    )
    assert res.status_code == 400
    assert "Slot overlaps with BLOCKED period" in res.json()["detail"]


def test_3_7_create_with_no_schedule(client, headers_a):
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient A",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 400
    assert "No AVAILABLE schedule window for this date" in res.json()["detail"]


def test_3_8_missing_patient_name(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    db_session.add(sched)
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 422


# ==============================================================================
# 3.9 – 3.11: Concurrency & Double Booking Tests
# ==============================================================================

def test_3_9_duplicate_slot_same_doctor(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient 1",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add_all([sched, apt])
    db_session.commit()

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient 2",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 409
    assert "Slot already booked" in res.json()["detail"]


def test_3_10_same_slot_different_doctor(client, db_session, doctor_a, doctor_b, headers_b):
    # Doctor A has booked slot at 10:00
    apt_a = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient A",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    # Doctor B has AVAILABLE schedule 09:00–13:00
    sched_b = Schedule(
        doctor_id=doctor_b.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    db_session.add_all([apt_a, sched_b])
    db_session.commit()

    # Doctor B books at 10:00 -> succeeds
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_b,
        json={
            "patient_name": "Patient B",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 201
    assert res.json()["patient_name"] == "Patient B"


def test_3_11_slot_freed_after_cancellation(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient 1",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add_all([sched, apt])
    db_session.commit()
    db_session.refresh(apt)

    # Cancel apt
    cancel_res = client.post(
        f"/api/v1/doctor/appointments/{apt.id}/cancel",
        headers=headers_a,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Rebook same slot
    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "Patient 2",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res.status_code == 201
    assert res.json()["patient_name"] == "Patient 2"
    assert res.json()["status"] == "BOOKED"


# ==============================================================================
# 3.12 – 3.17: State Transition Tests
# ==============================================================================

def test_3_12_cancel_booked_appointment(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.post(f"/api/v1/doctor/appointments/{apt.id}/cancel", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"


def test_3_13_cancel_already_cancelled(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="CANCELLED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.post(f"/api/v1/doctor/appointments/{apt.id}/cancel", headers=headers_a)
    assert res.status_code == 400
    assert "Only BOOKED appointments can be cancelled" in res.json()["detail"]


def test_3_14_cancel_completed_appointment(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="COMPLETED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.post(f"/api/v1/doctor/appointments/{apt.id}/cancel", headers=headers_a)
    assert res.status_code == 400
    assert "Completed appointments cannot be cancelled" in res.json()["detail"]


def test_3_15_complete_booked_appointment(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.post(f"/api/v1/doctor/appointments/{apt.id}/complete", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"


def test_3_16_complete_already_completed(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="COMPLETED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.post(f"/api/v1/doctor/appointments/{apt.id}/complete", headers=headers_a)
    assert res.status_code == 400
    assert "Appointment already completed" in res.json()["detail"]


def test_3_17_complete_cancelled_appointment(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="CANCELLED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.post(f"/api/v1/doctor/appointments/{apt.id}/complete", headers=headers_a)
    assert res.status_code == 400
    assert "Cancelled appointments cannot be completed" in res.json()["detail"]


# ==============================================================================
# 3.18 – 3.22: Reschedule Tests
# ==============================================================================

def test_3_18_reschedule_to_valid_new_slot(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add_all([sched, apt])
    db_session.commit()
    db_session.refresh(apt)

    res = client.patch(
        f"/api/v1/doctor/appointments/{apt.id}",
        headers=headers_a,
        json={
            "date": "2026-10-12",
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["start_time"] == "11:00:00"
    assert data["end_time"] == "11:30:00"
    assert data["status"] == "BOOKED"

    # Old slot 10:00 is freed: can book new appointment at 10:00
    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers_a,
        json={
            "patient_name": "New Patient",
            "date": "2026-10-12",
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res2.status_code == 201


def test_3_19_reschedule_to_occupied_slot(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    apt1 = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient 1",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    apt2 = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient 2",
        date=date(2026, 10, 12),
        start_time=time(11, 0),
        end_time=time(11, 30),
        status="BOOKED",
    )
    db_session.add_all([sched, apt1, apt2])
    db_session.commit()
    db_session.refresh(apt1)

    res = client.patch(
        f"/api/v1/doctor/appointments/{apt1.id}",
        headers=headers_a,
        json={
            "date": "2026-10-12",
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
    )
    assert res.status_code == 409
    assert "Target slot already occupied" in res.json()["detail"]


def test_3_20_reschedule_to_different_date(client, db_session, doctor_a, headers_a):
    sched1 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    sched2 = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 14),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add_all([sched1, sched2, apt])
    db_session.commit()
    db_session.refresh(apt)

    res = client.patch(
        f"/api/v1/doctor/appointments/{apt.id}",
        headers=headers_a,
        json={
            "date": "2026-10-14",
            "start_time": "09:00:00",
            "end_time": "09:30:00",
        },
    )
    assert res.status_code == 200
    assert res.json()["date"] == "2026-10-14"
    assert res.json()["start_time"] == "09:00:00"


def test_3_21_reschedule_cancelled_appointment(client, db_session, doctor_a, headers_a):
    sched = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="CANCELLED",
    )
    db_session.add_all([sched, apt])
    db_session.commit()
    db_session.refresh(apt)

    res = client.patch(
        f"/api/v1/doctor/appointments/{apt.id}",
        headers=headers_a,
        json={
            "date": "2026-10-12",
            "start_time": "11:00:00",
            "end_time": "11:30:00",
        },
    )
    assert res.status_code == 400
    assert "Only BOOKED appointments can be rescheduled" in res.json()["detail"]


def test_3_22_reschedule_to_leave_period(client, db_session, doctor_a, headers_a):
    sched_avail = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(17, 0),
        type="AVAILABLE",
    )
    sched_leave = Schedule(
        doctor_id=doctor_a.id,
        date=date(2026, 10, 12),
        start_time=time(14, 0),
        end_time=time(16, 0),
        type="LEAVE",
    )
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add_all([sched_avail, sched_leave, apt])
    db_session.commit()
    db_session.refresh(apt)

    res = client.patch(
        f"/api/v1/doctor/appointments/{apt.id}",
        headers=headers_a,
        json={
            "date": "2026-10-12",
            "start_time": "14:30:00",
            "end_time": "15:00:00",
        },
    )
    assert res.status_code == 400
    assert "Target slot overlaps LEAVE" in res.json()["detail"]


# ==============================================================================
# 3.23 – 3.29: Listing & Pagination Tests
# ==============================================================================

def test_3_23_to_3_25_list_and_filters(client, db_session, doctor_a, headers_a):
    # 5 appointments: 2 BOOKED, 2 COMPLETED, 1 CANCELLED
    appointments = [
        Appointment(
            doctor_id=doctor_a.id,
            patient_name="Patient 1",
            date=date(2026, 10, 12),
            start_time=time(9, 0),
            end_time=time(9, 30),
            status="BOOKED",
        ),
        Appointment(
            doctor_id=doctor_a.id,
            patient_name="Patient 2",
            date=date(2026, 10, 12),
            start_time=time(10, 0),
            end_time=time(10, 30),
            status="BOOKED",
        ),
        Appointment(
            doctor_id=doctor_a.id,
            patient_name="Patient 3",
            date=date(2026, 10, 14),
            start_time=time(11, 0),
            end_time=time(11, 30),
            status="COMPLETED",
        ),
        Appointment(
            doctor_id=doctor_a.id,
            patient_name="Patient 4",
            date=date(2026, 10, 14),
            start_time=time(12, 0),
            end_time=time(12, 30),
            status="COMPLETED",
        ),
        Appointment(
            doctor_id=doctor_a.id,
            patient_name="Patient 5",
            date=date(2026, 10, 18),
            start_time=time(9, 0),
            end_time=time(9, 30),
            status="CANCELLED",
        ),
    ]
    db_session.add_all(appointments)
    db_session.commit()

    # 3.23 List all
    res_all = client.get("/api/v1/doctor/appointments", headers=headers_a)
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert data_all["total"] == 5
    assert len(data_all["items"]) == 5
    assert data_all["page"] == 1
    assert data_all["page_size"] == 20

    # 3.24 Filter by status=BOOKED
    res_booked = client.get("/api/v1/doctor/appointments?status=BOOKED", headers=headers_a)
    assert res_booked.status_code == 200
    data_booked = res_booked.json()
    assert data_booked["total"] == 2
    assert len(data_booked["items"]) == 2
    assert all(item["status"] == "BOOKED" for item in data_booked["items"])

    # 3.25 Filter by date range Oct 13 to Oct 15 -> only Oct 14 appointments
    res_range = client.get(
        "/api/v1/doctor/appointments?from=2026-10-13&to=2026-10-15",
        headers=headers_a,
    )
    assert res_range.status_code == 200
    data_range = res_range.json()
    assert data_range["total"] == 2
    assert all(item["date"] == "2026-10-14" for item in data_range["items"])


def test_3_26_pagination_page_2(client, db_session, doctor_a, headers_a):
    # 25 appointments across days
    appointments = []
    for day in range(1, 26):
        appointments.append(
            Appointment(
                doctor_id=doctor_a.id,
                patient_name=f"Patient {day}",
                date=date(2026, 10, (day % 28) + 1),
                start_time=time(9, 0),
                end_time=time(9, 30),
                status="BOOKED",
            )
        )
    db_session.add_all(appointments)
    db_session.commit()

    res = client.get("/api/v1/doctor/appointments?page=2&page_size=10", headers=headers_a)
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 2
    assert data["page_size"] == 10
    assert data["total"] == 25
    assert len(data["items"]) == 10


def test_3_27_get_single_appointment(client, db_session, doctor_a, headers_a):
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient Single",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    res = client.get(f"/api/v1/doctor/appointments/{apt.id}", headers=headers_a)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(apt.id)
    assert data["patient_name"] == "Patient Single"


def test_3_28_get_nonexistent_appointment(client, headers_a):
    random_id = uuid.uuid4()
    res = client.get(f"/api/v1/doctor/appointments/{random_id}", headers=headers_a)
    assert res.status_code == 404
    assert "Appointment not found" in res.json()["detail"]


def test_3_29_get_another_doctors_appointment(client, db_session, doctor_a, doctor_b, headers_b):
    # Apt belongs to doctor_a
    apt = Appointment(
        doctor_id=doctor_a.id,
        patient_name="Patient Private",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt)
    db_session.commit()
    db_session.refresh(apt)

    # doctor_b calls get
    res = client.get(f"/api/v1/doctor/appointments/{apt.id}", headers=headers_b)
    assert res.status_code == 404
    assert "Appointment not found" in res.json()["detail"]


# ==============================================================================
# 3.30 – 3.32: Stub Cleanup Tests
# ==============================================================================

def test_3_30_old_stub_endpoint_removed(client, tenant_a):
    res = client.post(
        f"/api/v1/public/tenants/{tenant_a.slug}/appointments",
        json={
            "patient_name": "Test Patient",
            "appointment_date": "2026-10-12",
            "appointment_time": "10:00",
            "appointment_type": "in_clinic",
        },
    )
    assert res.status_code in (404, 405)


def test_3_31_medicine_order_stub_intact(client, tenant_a):
    res = client.post(
        f"/api/v1/public/tenants/{tenant_a.slug}/medicine-orders",
        json={
            "patient_name": "Test Patient",
            "patient_phone": "+1234567890",
            "delivery_address": "123 Main Street",
            "medicines": "Paracetamol 500mg, 2 strips",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "received"
    assert data["order_id"].startswith("MED-")


def test_3_32_report_upload_stub_intact(client, tenant_a):
    res = client.post(
        f"/api/v1/public/tenants/{tenant_a.slug}/reports",
        json={
            "patient_name": "Test Patient",
            "patient_phone": "+1234567890",
            "report_type": "Blood Test",
            "file_name": "blood_test.pdf",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "received"
    assert data["report_id"].startswith("REP-")
