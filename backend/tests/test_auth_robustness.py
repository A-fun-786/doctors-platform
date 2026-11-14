import concurrent.futures
import hashlib
import os
import re
import secrets
import smtplib
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import (
    generate_verification_token,
    hash_token,
    verify_token_hash,
)
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
from app.schemas.auth import (
    validate_email_id,
    validate_password_strength,
)
from app.services.auth_service import auth_service, generate_unique_tenant_slug
from app.services.email_service import (
    EmailService,
    MemoryEmailBackend,
    SMTPEmailBackend,
    email_service,
)

settings = get_settings()

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
    mem_backend = MemoryEmailBackend()
    email_service.set_backend(mem_backend)
    yield mem_backend
    mem_backend.clear()


def _extract_otp_from_outbox(backend) -> str:
    """Helper to extract 6-digit OTP code from memory outbox text."""
    body = backend.outbox[-1]["text"]
    for line in body.splitlines():
        if "code is: " in line:
            return line.split("code is: ")[1].strip()
    raise ValueError("OTP not found in email outbox")


# ==============================================================================
# Layer 1: Unit Tests (Validators, Crypto & Helpers)
# ==============================================================================

def test_layer1_email_rfc_and_boundary_cases():
    """
    Validates standard, subdomain, and + tag emails; normalizes case/whitespace;
    rejects emails > 254 chars, local parts > 64 chars, consecutive dots,
    leading/trailing dots, unicode homographs, SQL/XSS payloads, and non-string types.
    """
    # 1. Accepts standard, subdomain, and + tag emails
    assert validate_email_id("doctor@hospital.org") == "doctor@hospital.org"
    assert validate_email_id("dr.smith+cardiology@sub.clinic.co.uk") == "dr.smith+cardiology@sub.clinic.co.uk"
    assert validate_email_id("surgeon_99@med-center.io") == "surgeon_99@med-center.io"

    # 2. Normalizes case and surrounding whitespace
    assert validate_email_id("   Dr.Jane.Doe+Pediatrics@Clinic.COM \t ") == "dr.jane.doe+pediatrics@clinic.com"

    # 3. Rejects emails > 254 chars total
    long_domain = "a" * 240 + ".org"
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id(f"user@{long_domain}")

    # 4. Rejects local parts > 64 chars
    long_local = "a" * 65
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id(f"{long_local}@example.com")

    # 5. Rejects consecutive dots
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("dr..doe@hospital.org")
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("doctor@sub..domain.com")

    # 6. Rejects leading / trailing dots
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id(".doctor@hospital.org")
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("doctor.@hospital.org")
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("doctor@.hospital.org")
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("doctor@hospital.org.")

    # 7. Rejects unicode homograph / control characters
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("doc\x00tor@example.com")
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("doc\ntor@example.com")
    # Cyrillic small 'o' (U+043E)
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id("d\u043ector@example.com")

    # 8. Rejects SQL/XSS payloads
    xss_sql_payloads = [
        "admin'--@example.com",
        "<script>alert(1)</script>@test.com",
        "'; drop table users; --@example.com",
        "doc\"or'1'='1@clinic.com",
        "dr/*comment*/@example.com",
    ]
    for payload in xss_sql_payloads:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(payload)

    # 9. Rejects non-string types
    for non_str in [None, 12345, [], {}, 3.14]:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(non_str)


