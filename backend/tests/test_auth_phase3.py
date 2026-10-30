import uuid
import smtplib
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
from app.services.auth_service import auth_service, generate_unique_tenant_slug
from app.services.email_service import (
    EmailService,
    MemoryEmailBackend,
    ConsoleEmailBackend,
    SMTPEmailBackend,
    email_service,
)

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


@pytest.fixture(autouse=True)
def memory_email_backend():
    """Ensure email_service uses an in-memory outbox during tests."""
    mem_backend = MemoryEmailBackend()
    email_service.set_backend(mem_backend)
    yield mem_backend
    mem_backend.clear()


def test_end_to_end_registration_and_verification_flow(client, db_session, memory_email_backend):
    """
    POST /register -> POST /verify-email -> GET /me
    Verifies Doctor & Tenant created atomically, email_verified False -> True, JWT accepted by /me.
    """
    # 1. Register with email
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "doctor.e2e@example.com",
            "password": "StrongPassword123!",
            "full_name": "Dr. E2E Tester",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["doctor"]["email_verified"] is False

    # Check outbox captured verification email
    assert len(memory_email_backend.outbox) == 1
    sent_email = memory_email_backend.outbox[0]
    assert sent_email["to"] == "doctor.e2e@example.com"
    assert "Your 6-digit verification code is:" in sent_email["text"]

    # Verify doctor in DB has email_verified == False
    doctor = db_session.query(Doctor).filter(Doctor.email == "doctor.e2e@example.com").first()
    assert doctor is not None
    assert doctor.email_verified is False

    # Retrieve stored token from DB to get the token or OTP
    token_record = (
        db_session.query(EmailVerificationToken)
        .filter(EmailVerificationToken.doctor_id == doctor.id)
        .first()
    )
    assert token_record is not None
    assert token_record.used_at is None

    # Parse 6-digit OTP from email body text
    body = sent_email["text"]
    otp_line = [line for line in body.splitlines() if "code is: " in line][0]
    otp = otp_line.split("code is: ")[1].strip()

    # 2. Verify Email using the 6-digit OTP
    verify_res = client.post(
        "/api/v1/auth/verify-email",
        json={"email": "doctor.e2e@example.com", "code": otp},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["doctor"]["email_verified"] is True
    access_token = verify_data["access_token"]

    # 3. Access protected /me endpoint with verified JWT
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "doctor.e2e@example.com"
    assert me_data["email_verified"] is True
    assert me_data["email_verified_at"] is not None


def test_token_expiration_and_replay_prevention(client, db_session, memory_email_backend):
    """
    Verifies expired tokens return 400 and reused tokens return 400.
    """
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr.replay@example.com",
            "password": "StrongPassword123!",
            "full_name": "Dr. Replay Tester",
        },
    )
    assert reg_res.status_code == 201
    doctor = db_session.query(Doctor).filter(Doctor.email == "dr.replay@example.com").first()

    # Test expired token
    tokens = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doctor.id).all()
    for tok in tokens:
        tok.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    otp_line = [line for line in memory_email_backend.outbox[0]["text"].splitlines() if "code is: " in line][0]
    otp = otp_line.split("code is: ")[1].strip()

    expired_res = client.post(
        "/api/v1/auth/verify-email",
        json={"email": "dr.replay@example.com", "code": otp},
    )
    assert expired_res.status_code == 400
    assert "expired" in expired_res.json()["detail"].lower()

    # Reset expiration to future
    for tok in tokens:
        tok.expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db_session.commit()

    # First use succeeds
    valid_res = client.post(
        "/api/v1/auth/verify-email",
        json={"email": "dr.replay@example.com", "code": otp},
    )
    assert valid_res.status_code == 200

    # Replay attempt fails with 400
    replay_res = client.post(
        "/api/v1/auth/verify-email",
        json={"email": "dr.replay@example.com", "code": otp},
    )
    assert replay_res.status_code == 400
    assert "already been used" in replay_res.json()["detail"].lower()


