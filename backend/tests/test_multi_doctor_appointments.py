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
from app.models.tenant import Tenant
from app.models.staff import StaffMember
from app.models.schedule import Schedule
from app.models.appointment import Appointment
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


@pytest.fixture
def clinic_setup(db_session):
    primary_doc = Doctor(
        id=uuid.uuid4(),
        email="clinic.owner@example.com",
        full_name="Dr. Gregory House",
        speciality="Diagnostic Medicine",
        is_active=True,
        working_hours={
            "shifts": [{"start": "09:00", "end": "17:00", "enabled": True}],
            "closed_days": [],
        },
    )
    db_session.add(primary_doc)

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=primary_doc.id,
        slug="princeton-plainsboro",
        clinic_name="Princeton Plainsboro Teaching Hospital",
        status="active",
        service_appointment=True,
    )
    db_session.add(tenant)

    staff_doctor_1 = StaffMember(
        id=uuid.uuid4(),
        doctor_id=primary_doc.id,
        full_name="Dr. James Wilson",
        phone="+1 555-0101",
        role="Doctor",
        department="Clinical",
        status="active",
        can_login=True,
    )
    staff_doctor_2 = StaffMember(
        id=uuid.uuid4(),
        doctor_id=primary_doc.id,
        full_name="Dr. Lisa Cuddy",
        phone="+1 555-0102",
        role="Consultant Physician",
        department="Clinical",
        status="active",
        can_login=True,
    )
    staff_receptionist = StaffMember(
        id=uuid.uuid4(),
        doctor_id=primary_doc.id,
        full_name="Brenda Previn",
        phone="+1 555-0103",
        role="Receptionist",
        department="Front Desk",
        status="active",
    )
    db_session.add_all([staff_doctor_1, staff_doctor_2, staff_receptionist])
    db_session.commit()

    token = create_access_token(subject=str(primary_doc.id))
    headers = {"Authorization": f"Bearer {token}"}

    return {
        "primary_doc": primary_doc,
        "tenant": tenant,
        "staff1": staff_doctor_1,
        "staff2": staff_doctor_2,
        "receptionist": staff_receptionist,
        "headers": headers,
    }


def test_concurrent_booking_multiple_doctors_same_time_slot(client, clinic_setup):
    """
    Core requirement verification:
    Primary doctor and multiple staff doctors can all have active bookings
    at the exact same time slot interval on the same date!
    """
    headers = clinic_setup["headers"]
    staff1 = clinic_setup["staff1"]
    staff2 = clinic_setup["staff2"]
    target_date = "2026-11-20"
    start_time = "10:00:00"
    end_time = "10:30:00"

    # 1. Book under Primary Doctor (staff_id = None)
    res_primary = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Alpha",
            "patient_contact": "555-1111",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": None,
            "reason": "Primary consultation",
        },
    )
    assert res_primary.status_code == 201
    apt_primary = res_primary.json()
    assert apt_primary["staff_id"] is None
    assert apt_primary["doctor_name"] == "Dr. Gregory House"

    # 2. Book under Staff Doctor 1 at the EXACT SAME TIME SLOT!
    res_staff1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Beta",
            "patient_contact": "555-2222",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": str(staff1.id),
            "reason": "Oncology follow-up",
        },
    )
    assert res_staff1.status_code == 201
    apt_staff1 = res_staff1.json()
    assert apt_staff1["staff_id"] == str(staff1.id)
    assert apt_staff1["doctor_name"] == "Dr. James Wilson"
    assert apt_staff1["staff_name"] == "Dr. James Wilson"

    # 3. Book under Staff Doctor 2 at the EXACT SAME TIME SLOT!
    res_staff2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Patient Gamma",
            "patient_contact": "555-3333",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": str(staff2.id),
            "reason": "Endocrine evaluation",
        },
    )
    assert res_staff2.status_code == 201
    apt_staff2 = res_staff2.json()
    assert apt_staff2["staff_id"] == str(staff2.id)
    assert apt_staff2["doctor_name"] == "Dr. Lisa Cuddy"
    assert apt_staff2["staff_name"] == "Dr. Lisa Cuddy"

    # All three bookings exist concurrently at 10:00:00!
    list_res = client.get(
        f"/api/v1/doctor/appointments?from={target_date}&to={target_date}",
        headers=headers,
    )
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 3
    assert all(item["start_time"] == "10:00:00" for item in items)


