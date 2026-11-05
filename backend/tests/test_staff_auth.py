import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
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
def doctor_fixture(db_session):
    doctor = Doctor(
        id=uuid.uuid4(),
        email="clinic.head@example.com",
        full_name="Dr. Sameer Clinic Head",
        phone="+919876543210",
        speciality="General Medicine",
        is_active=True,
        hashed_password=hash_password("DoctorPass123!"),
    )
    db_session.add(doctor)
    db_session.flush()

    tenant = Tenant(
        doctor_id=doctor.id,
        clinic_name="LifeCare Clinic",
        slug="lifecare-clinic",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(doctor)

    token = create_access_token(
        subject=str(doctor.id),
        claims={"doctor_id": str(doctor.id), "role": "Doctor", "user_type": "doctor"},
    )
    headers = {"Authorization": f"Bearer {token}"}
    return doctor, headers


def test_create_staff_with_login_credentials(client, doctor_fixture, db_session):
    doctor, headers = doctor_fixture

    payload = {
        "full_name": "Priya Sharma",
        "email": "priya.nurse@example.com",
        "phone": "+91 98765 11111",
        "role": "Nurse",
        "department": "Nursing",
        "can_login": True,
        "password": "SecurePassword123!",
    }

    response = client.post("/api/v1/staff", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Priya Sharma"
    assert data["can_login"] is True
    assert data["must_change_password"] is True
    # Sensitive hashed_password must never be returned in API response
    assert "password" not in data
    assert "hashed_password" not in data

    # Verify staff was created in DB with hashed password
    staff_db = db_session.query(StaffMember).filter(StaffMember.email == "priya.nurse@example.com").first()
    assert staff_db is not None
    assert staff_db.can_login is True
    assert staff_db.hashed_password is not None
    assert staff_db.hashed_password != "SecurePassword123!"


def test_create_staff_login_validation_failures(client, doctor_fixture):
    doctor, headers = doctor_fixture

    # 1. can_login=True without email must fail
    res1 = client.post(
        "/api/v1/staff",
        json={
            "full_name": "John Doe",
            "phone": "+91 99999 00000",
            "role": "Receptionist",
            "can_login": True,
            "password": "ValidPassword123",
        },
        headers=headers,
    )
    assert res1.status_code == 400
    assert "email is required" in res1.json()["detail"].lower()

    # 2. can_login=True without password must fail
    res2 = client.post(
        "/api/v1/staff",
        json={
            "full_name": "John Doe",
            "email": "john@example.com",
            "phone": "+91 99999 00000",
            "role": "Receptionist",
            "can_login": True,
        },
        headers=headers,
    )
    assert res2.status_code == 400
    assert "password" in res2.json()["detail"].lower()


def test_staff_login_and_me_endpoint(client, doctor_fixture, db_session):
    doctor, doc_headers = doctor_fixture

    # 1. Provision a Nurse with login
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Nurse Sunita",
            "email": "sunita.nurse@example.com",
            "phone": "+91 98765 22222",
            "role": "Nurse",
            "department": "Triage",
            "can_login": True,
            "password": "NursePassword123!",
        },
        headers=doc_headers,
    )
    assert create_res.status_code == 201

    # 2. Authenticate Nurse via unified /api/v1/auth/login
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "sunita.nurse@example.com",
            "password": "NursePassword123!",
        },
    )
    assert login_res.status_code == 200
    auth_data = login_res.json()
    assert "access_token" in auth_data
    assert auth_data["doctor"]["full_name"] == "Nurse Sunita"
    assert auth_data["doctor"]["user_type"] == "staff"
    assert auth_data["doctor"]["role"] == "Nurse"
    assert auth_data["tenant"]["slug"] == "lifecare-clinic"

    nurse_token = auth_data["access_token"]
    nurse_headers = {"Authorization": f"Bearer {nurse_token}"}

    # 3. Call /api/v1/auth/me with Nurse token
    me_res = client.get("/api/v1/auth/me", headers=nurse_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["full_name"] == "Nurse Sunita"
    assert me_data["user_type"] == "staff"
    assert me_data["role"] == "Nurse"
    assert me_data["can_manage_staff"] is False
    assert me_data["must_change_password"] is True
    assert me_data["tenant"]["slug"] == "lifecare-clinic"


def test_staff_login_wrong_password_and_inactive(client, doctor_fixture, db_session):
    doctor, doc_headers = doctor_fixture

    # Provision Receptionist
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Rohan FrontDesk",
            "email": "rohan.frontdesk@example.com",
            "phone": "+91 98765 33333",
            "role": "Receptionist",
            "can_login": True,
            "password": "RohanSecretPassword123!",
        },
        headers=doc_headers,
    )
    assert create_res.status_code == 201
    staff_id = create_res.json()["id"]

    # Test wrong password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "rohan.frontdesk@example.com", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # Deactivate staff member
    update_res = client.put(
        f"/api/v1/staff/{staff_id}",
        json={"status": "inactive"},
        headers=doc_headers,
    )
    assert update_res.status_code == 200

    # Inactive staff login must be rejected
    inactive_login = client.post(
        "/api/v1/auth/login",
        json={"email": "rohan.frontdesk@example.com", "password": "RohanSecretPassword123!"},
    )
    assert inactive_login.status_code == 401
    assert "inactive" in inactive_login.json()["detail"].lower()