def test_layer1_password_policy_boundaries():
    """
    Validates password strength policy:
    - Rejects < 8 chars
    - Rejects missing character classes (< 16 chars)
    - Accepts passphrase >= 16 characters
    - Rejects > 72-byte UTF-8 strings (including multi-byte emoji passwords)
    - Accepts <= 72-byte compliant passwords
    - Rejects whitespace-only passwords
    - Rejects passwords matching email prefix
    - Rejects common breached passwords
    """
    # 1. Rejects < 8 chars
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_strength("Short1!")

    # 2. Rejects missing character classes (for passwords under 16 chars)
    with pytest.raises(ValueError, match="at least one uppercase letter"):
        validate_password_strength("lowercase123!")
    with pytest.raises(ValueError, match="at least one uppercase letter"):
        validate_password_strength("UPPERCASE123!")
    with pytest.raises(ValueError, match="at least one uppercase letter"):
        validate_password_strength("NoDigitsHere!")
    with pytest.raises(ValueError, match="at least one uppercase letter"):
        validate_password_strength("NoSpecial123")

    # 3. Accepts passphrase >= 16 characters without special characters
    passphrase = "thisisalongpassphrasewithoutspecial"
    assert validate_password_strength(passphrase) == passphrase

    # 4. Rejects > 72-byte UTF-8 strings (including multi-byte emoji passwords)
    # 19 4-byte emojis = 76 bytes (which is only 19 characters, but > 72 bytes)
    emoji_pwd = "🔒" * 19
    assert len(emoji_pwd.encode("utf-8")) == 76
    with pytest.raises(ValueError, match="cannot exceed 72 bytes"):
        validate_password_strength(emoji_pwd)

    # 73 ASCII chars
    long_ascii = "A1!" + "a" * 70
    assert len(long_ascii.encode("utf-8")) == 73
    with pytest.raises(ValueError, match="cannot exceed 72 bytes"):
        validate_password_strength(long_ascii)

    # Exactly 72 bytes is accepted
    exact_72 = "A1!" + "a" * 69
    assert len(exact_72.encode("utf-8")) == 72
    assert validate_password_strength(exact_72) == exact_72

    # 5. Rejects whitespace-only passwords
    with pytest.raises(ValueError, match="empty or whitespace-only"):
        validate_password_strength("         ")

    # 6. Rejects passwords matching email prefix
    with pytest.raises(ValueError, match="must not contain parts of your email"):
        validate_password_strength("SurgeonSmith123!", email="surgeonsmith@clinic.org")
    with pytest.raises(ValueError, match="must not contain parts of your email"):
        validate_password_strength("SmithClinic2026!", email="dr.smith@clinic.org")

    # 7. Rejects common breached passwords
    with pytest.raises(ValueError, match="too common and easily guessable"):
        validate_password_strength("Password123!")
    with pytest.raises(ValueError, match="too common and easily guessable"):
        validate_password_strength("Welcome123!")


def test_layer1_token_hashing_and_constant_time_compare():
    """
    Validates token generation entropy, SHA-256 storage hashing, and constant-time comparison.
    """
    pair = generate_verification_token()
    assert len(pair.otp) == 6
    assert pair.otp.isdigit()
    assert len(pair.token) >= 42

    # SHA-256 hex digest: exactly 64 hex characters
    digest = hash_token(pair.otp)
    assert len(digest) == 64
    assert bool(re.match(r"^[0-9a-f]{64}$", digest))

    # Constant-time comparison
    assert verify_token_hash(pair.otp, digest) is True
    assert verify_token_hash("000000", digest) is False
    assert verify_token_hash("", digest) is False
    assert verify_token_hash(None, digest) is False


# ==============================================================================
# Layer 2: Integration & Security Tests (API Endpoints)
# ==============================================================================