def test_same_doctor_collision_rejected_with_409(client, clinic_setup):
    """
    A single doctor (primary or staff) cannot be double-booked in the same slot.
    """
    headers = clinic_setup["headers"]
    staff1 = clinic_setup["staff1"]
    target_date = "2026-11-20"
    start_time = "11:00:00"
    end_time = "11:30:00"

    # Book Dr. James Wilson
    res1 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "First Patient",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": str(staff1.id),
        },
    )
    assert res1.status_code == 201

    # Attempt to book Dr. James Wilson again at same time -> 409 Conflict
    res2 = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Duplicate Attempt Patient",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": str(staff1.id),
        },
    )
    assert res2.status_code == 409
    assert "already booked" in res2.json()["detail"].lower()


def test_cancelled_appointment_frees_slot_for_that_doctor(client, clinic_setup):
    """
    Cancelling an appointment allows that specific doctor to be booked again.
    """
    headers = clinic_setup["headers"]
    staff1 = clinic_setup["staff1"]
    target_date = "2026-11-20"
    start_time = "14:00:00"
    end_time = "14:30:00"

    res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Original Patient",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": str(staff1.id),
        },
    )
    assert res.status_code == 201
    apt_id = res.json()["id"]

    # Cancel appointment
    cancel_res = client.post(f"/api/v1/doctor/appointments/{apt_id}/cancel", headers=headers)
    assert cancel_res.status_code == 200

    # Rebook slot for Dr. Wilson -> succeeds 201
    rebook_res = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "New Replacement Patient",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_id": str(staff1.id),
        },
    )
    assert rebook_res.status_code == 201


def test_practitioners_list_endpoints(client, clinic_setup):
    """
    Verify GET /doctor/practitioners and GET /public/tenants/{slug}/practitioners
    return primary doctor and all clinical/doctor staff members.
    """
    headers = clinic_setup["headers"]
    tenant = clinic_setup["tenant"]

    # Authenticated doctor endpoint
    res = client.get("/api/v1/doctor/practitioners", headers=headers)
    assert res.status_code == 200
    practitioners = res.json()
    assert len(practitioners) == 3  # Primary + staff1 + staff2 (receptionist excluded)

    primary = next(p for p in practitioners if p["is_primary"])
    assert primary["name"] == "Dr. Gregory House"
    assert primary["id"] is None

    staff_names = [p["name"] for p in practitioners if not p["is_primary"]]
    assert "Dr. James Wilson" in staff_names
    assert "Dr. Lisa Cuddy" in staff_names

    # Public patient endpoint
    pub_res = client.get(f"/api/v1/public/tenants/{tenant.slug}/practitioners")
    assert pub_res.status_code == 200
    pub_practitioners = pub_res.json()
    assert len(pub_practitioners) == 3


