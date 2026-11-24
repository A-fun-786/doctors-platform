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

    # 1. can_login=True without email now succeeds and assigns auto-generated User ID
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
    assert res1.status_code == 201
    staff_data = res1.json()
    assert staff_data["username"] == "john.doe"
    assert staff_data["email"] is None

    # Staff can log in using their auto-generated User ID and password
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "john.doe",
            "password": "ValidPassword123",
            "portal_type": "staff",
        },
    )
    assert login_res.status_code == 200
    assert login_res.json()["doctor"]["username"] == "john.doe"

    # 2. can_login=True without password must fail
    res2 = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "+91 99999 00001",
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
    nurse_username = create_res.json()["username"]

    # 2. Attempt login using @nurse_username -> Rejected (Staff must use exact User ID without @)
    at_login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": f"@{nurse_username}",
            "password": "NursePassword123!",
            "portal_type": "staff",
        },
    )
    assert at_login_res.status_code == 422
    assert "invalid user id or password" in str(at_login_res.json()).lower()

    # 3. Authenticate Nurse via /api/v1/auth/login using exact User ID
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": nurse_username,
            "password": "NursePassword123!",
            "portal_type": "staff",
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
    rohan_user = create_res.json()["username"]

    # Test wrong password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": rohan_user, "password": "WrongPassword!", "portal_type": "staff"},
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
        json={"email": rohan_user, "password": "RohanSecretPassword123!", "portal_type": "staff"},
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
    rahul_user = create_res.json()["username"]

    # Log in as Rahul
    auth_res = client.post(
        "/api/v1/auth/login",
        json={"email": rahul_user, "password": "JuniorPassword123!", "portal_type": "staff"},
    )
    assert auth_res.json()["doctor"]["must_change_password"] is True
    initial_staff_token = auth_res.json()["access_token"]
    initial_staff_headers = {"Authorization": f"Bearer {initial_staff_token}"}

    # Before changing password, accessing clinic roster is blocked with 403 (Issue #37)
    blocked_res = client.get("/api/v1/staff", headers=initial_staff_headers)
    assert blocked_res.status_code == 403
    assert "Password change required" in blocked_res.json()["detail"]

    # Rahul performs mandatory self-service password change
    cp_res = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "JuniorPassword123!", "new_password": "RahulNewPassword456!"},
        headers=initial_staff_headers,
    )
    assert cp_res.status_code == 200
    assert cp_res.json()["doctor"]["must_change_password"] is False
    staff_token = cp_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Staff CAN read clinic roster once password is changed, but sensitive compensation and personal data are masked (#33)
    list_res = client.get("/api/v1/staff", headers=staff_headers)
    assert list_res.status_code == 200
    roster = list_res.json()
    assert len(roster) > 0
    for member in roster:
        assert member["base_salary_paise"] is None
        assert member["emergency_contact"] is None
        assert member["notes"] is None

    # Individual staff get is also masked for staff accounts (#33)
    single_res = client.get(f"/api/v1/staff/{staff_id}", headers=staff_headers)
    assert single_res.status_code == 200
    assert single_res.json()["base_salary_paise"] is None
    assert single_res.json()["emergency_contact"] is None
    assert single_res.json()["notes"] is None

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
    amina_user = create_res.json()["username"]

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
        json={"email": amina_user, "password": "NewFreshPassword456!", "portal_type": "staff"},
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()

    # Old password no longer works
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": amina_user, "password": "OldPassword123!", "portal_type": "staff"},
    )
    assert old_login.status_code == 401