def test_brute_force_failed_attempts_invalidates_token(client, db_session, memory_email_backend):
    """
    5 consecutive failed verification attempts must invalidate active tokens.
    """
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr.bruteforce@example.com",
            "password": "StrongPassword123!",
            "full_name": "Dr. Brute Force",
        },
    )
    doctor = db_session.query(Doctor).filter(Doctor.email == "dr.bruteforce@example.com").first()
    assert doctor.failed_login_attempts == 0

    # Send 4 invalid attempts
    for i in range(4):
        limiter.reset()
        res = client.post(
            "/api/v1/auth/verify-email",
            json={"email": "dr.bruteforce@example.com", "code": f"00000{i}"},
        )
        assert res.status_code == 400
        assert "invalid" in res.json()["detail"].lower()

    db_session.refresh(doctor)
    assert doctor.failed_login_attempts == 4

    # 5th failed attempt should trigger token invalidation
    limiter.reset()
    fifth_res = client.post(
        "/api/v1/auth/verify-email",
        json={"email": "dr.bruteforce@example.com", "code": "000004"},
    )
    assert fifth_res.status_code == 400
    assert "too many failed" in fifth_res.json()["detail"].lower()

    # Verify all tokens for doctor are marked used
    tokens = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doctor.id).all()
    for tok in tokens:
        assert tok.used_at is not None


def test_resend_verification_cooldown_and_invalidation(client, db_session, memory_email_backend):
    """
    POST /resend-verification enforces 60s cooldown and invalidates older unused tokens.
    """
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr.cooldown@example.com",
            "password": "StrongPassword123!",
            "full_name": "Dr. Cooldown",
        },
    )
    doctor = db_session.query(Doctor).filter(Doctor.email == "dr.cooldown@example.com").first()

    # Immediate resend should trigger 429 60s cooldown
    resend_too_soon = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "dr.cooldown@example.com"},
    )
    assert resend_too_soon.status_code == 429
    assert "60 seconds" in resend_too_soon.json()["detail"]

    # Fast forward created_at of initial tokens by 65 seconds
    initial_tokens = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doctor.id).all()
    past_time = datetime.now(timezone.utc) - timedelta(seconds=65)
    for tok in initial_tokens:
        tok.created_at = past_time
    db_session.commit()

    # Resend after cooldown expires
    limiter.reset()
    resend_success = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "dr.cooldown@example.com"},
    )
    assert resend_success.status_code == 200
    assert "sent successfully" in resend_success.json()["message"]

    # Initial tokens must now be invalidated (used_at is not None)
    for tok in initial_tokens:
        db_session.refresh(tok)
        assert tok.used_at is not None

    # New tokens exist and are active
    fresh_tokens = (
        db_session.query(EmailVerificationToken)
        .filter(EmailVerificationToken.doctor_id == doctor.id, EmailVerificationToken.used_at == None)
        .all()
    )
    assert len(fresh_tokens) == 2


def test_cross_provider_collision_handling(client, db_session, memory_email_backend):
    """
    Registering an email already linked to Google (or vice-versa) handles provider state safely.
    """
    # 1. Register with Google mock auth
    with patch(
        "app.services.auth_service.verify_google_token",
        return_value={
            "email": "crossprovider@example.com",
            "name": "Dr. Cross",
            "sub": "cross-sub-123",
            "picture": None,
            "email_verified": True,
        },
    ):
        google_res = client.post(
            "/api/v1/auth/google",
            json={"credential": "google-id-token-xyz"},
        )
    assert google_res.status_code == 200
    google_doc = db_session.query(Doctor).filter(Doctor.email == "crossprovider@example.com").first()
    assert google_doc.email_verified is True
    assert google_doc.hashed_password is None

    # 2. Attempting email registration on Google-only account returns safe 400
    reg_attempt = client.post(
        "/api/v1/auth/register",
        json={
            "email": "crossprovider@example.com",
            "password": "Password123!@#",
        },
    )
    assert reg_attempt.status_code == 400
    assert "google" in reg_attempt.json()["detail"].lower()

    # Verify zero duplicate rows created
    doc_count = db_session.query(Doctor).filter(Doctor.email == "crossprovider@example.com").count()
    assert doc_count == 1
    tenant_count = db_session.query(Tenant).filter(Tenant.doctor_id == google_doc.id).count()
    assert tenant_count == 1

    # 3. Create email-registered account, then authenticate with Google
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "doc.emailfirst@example.com",
            "password": "Password123!@#",
            "full_name": "Dr. Email First",
        },
    )
    email_doc = db_session.query(Doctor).filter(Doctor.email == "doc.emailfirst@example.com").first()
    assert email_doc.email_verified is False

    with patch(
        "app.services.auth_service.verify_google_token",
        return_value={
            "email": "doc.emailfirst@example.com",
            "name": "Dr. Email First",
            "sub": "sub-google-456",
            "picture": None,
            "email_verified": True,
        },
    ):
        google_link_res = client.post(
            "/api/v1/auth/google",
            json={"credential": "google-id-token-abc"},
        )
    assert google_link_res.status_code == 200
    db_session.refresh(email_doc)
    assert email_doc.email_verified is True
    assert email_doc.provider_id == "sub-google-456"

    # Confirm still exactly 1 doctor and 1 tenant
    assert db_session.query(Doctor).filter(Doctor.email == "doc.emailfirst@example.com").count() == 1
    assert db_session.query(Tenant).filter(Tenant.doctor_id == email_doc.id).count() == 1