def test_multi_doctor_slot_availability_engine(client, clinic_setup, db_session):
    """
    Total capacity = 3. Slot 10:00 stays available until ALL 3 doctors are booked!
    """
    doc = clinic_setup["primary_doc"]
    staff1 = clinic_setup["staff1"]
    staff2 = clinic_setup["staff2"]
    target_date = date(2026, 11, 25)

    # 1. Before any appointments: 10:00 is available
    slots = schedule_service.generate_available_slots(doc.id, target_date, db_session)
    slot_starts = [s["start"] for s in slots]
    assert "10:00" in slot_starts

    # 2. Book Primary Doctor at 10:00
    apt1 = Appointment(
        doctor_id=doc.id,
        staff_id=None,
        patient_name="P1",
        date=target_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt1)
    db_session.commit()

    slots_after_1 = schedule_service.generate_available_slots(doc.id, target_date, db_session)
    assert "10:00" in [s["start"] for s in slots_after_1]  # Still open because staff1 & staff2 are free!

    # 3. Book Staff 1 at 10:00
    apt2 = Appointment(
        doctor_id=doc.id,
        staff_id=staff1.id,
        patient_name="P2",
        date=target_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt2)
    db_session.commit()

    slots_after_2 = schedule_service.generate_available_slots(doc.id, target_date, db_session)
    assert "10:00" in [s["start"] for s in slots_after_2]  # Still open because staff2 is free!

    # 4. Book Staff 2 at 10:00
    apt3 = Appointment(
        doctor_id=doc.id,
        staff_id=staff2.id,
        patient_name="P3",
        date=target_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(apt3)
    db_session.commit()

    slots_after_3 = schedule_service.generate_available_slots(doc.id, target_date, db_session)
    assert "10:00" not in [s["start"] for s in slots_after_3]  # All 3 doctors booked! Full capacity reached!


def test_calendar_and_appointments_doctor_filtering(client, clinic_setup):
    """
    Verify /doctor/calendar and /doctor/appointments filter by staff_id and primary_only.
    """
    headers = clinic_setup["headers"]
    staff1 = clinic_setup["staff1"]
    staff2 = clinic_setup["staff2"]
    target_date = "2026-11-21"

    # Book 1 for primary, 1 for staff1, 1 for staff2
    client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Primary Patient",
            "date": target_date,
            "start_time": "09:00:00",
            "end_time": "09:30:00",
            "staff_id": None,
        },
    )
    client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Staff 1 Patient",
            "date": target_date,
            "start_time": "09:00:00",
            "end_time": "09:30:00",
            "staff_id": str(staff1.id),
        },
    )
    client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Staff 2 Patient",
            "date": target_date,
            "start_time": "09:30:00",
            "end_time": "10:00:00",
            "staff_id": str(staff2.id),
        },
    )

    # All appointments in calendar
    res_all = client.get(f"/api/v1/doctor/calendar?from={target_date}&to={target_date}", headers=headers)
    assert res_all.status_code == 200
    events_all = res_all.json()["dates"][0]["events"]
    assert len(events_all) == 3

    # Filter to staff 1 only
    res_staff1 = client.get(
        f"/api/v1/doctor/calendar?from={target_date}&to={target_date}&staff_id={staff1.id}",
        headers=headers,
    )
    assert res_staff1.status_code == 200
    events_staff1 = res_staff1.json()["dates"][0]["events"]
    assert len(events_staff1) == 1
    assert events_staff1[0]["patient_name"] == "Staff 1 Patient"

    # Filter to primary only
    res_primary = client.get(
        f"/api/v1/doctor/calendar?from={target_date}&to={target_date}&primary_only=true",
        headers=headers,
    )
    assert res_primary.status_code == 200
    events_primary = res_primary.json()["dates"][0]["events"]
    assert len(events_primary) == 1
    assert events_primary[0]["patient_name"] == "Primary Patient"

    # Filter /doctor/appointments to staff 2 only
    res_apt_staff2 = client.get(
        f"/api/v1/doctor/appointments?from={target_date}&to={target_date}&staff_id={staff2.id}",
        headers=headers,
    )
    assert res_apt_staff2.status_code == 200
    items_staff2 = res_apt_staff2.json()["items"]
    assert len(items_staff2) == 1
    assert items_staff2[0]["patient_name"] == "Staff 2 Patient"


def test_reschedule_allows_concurrent_slots_across_doctors(client, clinic_setup):
    """
    Rescheduling an appointment for staff doctor to a slot already occupied by
    primary doctor succeeds without 409 conflict.
    """
    headers = clinic_setup["headers"]
    staff1 = clinic_setup["staff1"]
    target_date = "2026-11-22"

    # Primary booked at 10:00
    client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Primary Patient 10am",
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "10:30:00",
            "staff_id": None,
        },
    )

    # Staff 1 booked at 11:00
    res_staff = client.post(
        "/api/v1/doctor/appointments",
        headers=headers,
        json={
            "patient_name": "Staff 1 Patient 11am",
            "date": target_date,
            "start_time": "11:00:00",
            "end_time": "11:30:00",
            "staff_id": str(staff1.id),
        },
    )
    assert res_staff.status_code == 201
    apt_id = res_staff.json()["id"]

    # Reschedule Staff 1 to 10:00 (concurrent with Primary) -> succeeds!
    res_resched = client.patch(
        f"/api/v1/doctor/appointments/{apt_id}",
        headers=headers,
        json={
            "date": target_date,
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert res_resched.status_code == 200
    resched_data = res_resched.json()
    assert resched_data["start_time"] == "10:00:00"
    assert resched_data["staff_id"] == str(staff1.id)