def test_layer2_end_to_end_registration_and_verification(client, db_session, memory_email_backend):
    """
    POST /register -> POST /verify-email -> GET /me
    Doctor & Tenant created atomically; email_verified transitions False -> True;
    JWT issued and accepted by /me.
    """
    reg_payload = {
        "email": "dr.robust@hospital.org",
        "password": "SecurePassword2026!",
        "full_name": "Dr. Robust Specialist",
        "phone": "+1-555-0199",
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["doctor"]["email_verified"] is False
    assert reg_data["doctor"]["email"] == "dr.robust@hospital.org"
    assert reg_data["tenant"]["slug"].startswith("dr-robust-specialist")

    # Verify atomic DB creation
    doc = db_session.query(Doctor).filter(Doctor.email == "dr.robust@hospital.org").first()
    assert doc is not None
    assert doc.email_verified is False
    assert doc.tenant is not None

    # Retrieve OTP from outbox
    assert len(memory_email_backend.outbox) == 1
    otp = _extract_otp_from_outbox(memory_email_backend)

    # Verify email
    ver_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": otp})
    assert ver_res.status_code == 200
    ver_data = ver_res.json()
    assert ver_data["doctor"]["email_verified"] is True
    jwt_token = ver_data["access_token"]
    assert jwt_token

    # Verify authenticated /me profile
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "dr.robust@hospital.org"
    assert me_data["email_verified"] is True


def test_layer2_token_expiration_and_replay_prevention(client, db_session, memory_email_backend):
    """
    Expired token returns 400; reusing consumed token returns 400;
    older token invalidated when resend is called.
    """
    client.post("/api/v1/auth/register", json={
        "email": "dr.replay@clinic.org",
        "password": "SecurePassword2026!",
        "full_name": "Dr. Replay Guard",
    })
    doc = db_session.query(Doctor).filter(Doctor.email == "dr.replay@clinic.org").first()
    otp = _extract_otp_from_outbox(memory_email_backend)

    # 1. Expired token returns 400
    db_token = db_session.query(EmailVerificationToken).filter(
        EmailVerificationToken.doctor_id == doc.id,
        EmailVerificationToken.token_hash == hash_token(otp),
    ).first()
    db_token.expires_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db_session.commit()

    exp_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": otp})
    assert exp_res.status_code == 400
    assert "expired" in exp_res.json()["detail"].lower()

    # 2. Reset expiration, verify token -> 200
    db_token.expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db_session.commit()
    ok_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": otp})
    assert ok_res.status_code == 200

    # 3. Replay defense: second attempt returns 400
    replay_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": otp})
    assert replay_res.status_code == 400
    assert "already been used" in replay_res.json()["detail"].lower()


def test_layer2_brute_force_and_rate_limiting(client, db_session, memory_email_backend):
    """
    Repeated failed verification attempts (5 failed attempts) invalidates the token.
    Resend verification enforces rate limiting cooldown.
    """
    client.post("/api/v1/auth/register", json={
        "email": "dr.bruteforce@clinic.org",
        "password": "SecurePassword2026!",
        "full_name": "Dr. Brute Force Guard",
    })
    doc = db_session.query(Doctor).filter(Doctor.email == "dr.bruteforce@clinic.org").first()
    valid_otp = _extract_otp_from_outbox(memory_email_backend)

    # 5 failed verification attempts
    for _ in range(5):
        fail_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": "000000"})
        assert fail_res.status_code == 400

    # Token must now be marked invalidated / used in DB
    consumed_tokens = db_session.query(EmailVerificationToken).filter(
        EmailVerificationToken.doctor_id == doc.id,
        EmailVerificationToken.used_at.isnot(None),
    ).all()
    assert len(consumed_tokens) > 0

    # 6th request triggers rate limit 429 Too Many Requests
    brute_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": valid_otp})
    assert brute_res.status_code == 429

    # Reset limiter to confirm token was also invalidated due to brute force
    limiter.reset()
    invalidated_res = client.post("/api/v1/auth/verify-email", json={"email": doc.email, "code": valid_otp})
    assert invalidated_res.status_code == 400
    detail = invalidated_res.json()["detail"].lower()
    assert "already been used" in detail or "invalid" in detail

    # Immediate resend triggers 60s cooldown (429) with Retry-After header
    resend_too_soon = client.post("/api/v1/auth/resend-verification", json={"email": doc.email})
    assert resend_too_soon.status_code == 429
    assert "Retry-After" in resend_too_soon.headers
    assert "60 seconds" in resend_too_soon.json()["detail"]

    # Fast forward latest token created_at past 60s
    past_time = datetime.now(timezone.utc) - timedelta(seconds=65)
    for tok in db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doc.id).all():
        tok.created_at = past_time
        tok.sent_at = past_time
    db_session.commit()

    # Now resend succeeds (200)
    limiter.reset()
    resend_ok = client.post("/api/v1/auth/resend-verification", json={"email": doc.email})
    assert resend_ok.status_code == 200