def test_portal_type_strict_enforcement(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # 1. Create Staff
    create_res = client.post(
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
    assert create_res.status_code == 201
    maya_username = create_res.json()["username"]

    # 2. Staff tries to log in via "admin" portal using email -> Unregistered doctor email returns 401
    staff_on_admin = client.post(
        "/api/v1/auth/login",
        json={
            "email": "maya.nurse@example.com",
            "password": "MayaPassword123!",
            "portal_type": "admin",
        },
    )
    assert staff_on_admin.status_code in (401, 403)

    # 3. Staff tries to log in via "staff" portal using email -> Rejected with 422 (Staff requires User ID)
    staff_email_rejected = client.post(
        "/api/v1/auth/login",
        json={
            "email": "maya.nurse@example.com",
            "password": "MayaPassword123!",
            "portal_type": "staff",
        },
    )
    assert staff_email_rejected.status_code == 422
    assert "user id" in str(staff_email_rejected.json()).lower()

    # 4. Staff logs in via "staff" portal using User ID -> Success 200
    staff_on_staff = client.post(
        "/api/v1/auth/login",
        json={
            "email": maya_username,
            "password": "MayaPassword123!",
            "portal_type": "staff",
        },
    )
    assert staff_on_staff.status_code == 200

    # 5. Doctor owner tries to log in via "staff" portal using email -> Rejected with 422 (Staff requires User ID)
    doc_on_staff = client.post(
        "/api/v1/auth/login",
        json={
            "email": "clinic.head@example.com",
            "password": "DoctorPass123!",
            "portal_type": "staff",
        },
    )
    assert doc_on_staff.status_code == 422
    assert "user id" in str(doc_on_staff.json()).lower()

    # 6. Doctor owner logs in via "admin" portal -> Success 200
    doc_on_admin = client.post(
        "/api/v1/auth/login",
        json={
            "email": "clinic.head@example.com",
            "password": "DoctorPass123!",
            "portal_type": "admin",
        },
    )
    assert doc_on_admin.status_code == 200


def test_staff_username_candidate_generator():
    from app.services.staff_service import generate_username_candidates

    # Dr. John Doe
    candidates = generate_username_candidates("Dr. John Doe")
    assert candidates[0] == "john.doe"
    assert candidates[1] == "j.doe"
    assert candidates[2] == "john.d"
    assert candidates[3] == "johndoe"
    assert "j1.doe" in candidates
    assert "john.d1" in candidates

    # Single name
    single_candidates = generate_username_candidates("Rita")
    assert single_candidates[0] == "rita"
    assert single_candidates[1] == "rita1"
    assert single_candidates[2] == "rita2"


def test_staff_username_collision_resolution(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # Create 8 staff members all named "John Doe"
    created_usernames = []
    for i in range(8):
        res = client.post(
            "/api/v1/staff",
            json={
                "full_name": "John Doe",
                "phone": f"+91 99999 {10000 + i}",
                "role": "Doctor",
                "can_login": True,
                "password": "ValidPassword123!",
            },
            headers=doc_headers,
        )
        assert res.status_code == 201, res.json()
        created_usernames.append(res.json()["username"])

    # Verify priority sequence: natural names first, then minimal numbers
    assert created_usernames[0] == "john.doe"
    assert created_usernames[1] == "j.doe"
    assert created_usernames[2] == "john.d"
    assert created_usernames[3] == "johndoe"
    assert created_usernames[4] == "jdoe"
    assert created_usernames[5] == "johnd"
    assert created_usernames[6] == "j1.doe"
    assert created_usernames[7] == "john.d1"

    # All generated usernames are unique
    assert len(set(created_usernames)) == 8


def test_custom_username_validation_and_collision(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # 1. Custom valid username
    res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Alice Wonderland",
            "username": "alice.w",
            "phone": "+91 88888 11111",
            "role": "Nurse",
            "can_login": True,
            "password": "Password123!",
        },
        headers=doc_headers,
    )
    assert res.status_code == 201
    assert res.json()["username"] == "alice.w"

    # 2. Collision with existing custom username
    res_dup = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Alice Williams",
            "username": "alice.w",
            "phone": "+91 88888 22222",
            "role": "Nurse",
            "can_login": True,
            "password": "Password123!",
        },
        headers=doc_headers,
    )
    assert res_dup.status_code == 400
    assert "user id already exists" in res_dup.json()["detail"].lower()

    # 3. Invalid characters rejected at schema validation layer
    res_invalid = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Bob Builder",
            "username": "bob@builder!",
            "phone": "+91 88888 33333",
            "role": "Pharmacist",
        },
        headers=doc_headers,
    )
    assert res_invalid.status_code == 422


def test_token_version_invalidation_on_password_reset(client, doctor_fixture):
    doctor, doc_headers = doctor_fixture

    # 1. Create staff
    staff_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Karan Sharma",
            "phone": "+91 77777 11111",
            "role": "Receptionist",
            "can_login": True,
            "password": "InitialPass123!",
        },
        headers=doc_headers,
    )
    staff_id = staff_res.json()["id"]
    username = staff_res.json()["username"]

    # 2. Staff logs in with User ID
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": username,
            "password": "InitialPass123!",
            "portal_type": "staff",
        },
    )
    assert login_res.status_code == 200
    initial_token = login_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {initial_token}"}

    # 3. /me succeeds with initial token
    me_res = client.get("/api/v1/auth/me", headers=staff_headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == username

    # 4. Admin resets staff password
    reset_res = client.post(
        f"/api/v1/staff/{staff_id}/reset-password",
        json={"new_password": "NewSecretPass456!"},
        headers=doc_headers,
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["token_version"] == 2

    # 5. Old token is immediately revoked
    revoked_me = client.get("/api/v1/auth/me", headers=staff_headers)
    assert revoked_me.status_code == 401
    assert "credentials have changed" in revoked_me.json()["detail"].lower()

    # 6. Logging in with new password succeeds and works
    new_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": username,
            "password": "NewSecretPass456!",
            "portal_type": "staff",
        },
    )
    assert new_login.status_code == 200
    new_token = new_login.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    me_again = client.get("/api/v1/auth/me", headers=new_headers)
    assert me_again.status_code == 200


