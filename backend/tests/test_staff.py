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
def test_doctor_and_auth(db_session):
    doctor = Doctor(
        id=uuid.uuid4(),
        email="doctor.sharma@apollo.com",
        full_name="Dr. Rajesh Sharma",
        phone="+919876543210",
        speciality="Cardiology",
        is_active=True,
    )
    db_session.add(doctor)
    db_session.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        clinic_name="Apollo Heart Clinic",
        slug=f"apollo-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(doctor)

    token = create_access_token(str(doctor.id))
    headers = {"Authorization": f"Bearer {token}"}
    return doctor, headers


@pytest.fixture
def other_doctor_and_auth(db_session):
    doctor = Doctor(
        id=uuid.uuid4(),
        email="doctor.verma@fortis.com",
        full_name="Dr. Anita Verma",
        phone="+919876543211",
        speciality="Pediatrics",
        is_active=True,
    )
    db_session.add(doctor)
    db_session.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        clinic_name="Fortis Care",
        slug=f"fortis-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(doctor)

    token = create_access_token(str(doctor.id))
    headers = {"Authorization": f"Bearer {token}"}
    return doctor, headers


# ---------------------------------------------------------------------------
# Test Suite: Staff Roster CRUD & Multi-Tenant Isolation
# ---------------------------------------------------------------------------
def test_create_doctor_staff_member(client, test_doctor_and_auth):
    doctor, headers = test_doctor_and_auth

    payload = {
        "full_name": "Dr. Sameer Joshi",
        "email": "dr.sameer@apollo.com",
        "phone": "+919876599999",
        "role": "Doctor",
        "department": "Clinical",
        "employment_type": "full_time",
        "status": "active",
        "base_salary_paise": 12000000,  # ₹1,20,000
    }

    res = client.post("/api/v1/staff", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "Doctor"
    assert data["department"] == "Clinical"
    assert data["full_name"] == "Dr. Sameer Joshi"
    assert data["doctor_id"] == str(doctor.id)


def test_create_and_list_staff(client, test_doctor_and_auth):
    doctor, headers = test_doctor_and_auth

    payload = {
        "full_name": "Priya Patel",
        "email": "priya.p@apollo.com",
        "phone": "+919876500001",
        "role": "Nurse",
        "department": "Nursing",
        "employment_type": "full_time",
        "status": "active",
        "base_salary_paise": 2800000,  # ₹28,000
        "emergency_contact": "Ramesh Patel (+919876500002)",
        "notes": "Senior triage nurse with ICU experience",
    }

    res = client.post("/api/v1/staff", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["full_name"] == "Priya Patel"
    assert data["role"] == "Nurse"
    assert data["base_salary_paise"] == 2800000
    assert data["doctor_id"] == str(doctor.id)

    # List staff
    list_res = client.get("/api/v1/staff", headers=headers)
    assert list_res.status_code == 200
    staff_list = list_res.json()
    assert len(staff_list) == 1
    assert staff_list[0]["id"] == data["id"]


def test_staff_search_and_filter(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # Add 2 staff members
    client.post(
        "/api/v1/staff",
        json={"full_name": "Kavita Rao", "phone": "+919876511111", "role": "Receptionist", "department": "Front Desk"},
        headers=headers,
    )
    client.post(
        "/api/v1/staff",
        json={"full_name": "Dr. Suresh Kumar", "phone": "+919876522222", "role": "Doctor", "department": "Clinical"},
        headers=headers,
    )

    # Filter by department
    res_front = client.get("/api/v1/staff?department=Front Desk", headers=headers)
    assert res_front.status_code == 200
    assert len(res_front.json()) == 1
    assert res_front.json()[0]["full_name"] == "Kavita Rao"

    # Search by keyword
    res_search = client.get("/api/v1/staff?search=Suresh", headers=headers)
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert res_search.json()[0]["role"] == "Doctor"


def test_staff_update_and_delete(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # Create
    res = client.post(
        "/api/v1/staff",
        json={"full_name": "Amit Sen", "phone": "+919876533333", "role": "Receptionist"},
        headers=headers,
    )
    staff_id = res.json()["id"]

    # Update
    update_res = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"full_name": "Amit Kumar Sen", "role": "Billing Executive"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["full_name"] == "Amit Kumar Sen"
    assert update_res.json()["role"] == "Billing Executive"

    # Delete
    del_res = client.delete(f"/api/v1/staff/{staff_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify not found
    get_res = client.get(f"/api/v1/staff/{staff_id}", headers=headers)
    assert get_res.status_code == 404


def test_staff_edit_profile_comprehensive(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # 1. Create a staff member with initial details
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Rohit Sharma",
            "phone": "+919876599991",
            "role": "Doctor",
            "department": "Clinical",
            "employment_type": "full_time",
            "base_salary_paise": 6500000,
            "emergency_contact": "Ritika (+919876599992)",
            "notes": "General OPD surgeon",
            "can_login": True,
            "password": "InitialPass@123",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    staff_data = create_res.json()
    staff_id = staff_data["id"]
    initial_username = staff_data["username"]
    assert initial_username == "rohit.sharma"

    # 2. Edit Profile: Update personal, contact, compensation, and notes
    edit_res = client.put(
        f"/api/v1/staff/{staff_id}",
        json={
            "full_name": "Dr. Rohit S. Sharma",
            "phone": "+919876588888",
            "role": "Senior Consultant",
            "department": "Surgery",
            "status": "on_leave",
            "base_salary_paise": 8500000,
            "emergency_contact": "Ritika S (+919876588889)",
            "notes": "Promoted to Senior Consultant, currently on scheduled leave",
            "username": "rohit.senior",
            "password": "UpdatedPass@456",
        },
        headers=headers,
    )
    assert edit_res.status_code == 200
    updated = edit_res.json()
    assert updated["full_name"] == "Dr. Rohit S. Sharma"
    assert updated["phone"] == "+919876588888"
    assert updated["role"] == "Senior Consultant"
    assert updated["department"] == "Surgery"
    assert updated["status"] == "on_leave"
    assert updated["base_salary_paise"] == 8500000
    assert updated["emergency_contact"] == "Ritika S (+919876588889)"
    assert updated["notes"] == "Promoted to Senior Consultant, currently on scheduled leave"
    assert updated["username"] == "rohit.senior"

    # 3. Verify login is rejected while on_leave
    on_leave_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "rohit.senior",
            "password": "UpdatedPass@456",
            "portal_type": "staff",
        },
    )
    assert on_leave_res.status_code == 401
    assert "Staff account is inactive" in on_leave_res.json()["detail"]

    # 4. Set status back to active
    client.put(
        f"/api/v1/staff/{staff_id}",
        json={"status": "active"},
        headers=headers,
    )

    # 5. Verify login succeeds with updated username and new password
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "rohit.senior",
            "password": "UpdatedPass@456",
            "portal_type": "staff",
        },
    )
    assert login_res.status_code == 200
    assert login_res.json()["doctor"]["username"] == "rohit.senior"
    assert login_res.json()["doctor"]["role"] == "Senior Consultant"

    # 6. Verify old password fails
    old_pw_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "rohit.senior",
            "password": "InitialPass@123",
            "portal_type": "staff",
        },
    )
    assert old_pw_res.status_code == 401

    # 7. Create another staff member to test username collision prevention on edit
    client.post(
        "/api/v1/staff",
        json={
            "full_name": "Suresh Raina",
            "phone": "+919876577777",
            "role": "Receptionist",
            "can_login": True,
            "username": "suresh.raina",
            "password": "SureshPass@123",
        },
        headers=headers,
    )

    # Attempt to edit Rohit's username to suresh.raina -> must fail with 400
    collision_res = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"username": "suresh.raina"},
        headers=headers,
    )
    assert collision_res.status_code == 400
    assert "User ID already exists" in collision_res.json()["detail"]

    # 8. Disable portal login access
    disable_res = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"can_login": False},
        headers=headers,
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["can_login"] is False

    # Attempt login after disabling -> must be rejected (401 unauthorized)
    disabled_login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "rohit.senior",
            "password": "UpdatedPass@456",
            "portal_type": "staff",
        },
    )
    assert disabled_login_res.status_code == 401
    assert "Invalid User ID or password" in disabled_login_res.json()["detail"]