def test_layer2_cross_provider_collision_handling(client, db_session):
    """
    Registering an email already linked to Google requires Google login.
    Logging in via Google after email registration transitions email_verified to True.
    """
    # 1. Register with Google mock auth
    with patch(
        "app.services.auth_service.verify_google_token",
        return_value={
            "email": "dr.google_cross@hospital.org",
            "name": "Dr. Google Cross",
            "sub": "cross-sub-google-1",
            "picture": None,
            "email_verified": True,
        },
    ):
        google_res = client.post("/api/v1/auth/google", json={"credential": "mock-google-credential"})
    assert google_res.status_code == 200
    google_doc = db_session.query(Doctor).filter(Doctor.email == "dr.google_cross@hospital.org").first()
    assert google_doc.email_verified is True
    assert google_doc.hashed_password is None

    # Attempting email registration on Google account returns clean 400
    collision_res = client.post("/api/v1/auth/register", json={
        "email": "dr.google_cross@hospital.org",
        "password": "SecurePassword2026!",
        "full_name": "Dr. Google Cross",
    })
    assert collision_res.status_code == 400
    assert "google" in collision_res.json()["detail"].lower()

    # Confirm exactly 1 doctor and 1 tenant
    assert db_session.query(Doctor).filter(Doctor.email == "dr.google_cross@hospital.org").count() == 1
    assert db_session.query(Tenant).filter(Tenant.doctor_id == google_doc.id).count() == 1

    # 2. Register email doctor first, then login via Google
    client.post("/api/v1/auth/register", json={
        "email": "dr.email_cross@hospital.org",
        "password": "SecurePassword2026!",
        "full_name": "Dr. Email Cross",
    })
    email_doc = db_session.query(Doctor).filter(Doctor.email == "dr.email_cross@hospital.org").first()
    assert email_doc.email_verified is False

    with patch(
        "app.services.auth_service.verify_google_token",
        return_value={
            "email": "dr.email_cross@hospital.org",
            "name": "Dr. Email Cross",
            "sub": "cross-sub-google-2",
            "picture": None,
            "email_verified": True,
        },
    ):
        google_link_res = client.post("/api/v1/auth/google", json={"credential": "mock-google-credential-2"})
    assert google_link_res.status_code == 200
    db_session.refresh(email_doc)
    assert email_doc.email_verified is True
    assert email_doc.provider_id == "cross-sub-google-2"

    # Confirm zero duplicate rows
    assert db_session.query(Doctor).filter(Doctor.email == "dr.email_cross@hospital.org").count() == 1
    assert db_session.query(Tenant).filter(Tenant.doctor_id == email_doc.id).count() == 1


def test_layer2_error_sanitization_no_internal_leaks(client, db_session):
    """
    Simulated DB failure rolls back cleanly (0 orphaned records) and returns
    generic 500 without leaking SQL/table internals.
    """
    with patch.object(db_session, "commit", side_effect=Exception("FATAL: syntax error at or near 'SELECT' in private_schema.sensitive_table")):
        res = client.post(
            "/api/v1/auth/register",
            json={
                "email": "dr.leaktest@hospital.org",
                "password": "SecurePassword2026!",
                "full_name": "Dr. Leak Test",
            },
        )
        assert res.status_code == 500
        detail = res.json()["detail"]
        assert "sensitive_table" not in detail
        assert "private_schema" not in detail
        assert "FATAL" not in detail
        assert detail == "Failed to register doctor account. Please try again later."


# ==============================================================================
# Layer 3: Reliability, Atomicity & Concurrency Tests
# ==============================================================================

def test_layer3_transaction_rollback_on_partial_failure(db_session):
    """
    Monkeypatch Tenant creation or token insertion to fail mid-transaction;
    verify db.query(Doctor).count() == 0 and db.query(Tenant).count() == 0.
    """
    with patch("app.services.auth_service.generate_unique_tenant_slug", side_effect=RuntimeError("Simulated slug crash")):
        with pytest.raises(HTTPException) as exc_info:
            auth_service.register_email(
                db=db_session,
                email="dr.rollback@hospital.org",
                password="SecurePassword2026!",
                full_name="Dr. Rollback Check",
            )
        assert exc_info.value.status_code == 500

    # Ensure zero orphaned Doctor or Tenant rows
    orphaned_docs = db_session.query(Doctor).filter(Doctor.email == "dr.rollback@hospital.org").all()
    assert len(orphaned_docs) == 0
    orphaned_tenants = db_session.query(Tenant).all()
    assert len(orphaned_tenants) == 0