def test_staff_token_without_token_version_claim_rejected(client, doctor_fixture, db_session):
    """
    Issue #34: Staff tokens without token_version claim must be rejected with 401.
    Prevents pre-revocation legacy or stripped tokens from bypassing session invalidation.
    """
    doctor, doc_headers = doctor_fixture

    # 1. Create staff member
    staff_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Aman Verma",
            "phone": "+91 98888 22222",
            "role": "Receptionist",
            "can_login": True,
            "password": "SecurePass123!",
        },
        headers=doc_headers,
    )
    assert staff_res.status_code == 201
    staff_id = staff_res.json()["id"]

    # 2. Mint token with user_type='staff' but OMIT token_version claim
    stripped_token = create_access_token(
        subject=staff_id,
        claims={
            "doctor_id": str(doctor.id),
            "user_type": "staff",
            "role": "Receptionist",
            "staff_id": staff_id,
            # token_version intentionally omitted
        },
    )
    stripped_headers = {"Authorization": f"Bearer {stripped_token}"}

    # 3. Access must be rejected with 401
    res = client.get("/api/v1/auth/me", headers=stripped_headers)
    assert res.status_code == 401
    assert "credentials have changed" in res.json()["detail"].lower()

    # 4. Mint token with explicit token_version=None
    null_token = create_access_token(
        subject=staff_id,
        claims={
            "doctor_id": str(doctor.id),
            "user_type": "staff",
            "role": "Receptionist",
            "staff_id": staff_id,
            "token_version": None,
        },
    )
    null_headers = {"Authorization": f"Bearer {null_token}"}

    res_null = client.get("/api/v1/auth/me", headers=null_headers)
    assert res_null.status_code == 401
    assert "credentials have changed" in res_null.json()["detail"].lower()

    # 5. Mint token with valid matching token_version=1
    valid_token = create_access_token(
        subject=staff_id,
        claims={
            "doctor_id": str(doctor.id),
            "user_type": "staff",
            "role": "Receptionist",
            "staff_id": staff_id,
            "token_version": 1,
        },
    )
    valid_headers = {"Authorization": f"Bearer {valid_token}"}

    res_valid = client.get("/api/v1/auth/me", headers=valid_headers)
    assert res_valid.status_code == 200
    assert res_valid.json()["id"] == staff_id


def test_staff_case_insensitive_login_resolution(client, doctor_fixture, db_session):
    """
    Issue #35: Staff login by User ID (with or without leading @) or email
    must resolve uniquely and case-insensitively.
    """
    doctor, doc_headers = doctor_fixture

    # 1. Create staff with User ID @PoojaShah and email Pooja.Shah@Clinic.com
    staff_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Pooja Shah",
            "phone": "+91 97777 33333",
            "role": "Receptionist",
            "username": "@PoojaShah",
            "email": "Pooja.Shah@Clinic.com",
            "can_login": True,
            "password": "LoginSecret123!",
        },
        headers=doc_headers,
    )
    assert staff_res.status_code == 201
    staff_id = staff_res.json()["id"]

    # 2. Login using @poojashah -> Rejected (must NOT use @)
    login1 = client.post(
        "/api/v1/auth/login",
        json={
            "email": "@poojashah",
            "password": "LoginSecret123!",
            "portal_type": "staff",
        },
    )
    assert login1.status_code == 422
    assert "invalid user id or password" in str(login1.json()).lower()

    # 3. Login using poojashah (exact lowercase)
    login2 = client.post(
        "/api/v1/auth/login",
        json={
            "email": "poojashah",
            "password": "LoginSecret123!",
            "portal_type": "staff",
        },
    )
    assert login2.status_code == 200
    assert login2.json()["doctor"]["id"] == staff_id

    # 4. Login using POOJASHAH (uppercase without @)
    login3 = client.post(
        "/api/v1/auth/login",
        json={
            "email": "POOJASHAH",
            "password": "LoginSecret123!",
            "portal_type": "staff",
        },
    )
    assert login3.status_code == 200
    assert login3.json()["doctor"]["id"] == staff_id

    # 5. Attempt login using email pooja.shah@clinic.com on Staff portal -> Rejected (Staff must use User ID)
    login4 = client.post(
        "/api/v1/auth/login",
        json={
            "email": "pooja.shah@clinic.com",
            "password": "LoginSecret123!",
            "portal_type": "staff",
        },
    )
    assert login4.status_code == 422
    assert "user id" in str(login4.json()).lower()

    # 6. Login using mixed-case User ID PoojaShah (without @)
    login5 = client.post(
        "/api/v1/auth/login",
        json={
            "email": "PoojaShah",
            "password": "LoginSecret123!",
            "portal_type": "staff",
        },
    )
    assert login5.status_code == 200
    assert login5.json()["doctor"]["id"] == staff_id