def test_staff_multi_tenant_isolation(client, test_doctor_and_auth, other_doctor_and_auth):
    doc_a, headers_a = test_doctor_and_auth
    _, headers_b = other_doctor_and_auth

    # Doctor A creates a staff member
    res = client.post(
        "/api/v1/staff",
        json={"full_name": "Dr. A's Assistant", "phone": "+919876544444", "role": "Receptionist"},
        headers=headers_a,
    )
    staff_id = res.json()["id"]

    # Doctor B lists staff -> should be empty
    list_b = client.get("/api/v1/staff", headers=headers_b)
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # Doctor B tries to access Doctor A's staff directly -> 404
    get_b = client.get(f"/api/v1/staff/{staff_id}", headers=headers_b)
    assert get_b.status_code == 404


def test_summary_metrics(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # Add staff
    client.post(
        "/api/v1/staff",
        json={"full_name": "Dr. Specialist", "phone": "+919876577771", "role": "Doctor", "department": "Cardiology"},
        headers=headers,
    )
    client.post(
        "/api/v1/staff",
        json={"full_name": "Nurse Staff", "phone": "+919876577772", "role": "Nurse", "department": "Nursing"},
        headers=headers,
    )

    summary_res = client.get("/api/v1/staff/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_staff"] == 2
    assert summary["active_staff"] == 2
    assert summary["doctors_count"] == 1
    assert summary["departments_count"] == 2


def test_staff_phone_and_email_validation(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # 1. Reject invalid phone with letters
    res_bad_phone1 = client.post(
        "/api/v1/staff",
        json={"full_name": "Test User", "phone": "invalid_phone", "role": "Receptionist"},
        headers=headers,
    )
    assert res_bad_phone1.status_code == 422

    # 2. Reject phone with too few digits (< 7)
    res_bad_phone2 = client.post(
        "/api/v1/staff",
        json={"full_name": "Test User", "phone": "12345", "role": "Receptionist"},
        headers=headers,
    )
    assert res_bad_phone2.status_code == 422

    # 3. Reject invalid email format
    res_bad_email = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Test User",
            "phone": "+91 98765 43210",
            "email": "not-an-email-at-all",
            "role": "Receptionist",
        },
        headers=headers,
    )
    assert res_bad_email.status_code == 422

    # 4. Accept valid phone and email
    res_valid = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Valid Member",
            "phone": "+91 98765 43210",
            "email": "valid.staff@clinic.com",
            "role": "Receptionist",
        },
        headers=headers,
    )
    assert res_valid.status_code == 201
    staff_id = res_valid.json()["id"]

    # 5. Reject update with invalid phone
    res_bad_update_phone = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"phone": "bad-phone-xyz"},
        headers=headers,
    )
    assert res_bad_update_phone.status_code == 422

    # 6. Reject update with invalid email
    res_bad_update_email = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"email": "bad-email@"},
        headers=headers,
    )
    assert res_bad_update_email.status_code == 422


