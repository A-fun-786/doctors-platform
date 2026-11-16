import uuid
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