def test_must_change_password_enforcement_and_clearance(client, doctor_fixture):
    """
    Test Issue #37:
    1. Provisioning sets must_change_password=True.
    2. Login returns must_change_password=True.
    3. Accessing protected non-auth routes returns 403 Forbidden.
    4. Accessing /auth/me succeeds.
    5. Self-service password change validates current password and strength.
    6. Successful password change clears must_change_password to False and increments token_version.
    7. Old session token is invalidated.
    8. New session token can access all protected routes cleanly.
    """
    doctor, doc_headers = doctor_fixture

    # 1. Provision staff member with initial password
    prov_res = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Nurse Maya Roy",
            "email": "maya.roy@hospital.com",
            "phone": "+91 98765 11111",
            "role": "Nurse",
            "can_login": True,
            "password": "TempPass@123",
        },
        headers=doc_headers,
    )
    assert prov_res.status_code == 201
    maya_user = prov_res.json()["username"]

    # 2. Login as Maya Roy
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": maya_user, "password": "TempPass@123", "portal_type": "staff"},
    )
    assert login_res.status_code == 200
    auth_data = login_res.json()
    assert auth_data["doctor"]["must_change_password"] is True
    temp_token = auth_data["access_token"]
    temp_headers = {"Authorization": f"Bearer {temp_token}"}

    # 3. Accessing /auth/me succeeds even with must_change_password=True
    me_res = client.get("/api/v1/auth/me", headers=temp_headers)
    assert me_res.status_code == 200
    assert me_res.json()["must_change_password"] is True

    # 4. Accessing protected non-auth routes is blocked with 403
    blocked_res = client.get("/api/v1/staff", headers=temp_headers)
    assert blocked_res.status_code == 403
    assert "Password change required" in blocked_res.json()["detail"]

    # 5. Password change with wrong current password fails
    wrong_curr = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewSecretPass@456"},
        headers=temp_headers,
    )
    assert wrong_curr.status_code == 400
    assert "Current password is incorrect" in wrong_curr.json()["detail"]

    # 6. Password change with same password fails
    same_pass = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "TempPass@123", "new_password": "TempPass@123"},
        headers=temp_headers,
    )
    assert same_pass.status_code == 400
    assert "cannot be the same" in same_pass.json()["detail"]

    # 7. Password change with short new password fails (schema validator)
    short_pass = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "TempPass@123", "new_password": "123"},
        headers=temp_headers,
    )
    assert short_pass.status_code == 422

    # 8. Successful password change
    change_res = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "TempPass@123", "new_password": "MayaPrivatePass@789"},
        headers=temp_headers,
    )
    assert change_res.status_code == 200
    new_auth = change_res.json()
    assert new_auth["doctor"]["must_change_password"] is False
    new_token = new_auth["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # 9. Old token is immediately invalidated (token_version incremented)
    old_token_res = client.get("/api/v1/auth/me", headers=temp_headers)
    assert old_token_res.status_code == 401
    assert "Credentials have changed" in old_token_res.json()["detail"]

    # 10. New token can access protected routes cleanly
    unblocked_res = client.get("/api/v1/staff", headers=new_headers)
    assert unblocked_res.status_code == 200

    # 11. Subsequent login with old password fails
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": maya_user, "password": "TempPass@123", "portal_type": "staff"},
    )
    assert old_login.status_code == 401

    # 12. Login with new password succeeds and must_change_password is False
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": maya_user, "password": "MayaPrivatePass@789", "portal_type": "staff"},
    )
    assert new_login.status_code == 200
    assert new_login.json()["doctor"]["must_change_password"] is False