def test_staff_username_at_symbol_normalization(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # Sending username with leading @ should be cleanly normalized
    res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Prefix Test",
            "phone": "+91 98765 43210",
            "role": "Receptionist",
            "username": "@prefix.user",
        },
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["username"] == "prefix.user"


def test_staff_update_email_collision_prevented(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # Create Staff 1 with can_login=True and email
    res1 = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Staff One",
            "phone": "+91 98765 11111",
            "role": "Receptionist",
            "email": "staff.one@clinic.com",
            "can_login": True,
            "password": "Password@123",
        },
        headers=headers,
    )
    assert res1.status_code == 201

    # Create Staff 2 with can_login=True and different email
    res2 = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Staff Two",
            "phone": "+91 98765 22222",
            "role": "Nurse",
            "email": "staff.two@clinic.com",
            "can_login": True,
            "password": "Password@123",
        },
        headers=headers,
    )
    assert res2.status_code == 201
    staff2_id = res2.json()["id"]

    # Updating Staff 2's email to Staff 1's email must be rejected with 400
    res_collide = client.put(
        f"/api/v1/staff/{staff2_id}",
        json={"email": "staff.one@clinic.com"},
        headers=headers,
    )
    assert res_collide.status_code == 400
    assert "already exists" in res_collide.json()["detail"]


def test_staff_doctor_speciality_creation_and_update(client, test_doctor_and_auth):
    _, headers = test_doctor_and_auth

    # 1. Create Doctor with explicit speciality
    res_doc = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Aarav Mehta",
            "phone": "+91 98765 77777",
            "role": "Doctor",
            "speciality": "Cardiologist",
        },
        headers=headers,
    )
    assert res_doc.status_code == 201
    doc_data = res_doc.json()
    assert doc_data["speciality"] == "Cardiologist"
    doc_id = doc_data["id"]

    # 2. Update Doctor's speciality
    res_update = client.put(
        f"/api/v1/staff/{doc_id}",
        json={"speciality": "Neurologist"},
        headers=headers,
    )
    assert res_update.status_code == 200
    assert res_update.json()["speciality"] == "Neurologist"

    # 3. Create Doctor without speciality -> defaults to General Physician
    res_default = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Maya Sen",
            "phone": "+91 98765 88888",
            "role": "Junior Doctor",
        },
        headers=headers,
    )
    assert res_default.status_code == 201
    assert res_default.json()["speciality"] == "General Physician"

    # 4. Create non-doctor -> speciality is None
    res_nurse = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Nurse Sunita",
            "phone": "+91 98765 99999",
            "role": "Nurse",
        },
        headers=headers,
    )
    assert res_nurse.status_code == 201
    assert res_nurse.json()["speciality"] is None

    # 5. Role downgrade: change doctor to receptionist -> speciality cleared
    res_downgrade = client.put(
        f"/api/v1/staff/{doc_id}",
        json={"role": "Receptionist"},
        headers=headers,
    )
    assert res_downgrade.status_code == 200
    assert res_downgrade.json()["role"] == "Receptionist"
    assert res_downgrade.json()["speciality"] is None