def test_layer3_concurrent_duplicate_email_registration():
    """
    Fire simultaneous registration requests with identical email across concurrent threads.
    With separate DB connections, exactly 1 succeeds (201) and the other returns clean 400
    (never 500 IntegrityError).
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name

    try:
        concur_engine = create_engine(f"sqlite:///{temp_db_path}", connect_args={"timeout": 15})
        Base.metadata.create_all(bind=concur_engine)
        ConcurSession = sessionmaker(autocommit=False, autoflush=False, bind=concur_engine)

        def attempt_register():
            thread_db = ConcurSession()
            try:
                res = auth_service.register_email(
                    db=thread_db,
                    email="dr.concurrent@hospital.org",
                    password="SecurePassword2026!",
                    full_name="Dr. Concurrent Candidate",
                )
                return {"status": 201, "doctor_id": str(res.doctor.id)}
            except HTTPException as e:
                return {"status": e.status_code, "detail": e.detail}
            finally:
                thread_db.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(attempt_register)
            future2 = executor.submit(attempt_register)
            results = [future1.result(), future2.result()]

        statuses = [r["status"] for r in results]
        assert 201 in statuses
        assert 400 in statuses
        assert 500 not in statuses

        # Verify database integrity: exactly 1 doctor and 1 tenant
        check_db = ConcurSession()
        try:
            docs = check_db.query(Doctor).filter(Doctor.email == "dr.concurrent@hospital.org").all()
            assert len(docs) == 1
            tenants = check_db.query(Tenant).filter(Tenant.doctor_id == docs[0].id).all()
            assert len(tenants) == 1
        finally:
            check_db.close()
            concur_engine.dispose()
    finally:
        if os.path.exists(temp_db_path):
            os.unlink(temp_db_path)


def test_layer3_concurrent_same_name_tenant_slug_collision(db_session):
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


def test_layer3_email_service_failure_resilience():
    """
    Simulate SMTP timeout/connection error; verify tenacity retry executes 3 times before raising.
    Verify AuthService catches email dispatch failures gracefully without failing registration.
    """
    # 1. Tenacity retry 3 times on SMTPEmailBackend
    smtp_backend = SMTPEmailBackend()
    with patch("smtplib.SMTP", side_effect=smtplib.SMTPConnectError(421, b"Connection refused")) as mock_smtp:
        with pytest.raises(smtplib.SMTPConnectError):
            smtp_backend.send("retry@test.com", "Subject", "Body")
        assert mock_smtp.call_count == 3

    # 2. Registration succeeds even if email dispatch encounters an unexpected error
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        with patch.object(email_service, "send_verification_email", side_effect=Exception("SMTP outbox down")):
            res = auth_service.register_email(
                db=db,
                email="dr.dispatch_fail@hospital.org",
                password="SecurePassword2026!",
                full_name="Dr. Resilient Registration",
            )
            assert res.doctor.email == "dr.dispatch_fail@hospital.org"
            assert res.doctor.email_verified is False
            # Doctor and tenant committed
            doc = db.query(Doctor).filter(Doctor.email == "dr.dispatch_fail@hospital.org").first()
            assert doc is not None
            assert doc.tenant is not None
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


def test_layer2_unverified_account_reregistration_allowed_until_verified(client, db_session):
    """
    Bug 1 regression test:
    Before email verification and account creation, an unverified account must NOT show
    'An account with this email already exists'. It must allow re-registration, credential updates,
    and fresh OTP issuance until verified. Once verified, duplicate registration must return 400.
    """
    test_email = "dr.unverified_flow@hospital.org"

    # 1. Initial registration
    res1 = client.post(
        "/api/v1/auth/register",
        json={
            "email": test_email,
            "password": "InitialPassword2026!",
            "full_name": "Dr. Unverified Initial",
        },
    )
    assert res1.status_code == 201
    assert res1.json()["doctor"]["email_verified"] is False

    doc = db_session.query(Doctor).filter(Doctor.email == test_email).first()
    assert doc is not None
    assert doc.email_verified is False

    # 2. Re-attempt registration before OTP verification (must NOT fail with 'already exists')
    res2 = client.post(
        "/api/v1/auth/register",
        json={
            "email": test_email,
            "password": "UpdatedPassword2026!",
            "full_name": "Dr. Unverified Updated",
        },
    )
    assert res2.status_code == 201
    assert res2.json()["doctor"]["email_verified"] is False
    assert res2.json()["doctor"]["full_name"] == "Dr. Unverified Updated"

    # Confirm only 1 doctor row exists (updated in place)
    assert db_session.query(Doctor).filter(Doctor.email == test_email).count() == 1

    # 3. Verify account via OTP
    latest_token = (
        db_session.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.doctor_id == doc.id,
            EmailVerificationToken.purpose == "email_verification",
            EmailVerificationToken.used_at == None,
        )
        .order_by(EmailVerificationToken.created_at.desc())
        .first()
    )
    assert latest_token is not None

    # Simulate OTP verification
    doc.email_verified = True
    doc.email_verified_at = datetime.now(timezone.utc)
    db_session.commit()

    # 4. Attempt registration AFTER verification -> MUST fail with 400 'already exists'
    res3 = client.post(
        "/api/v1/auth/register",
        json={
            "email": test_email,
            "password": "ThirdPassword2026!",
            "full_name": "Dr. Verified Attempt",
        },
    )
    assert res3.status_code == 400
    assert "already exists" in res3.json()["detail"].lower()


def test_registration_delivery_status_success(client, db_session):
    """
    Registration with successful email delivery returns verification_email_sent=True
    and records sent_at timestamp on the tokens.
    """
    test_email = f"dr.success.{uuid.uuid4().hex[:6]}@example.com"
    with patch.object(email_service, "send_verification_email", return_value=True) as mock_send:
        res = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_email,
                "password": "StrongPassword123!",
                "full_name": "Dr. Success Delivery",
            },
        )
    assert res.status_code == 201
    data = res.json()
    assert data["verification_email_sent"] is True
    assert mock_send.called

    doctor = db_session.query(Doctor).filter(Doctor.email == test_email).first()
    tokens = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doctor.id).all()
    assert len(tokens) == 2
    for tok in tokens:
        assert tok.sent_at is not None


def test_registration_delivery_status_provider_failure_and_exception(client, db_session, caplog):
    """
    Registration with a provider False result or exception returns verification_email_sent=False,
    preserves successful account creation, leaves sent_at as None, and does not leak OTP in logs.
    """
    test_email_false = f"dr.fail.false.{uuid.uuid4().hex[:6]}@example.com"
    with patch.object(email_service, "send_verification_email", return_value=False):
        res1 = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_email_false,
                "password": "StrongPassword123!",
                "full_name": "Dr. Fail False",
            },
        )
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["verification_email_sent"] is False
    assert data1["access_token"] is not None

    doc1 = db_session.query(Doctor).filter(Doctor.email == test_email_false).first()
    tokens1 = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doc1.id).all()
    for tok in tokens1:
        assert tok.sent_at is None

    test_email_exc = f"dr.fail.exc.{uuid.uuid4().hex[:6]}@example.com"
    with patch.object(email_service, "send_verification_email", side_effect=RuntimeError("Resend API down")):
        res2 = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_email_exc,
                "password": "StrongPassword123!",
                "full_name": "Dr. Fail Exception",
            },
        )
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["verification_email_sent"] is False
    assert data2["access_token"] is not None

    doc2 = db_session.query(Doctor).filter(Doctor.email == test_email_exc).first()
    tokens2 = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doc2.id).all()
    for tok in tokens2:
        assert tok.sent_at is None


def test_resend_verification_provider_failure_returns_503_and_preserves_code(client, db_session):
    """
    Resend failure returns 503, preserves earlier usable tokens, and allows immediate retry without cooldown.
    """
    test_email = f"dr.resend.fail.{uuid.uuid4().hex[:6]}@example.com"
    with patch.object(email_service, "send_verification_email", return_value=True):
        reg_res = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_email,
                "password": "StrongPassword123!",
                "full_name": "Dr. Resend Fail",
            },
        )
    assert reg_res.status_code == 201
    doc = db_session.query(Doctor).filter(Doctor.email == test_email).first()

    # Fast forward initial sent_at to clear cooldown
    past_time = datetime.now(timezone.utc) - timedelta(seconds=65)
    initial_tokens = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.doctor_id == doc.id).all()
    for tok in initial_tokens:
        tok.created_at = past_time
        tok.sent_at = past_time
    db_session.commit()

    # Resend attempt fails at provider
    limiter.reset()
    with patch.object(email_service, "send_verification_email", return_value=False):
        fail_res = client.post(
            "/api/v1/auth/resend-verification",
            json={"email": test_email},
        )
    assert fail_res.status_code == 503
    assert "could not be sent" in fail_res.json()["detail"].lower()

    # Verify initial tokens were NOT invalidated
    for tok in initial_tokens:
        db_session.refresh(tok)
        assert tok.used_at is None

    # Immediate retry does not trigger 429 cooldown because delivery failed
    limiter.reset()
    with patch.object(email_service, "send_verification_email", return_value=True):
        retry_res = client.post(
            "/api/v1/auth/resend-verification",
            json={"email": test_email},
        )
    assert retry_res.status_code == 200
    assert "sent successfully" in retry_res.json()["message"]


