import uuid
from datetime import date, time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.staff import StaffMember
from app.models.appointment import Appointment
from app.models.schedule import Schedule

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
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def clinic_owner(db_session):
    doctor = Doctor(
        id=uuid.uuid4(),
        email="owner@clinic.com",
        full_name="Dr. Clinic Owner",
        phone="+919876543200",
        onboarding_completed=True,
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)
    return doctor


@pytest.fixture
def staff_doctor(db_session, clinic_owner):
    staff = StaffMember(
        id=uuid.uuid4(),
        doctor_id=clinic_owner.id,
        full_name="Dr. Associate Staff",
        email="associate@clinic.com",
        phone="+919876543201",
        role="Doctor",
        department="Clinical",
        can_login=True,
        status="active",
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff


@pytest.fixture
def staff_receptionist(db_session, clinic_owner):
    receptionist = StaffMember(
        id=uuid.uuid4(),
        doctor_id=clinic_owner.id,
        full_name="Rita FrontDesk",
        email="rita@clinic.com",
        phone="+919876543202",
        role="Receptionist",
        department="Front Desk",
        can_login=True,
        status="active",
    )
    db_session.add(receptionist)
    db_session.commit()
    db_session.refresh(receptionist)
    return receptionist


@pytest.fixture
def owner_headers(clinic_owner):
    token = create_access_token(
        subject=str(clinic_owner.id),
        claims={"doctor_id": str(clinic_owner.id), "user_type": "doctor", "role": "Doctor"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def staff_doctor_headers(staff_doctor, clinic_owner):
    token = create_access_token(
        subject=str(staff_doctor.id),
        claims={
            "doctor_id": str(clinic_owner.id),
            "user_type": "staff",
            "role": "Doctor",
            "staff_id": str(staff_doctor.id),
        },
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def receptionist_headers(staff_receptionist, clinic_owner):
    token = create_access_token(
        subject=str(staff_receptionist.id),
        claims={
            "doctor_id": str(clinic_owner.id),
            "user_type": "staff",
            "role": "Receptionist",
            "staff_id": str(staff_receptionist.id),
        },
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# TESTS
# ============================================================================

def test_staff_doctor_can_only_see_own_appointments(
    client, db_session, clinic_owner, staff_doctor, owner_headers, staff_doctor_headers
):
    """Test 1: Staff doctor only receives their own appointments in list and calendar."""
    q_date = date(2026, 11, 20)
    # 1 appointment for owner
    appt_owner = Appointment(
        doctor_id=clinic_owner.id,
        staff_id=None,
        patient_name="Owner Patient",
        date=q_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    # 1 appointment for staff doctor
    appt_staff = Appointment(
        doctor_id=clinic_owner.id,
        staff_id=staff_doctor.id,
        patient_name="Staff Patient",
        date=q_date,
        start_time=time(11, 0),
        end_time=time(11, 30),
        status="BOOKED",
    )
    db_session.add_all([appt_owner, appt_staff])
    db_session.commit()

    # Owner sees both (or clinic-wide total)
    res_owner = client.get("/api/v1/doctor/appointments", headers=owner_headers)
    assert res_owner.status_code == 200
    assert res_owner.json()["total"] == 2

    # Staff Doctor ONLY sees their own appointment
    res_staff = client.get("/api/v1/doctor/appointments", headers=staff_doctor_headers)
    assert res_staff.status_code == 200
    staff_items = res_staff.json()["items"]
    assert len(staff_items) == 1
    assert staff_items[0]["patient_name"] == "Staff Patient"
    assert staff_items[0]["staff_id"] == str(staff_doctor.id)

    # Staff Doctor calendar also ONLY returns their own bookings
    res_cal = client.get(f"/api/v1/doctor/calendar?from={q_date}&to={q_date}", headers=staff_doctor_headers)
    assert res_cal.status_code == 200
    cal_dates = res_cal.json()["dates"]
    assert len(cal_dates) == 1
    cal_events = cal_dates[0]["events"]
    assert len(cal_events) == 1
    assert cal_events[0]["patient_name"] == "Staff Patient"
    assert cal_events[0]["staff_id"] == str(staff_doctor.id)


def test_staff_doctor_cannot_book_appointment(
    client, db_session, clinic_owner, staff_doctor, staff_doctor_headers, owner_headers
):
    """Test 2: Staff doctor gets 403 Forbidden when attempting to book an appointment."""
    q_date = date(2026, 11, 20)
    db_session.add(
        Schedule(
            doctor_id=clinic_owner.id,
            date=q_date,
            start_time=time(9, 0),
            end_time=time(17, 0),
            type="AVAILABLE",
        )
    )
    db_session.commit()

    booking_payload = {
        "patient_name": "Walkin Patient",
        "patient_contact": "+919876500000",
        "date": "2026-11-20",
        "start_time": "10:00",
        "end_time": "10:30",
        "reason": "Checkup",
    }

    # Staff Doctor tries to book -> 403 Forbidden
    res_staff = client.post("/api/v1/doctor/appointments", json=booking_payload, headers=staff_doctor_headers)
    assert res_staff.status_code == 403
    assert "Staff doctors are not permitted to book appointments" in res_staff.json()["detail"]

    # Owner can book normally
    res_owner = client.post("/api/v1/doctor/appointments", json=booking_payload, headers=owner_headers)
    assert res_owner.status_code == 201


def test_staff_doctor_cannot_modify_or_reschedule_appointment(
    client, db_session, clinic_owner, staff_doctor, staff_doctor_headers
):
    """Test 3: Staff doctor cannot modify or reschedule appointments."""
    q_date = date(2026, 11, 20)
    appt = Appointment(
        doctor_id=clinic_owner.id,
        staff_id=staff_doctor.id,
        patient_name="Staff Patient",
        date=q_date,
        start_time=time(11, 0),
        end_time=time(11, 30),
        status="BOOKED",
    )
    db_session.add(appt)
    db_session.commit()

    patch_payload = {
        "date": "2026-11-21",
        "start_time": "14:00",
        "end_time": "14:30",
    }
    res = client.patch(f"/api/v1/doctor/appointments/{appt.id}", json=patch_payload, headers=staff_doctor_headers)
    assert res.status_code == 403
    assert "Staff doctors are not permitted to modify or reschedule appointments" in res.json()["detail"]


def test_staff_doctor_cannot_cancel_appointment(
    client, db_session, clinic_owner, staff_doctor, staff_doctor_headers
):
    """Test 4: Staff doctor cannot cancel appointments."""
    q_date = date(2026, 11, 20)
    appt = Appointment(
        doctor_id=clinic_owner.id,
        staff_id=staff_doctor.id,
        patient_name="Staff Patient",
        date=q_date,
        start_time=time(11, 0),
        end_time=time(11, 30),
        status="BOOKED",
    )
    db_session.add(appt)
    db_session.commit()

    res = client.post(f"/api/v1/doctor/appointments/{appt.id}/cancel", headers=staff_doctor_headers)
    assert res.status_code == 403
    assert "Staff doctors are not permitted to cancel appointments" in res.json()["detail"]


def test_staff_doctor_can_complete_own_appointment(
    client, db_session, clinic_owner, staff_doctor, staff_doctor_headers
):
    """Test 5: Staff doctor CAN complete their own appointment."""
    q_date = date(2026, 11, 20)
    appt = Appointment(
        doctor_id=clinic_owner.id,
        staff_id=staff_doctor.id,
        patient_name="Staff Patient",
        date=q_date,
        start_time=time(11, 0),
        end_time=time(11, 30),
        status="BOOKED",
    )
    db_session.add(appt)
    db_session.commit()

    res = client.post(f"/api/v1/doctor/appointments/{appt.id}/complete", headers=staff_doctor_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"


def test_staff_doctor_cannot_access_or_complete_other_doctor_appointment(
    client, db_session, clinic_owner, staff_doctor, staff_doctor_headers
):
    """Test 6: Staff doctor gets 403 when trying to access or complete another doctor's appointment."""
    q_date = date(2026, 11, 20)
    appt_owner = Appointment(
        doctor_id=clinic_owner.id,
        staff_id=None,
        patient_name="Owner Patient",
        date=q_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(appt_owner)
    db_session.commit()

    # GET another doctor's appointment -> 403
    res_get = client.get(f"/api/v1/doctor/appointments/{appt_owner.id}", headers=staff_doctor_headers)
    assert res_get.status_code == 403

    # COMPLETE another doctor's appointment -> 403
    res_comp = client.post(f"/api/v1/doctor/appointments/{appt_owner.id}/complete", headers=staff_doctor_headers)
    assert res_comp.status_code == 403


def test_receptionist_can_book_and_cancel_appointments(
    client, db_session, clinic_owner, receptionist_headers
):
    """Test 7: Receptionists are NOT restricted from booking or cancelling appointments."""
    q_date = date(2026, 11, 20)
    db_session.add(
        Schedule(
            doctor_id=clinic_owner.id,
            date=q_date,
            start_time=time(9, 0),
            end_time=time(17, 0),
            type="AVAILABLE",
        )
    )
    db_session.commit()

    booking_payload = {
        "patient_name": "Receptionist Booked Patient",
        "patient_contact": "+919876511111",
        "date": "2026-11-20",
        "start_time": "12:00",
        "end_time": "12:30",
        "reason": "Front desk booking",
    }

    # Receptionist can book
    res_book = client.post("/api/v1/doctor/appointments", json=booking_payload, headers=receptionist_headers)
    assert res_book.status_code == 201
    appt_id = res_book.json()["id"]

    # Receptionist can cancel
    res_cancel = client.post(f"/api/v1/doctor/appointments/{appt_id}/cancel", headers=receptionist_headers)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"


def test_specialist_staff_doctor_classification_and_nurse_exclusion(
    client, db_session, clinic_owner
):
    """Test 8: Specialist roles (e.g. Cardiologist) are recognized as staff doctors; nurses are excluded."""
    from app.models.staff import is_doctor_role
    from app.services.appointment_service import list_practitioners

    # Unit checks on is_doctor_role
    assert is_doctor_role("Cardiologist") is True
    assert is_doctor_role("Senior Consultant Cardiologist") is True
    assert is_doctor_role("Pediatrician") is True
    assert is_doctor_role("Dentist") is True
    assert is_doctor_role("Resident Doctor") is True
    assert is_doctor_role("Junior Doctor") is True
    assert is_doctor_role("Surgeon") is True
    assert is_doctor_role("Nurse") is False
    assert is_doctor_role("Head Nurse") is False
    assert is_doctor_role("Doctor's Assistant") is False
    assert is_doctor_role("Medical Assistant") is False
    assert is_doctor_role("Lab Technician") is False
    assert is_doctor_role("Receptionist") is False

    # Create specialist staff member (Cardiologist)
    cardiologist = StaffMember(
        id=uuid.uuid4(),
        doctor_id=clinic_owner.id,
        full_name="Dr. Priya Cardiologist",
        role="Cardiologist",
        department="Clinical",
        phone="+919876599901",
        can_login=True,
        username="priya.cardio",
        status="active",
        token_version=1,
    )
    # Create nurse in Clinical department
    nurse = StaffMember(
        id=uuid.uuid4(),
        doctor_id=clinic_owner.id,
        full_name="Sister Florence",
        role="Nurse",
        department="Clinical",
        phone="+919876599902",
        can_login=True,
        username="florence.nurse",
        status="active",
        token_version=1,
    )
    db_session.add_all([cardiologist, nurse])
    db_session.commit()

    # Verify list_practitioners includes Cardiologist but excludes Nurse (despite Clinical department)
    practitioners = list_practitioners(clinic_owner.id, db_session)
    practitioner_ids = [p["id"] for p in practitioners]
    assert cardiologist.id in practitioner_ids
    assert nurse.id not in practitioner_ids

    # Authenticate as Cardiologist
    token = create_access_token(
        subject=str(cardiologist.id),
        claims={
            "doctor_id": str(clinic_owner.id),
            "user_type": "staff",
            "role": "Cardiologist",
            "token_version": 1,
        },
    )
    cardio_headers = {"Authorization": f"Bearer {token}"}

    # Cardiologist is guarded by is_staff_doctor and blocked from booking
    booking_payload = {
        "patient_name": "Test Patient",
        "patient_contact": "+919876500000",
        "date": "2026-11-20",
        "start_time": "10:00",
        "end_time": "10:30",
        "reason": "Cardiology consult",
    }
    res_book = client.post("/api/v1/doctor/appointments", json=booking_payload, headers=cardio_headers)
    assert res_book.status_code == 403
    assert "Staff doctors are not permitted to book appointments" in res_book.json()["detail"]

    # Booking an appointment targeting Nurse as the practitioner is rejected
    owner_token = create_access_token(subject=str(clinic_owner.id))
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    db_session.add(
        Schedule(
            doctor_id=clinic_owner.id,
            date=date(2026, 11, 20),
            start_time=time(9, 0),
            end_time=time(17, 0),
            type="AVAILABLE",
        )
    )
    db_session.commit()

    nurse_booking_payload = {
        "patient_name": "Patient for Nurse",
        "patient_contact": "+919876512345",
        "date": "2026-11-20",
        "start_time": "14:00",
        "end_time": "14:30",
        "staff_id": str(nurse.id),
        "reason": "Routine Check",
    }
    res_nurse_book = client.post("/api/v1/doctor/appointments", json=nurse_booking_payload, headers=owner_headers)
    assert res_nurse_book.status_code == 400
    assert "not a clinical practitioner" in res_nurse_book.json()["detail"]