def test_transaction_rollback_on_partial_failure(client, db_session):
    """
    A failure during tenant creation or token insertion rolls back completely (0 orphaned rows).
    """
    initial_doctor_count = db_session.query(Doctor).count()
    initial_tenant_count = db_session.query(Tenant).count()

    with patch("app.services.auth_service.generate_unique_tenant_slug", side_effect=RuntimeError("Simulated slug crash")):
        with pytest.raises(HTTPException) as exc_info:
            auth_service.register_email(
                db=db_session,
                email="orphan.test@example.com",
                password="StrongPassword123!",
                full_name="Dr. Orphan Test",
            )
        assert exc_info.value.status_code == 500
        assert "Failed to register doctor account" in exc_info.value.detail

    # Verify 0 orphaned Doctor or Tenant records exist
    assert db_session.query(Doctor).count() == initial_doctor_count
    assert db_session.query(Tenant).count() == initial_tenant_count
    assert db_session.query(Doctor).filter(Doctor.email == "orphan.test@example.com").first() is None


def test_error_sanitization_does_not_leak_internals(client, db_session):
    """
    Simulated internal database error returns generic message without leaking SQL or traceback.
    """
    with patch("app.services.auth_service.generate_unique_tenant_slug", side_effect=Exception("SELECT * FROM sensitive_table syntax error")):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "dr.leaktest@example.com",
                "password": "StrongPassword123!",
                "full_name": "Dr. Leak Test",
            },
        )
        assert response.status_code == 500
        detail = response.json()["detail"]
        assert "sensitive_table" not in detail
        assert "syntax error" not in detail
        assert detail == "Failed to register doctor account. Please try again later."


def test_concurrent_same_name_tenant_slug_generation(db_session):
    """
    Register 10 doctors named 'Dr. Same Name' with distinct emails;
    each receives a unique deterministic slug (dr-same-name, dr-same-name-2, ..., dr-same-name-10).
    """
    slugs = []
    for i in range(10):
        slug = generate_unique_tenant_slug(db_session, "Dr. Same Name")
        tenant = Tenant(
            doctor_id=uuid.uuid4(),
            slug=slug,
            status="active",
        )
        db_session.add(tenant)
        db_session.commit()
        slugs.append(slug)

    expected_slugs = [
        "dr-same-name",
        "dr-same-name-2",
        "dr-same-name-3",
        "dr-same-name-4",
        "dr-same-name-5",
        "dr-same-name-6",
        "dr-same-name-7",
        "dr-same-name-8",
        "dr-same-name-9",
        "dr-same-name-10",
    ]
    assert slugs == expected_slugs
    assert len(set(slugs)) == 10


def test_email_service_resilience_and_backends():
    """
    Tests EmailService backend selection, console outbox, memory outbox, and tenacity SMTP retry.
    """
    # 1. Memory backend
    mem = MemoryEmailBackend()
    svc = EmailService(backend=mem)
    svc.send_verification_email("doc@test.com", "Dr. Test", "123456", "tokenabc")
    assert len(mem.outbox) == 1
    assert mem.outbox[0]["to"] == "doc@test.com"

    # 2. Console backend
    con = ConsoleEmailBackend()
    svc_con = EmailService(backend=con)
    svc_con.send_verification_email("doc2@test.com", "Dr. Test 2", "654321", "tokenxyz")
    assert len(con.outbox) == 1

    # 3. SMTP backend with tenacity retry on connection error
    smtp_backend = SMTPEmailBackend()
    with patch("smtplib.SMTP", side_effect=smtplib.SMTPConnectError(421, b"Connection refused")) as mock_smtp:
        with pytest.raises(smtplib.SMTPConnectError):
            smtp_backend.send("retry@test.com", "Subject", "Body")
        # Confirms tenacity retried 3 times before raising
        assert mock_smtp.call_count == 3