def test_delete_staff_with_active_appointments_blocked(client, test_doctor_and_auth, db_session):
    """Test (#26): Cannot delete a staff member who has active (BOOKED) appointments."""
    doctor, headers = test_doctor_and_auth

    # 1. Create a staff doctor
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Ananya Roy",
            "phone": "+91 98765 11122",
            "role": "Doctor",
            "speciality": "Pediatrician",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    staff_id = uuid.UUID(create_res.json()["id"])

    # 2. Add an active appointment for this staff doctor
    appt = Appointment(
        doctor_id=doctor.id,
        staff_id=staff_id,
        patient_name="Baby John",
        date=date(2026, 12, 1),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status="BOOKED",
    )
    db_session.add(appt)
    db_session.commit()

    # 3. Attempt to delete the staff doctor -> must be rejected with 400
    del_res = client.delete(f"/api/v1/staff/{staff_id}", headers=headers)
    assert del_res.status_code == 400
    assert "active appointment" in del_res.json()["detail"].lower()
    assert "reassign" in del_res.json()["detail"].lower()

    # Verify staff still exists
    get_res = client.get(f"/api/v1/staff/{staff_id}", headers=headers)
    assert get_res.status_code == 200


def test_delete_staff_with_completed_appointments_blocked(client, test_doctor_and_auth, db_session):
    """Test (#26): Cannot delete a staff member who has completed consultations to preserve clinical records."""
    doctor, headers = test_doctor_and_auth

    # 1. Create a staff doctor
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Vikram Seth",
            "phone": "+91 98765 33344",
            "role": "Doctor",
            "speciality": "Cardiologist",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    staff_id = uuid.UUID(create_res.json()["id"])

    # 2. Add a completed appointment for this staff doctor
    appt = Appointment(
        doctor_id=doctor.id,
        staff_id=staff_id,
        patient_name="Senior Patient",
        date=date(2026, 11, 1),
        start_time=time(11, 0),
        end_time=time(11, 30),
        status="COMPLETED",
    )
    db_session.add(appt)
    db_session.commit()

    # 3. Attempt to delete -> must be rejected with 400
    del_res = client.delete(f"/api/v1/staff/{staff_id}", headers=headers)
    assert del_res.status_code == 400
    assert "completed consultation record" in del_res.json()["detail"].lower()
    assert "inactive" in del_res.json()["detail"].lower()

    # 4. Deactivating (setting status to inactive) succeeds
    update_res = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"status": "inactive"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "inactive"


def test_delete_staff_after_cancellation_or_no_appointments_succeeds(client, test_doctor_and_auth, db_session):
    """Test (#26): Deleting a staff doctor with only cancelled appointments (or 0 appointments) succeeds."""
    doctor, headers = test_doctor_and_auth

    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Temp Doctor",
            "phone": "+91 98765 55566",
            "role": "Doctor",
            "speciality": "General Physician",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    staff_id = uuid.UUID(create_res.json()["id"])

    # Add a cancelled appointment
    appt = Appointment(
        doctor_id=doctor.id,
        staff_id=staff_id,
        patient_name="Cancelled Patient",
        date=date(2026, 12, 10),
        start_time=time(9, 0),
        end_time=time(9, 30),
        status="CANCELLED",
    )
    db_session.add(appt)
    db_session.commit()

    # Delete succeeds with 204
    del_res = client.delete(f"/api/v1/staff/{staff_id}", headers=headers)
    assert del_res.status_code == 204


def test_clinic_owner_sees_compensation_and_notes(client, test_doctor_and_auth):
    """Test (#33): Clinic owner can view compensation, emergency contact, and notes."""
    _, headers = test_doctor_and_auth

    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Dr. Confidential Staff",
            "phone": "+91 98765 77788",
            "role": "Doctor",
            "speciality": "Cardiologist",
            "base_salary_paise": 9500000,
            "emergency_contact": "Spouse (+919876500011)",
            "notes": "Highly confidential HR evaluation notes",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    staff_id = create_res.json()["id"]

    # Owner GET list -> fields are present
    list_res = client.get("/api/v1/staff", headers=headers)
    assert list_res.status_code == 200
    target = next((s for s in list_res.json() if s["id"] == staff_id), None)
    assert target is not None
    assert target["base_salary_paise"] == 9500000
    assert target["emergency_contact"] == "Spouse (+919876500011)"
    assert target["notes"] == "Highly confidential HR evaluation notes"

    # Owner GET single -> fields are present
    single_res = client.get(f"/api/v1/staff/{staff_id}", headers=headers)
    assert single_res.status_code == 200
    data = single_res.json()
    assert data["base_salary_paise"] == 9500000
    assert data["emergency_contact"] == "Spouse (+919876500011)"
    assert data["notes"] == "Highly confidential HR evaluation notes"