def test_staff_cannot_perform_admin_mutations(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # Provision Staff
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Junior Dr. Rahul",
            "email": "rahul.jr@example.com",
            "phone": "+91 98765 44444",
            "role": "Junior Doctor",
            "can_login": True,
            "password": "JuniorPassword123!",
        },
        headers=doc_headers,
    )
    assert create_res.status_code == 201
    staff_id = create_res.json()["id"]

    # Log in as Rahul
    auth_res = client.post(
        "/api/v1/auth/login",
        json={"email": "rahul.jr@example.com", "password": "JuniorPassword123!"},
    )
    staff_token = auth_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Staff CAN read clinic roster
    list_res = client.get("/api/v1/staff", headers=staff_headers)
    assert list_res.status_code == 200

    # Staff CANNOT create staff (forbidden 403)
    post_res = client.post(
        "/api/v1/staff",
        json={"full_name": "Hacker", "phone": "123", "role": "Nurse"},
        headers=staff_headers,
    )
    assert post_res.status_code == 403
    assert "restricted to clinic administrator" in post_res.json()["detail"].lower()

    # Staff CANNOT delete staff (forbidden 403)
    del_res = client.delete(f"/api/v1/staff/{staff_id}", headers=staff_headers)
    assert del_res.status_code == 403

    # Staff CANNOT update clinic profile (forbidden 403)
    profile_res = client.put(
        "/api/v1/doctor/profile",
        json={"clinic_name": "Hacked Clinic Name"},
        headers=staff_headers,
    )
    assert profile_res.status_code == 403

    # Staff CANNOT trigger Android app compilation (forbidden 403)
    build_res = client.post("/api/v1/doctor/app/build", headers=staff_headers)
    assert build_res.status_code == 403


def test_doctor_admin_reset_staff_password(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # Create Staff
    create_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Amina Reception",
            "email": "amina.reception@example.com",
            "phone": "+91 98765 55555",
            "role": "Receptionist",
            "can_login": True,
            "password": "OldPassword123!",
        },
        headers=doc_headers,
    )
    staff_id = create_res.json()["id"]

    # Admin Doctor resets Amina's password
    reset_res = client.post(
        f"/api/v1/staff/{staff_id}/reset-password",
        json={"new_password": "NewFreshPassword456!"},
        headers=doc_headers,
    )
    assert reset_res.status_code == 200

    # Amina can now log in with the new password
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "amina.reception@example.com", "password": "NewFreshPassword456!"},
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()

    # Old password no longer works
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "amina.reception@example.com", "password": "OldPassword123!"},
    )
    assert old_login.status_code == 401


def test_portal_type_strict_enforcement(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # 1. Create Staff
    client.post(
        "/api/v1/staff",
        json={
            "full_name": "Nurse Maya",
            "email": "maya.nurse@example.com",
            "phone": "+91 98765 66666",
            "role": "Nurse",
            "can_login": True,
            "password": "MayaPassword123!",
        },
        headers=doc_headers,
    )

    # 2. Staff tries to log in via "admin" portal -> Rejected with 403
    staff_on_admin = client.post(
        "/api/v1/auth/login",
        json={
            "email": "maya.nurse@example.com",
            "password": "MayaPassword123!",
            "portal_type": "admin",
        },
    )
    assert staff_on_admin.status_code == 403
    assert "switch to the 'staff' tab" in staff_on_admin.json()["detail"].lower()

    # 3. Staff logs in via "staff" portal -> Success 200
    staff_on_staff = client.post(
        "/api/v1/auth/login",
        json={
            "email": "maya.nurse@example.com",
            "password": "MayaPassword123!",
            "portal_type": "staff",
        },
    )
    assert staff_on_staff.status_code == 200

    # 4. Doctor owner tries to log in via "staff" portal -> Rejected with 403
    doc_on_staff = client.post(
        "/api/v1/auth/login",
        json={
            "email": "clinic.head@example.com",
            "password": "DoctorPass123!",
            "portal_type": "staff",
        },
    )
    assert doc_on_staff.status_code == 403
    assert "switch to the 'admin' tab" in doc_on_staff.json()["detail"].lower()

    # 5. Doctor owner logs in via "admin" portal -> Success 200
    doc_on_admin = client.post(
        "/api/v1/auth/login",
        json={
            "email": "clinic.head@example.com",
            "password": "DoctorPass123!",
            "portal_type": "admin",
        },
    )
    assert doc_on_admin.status_code == 200

