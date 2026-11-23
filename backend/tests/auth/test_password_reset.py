import concurrent.futures
import tempfile
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, status
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
    hash_password,
    hash_token,
    verify_password,
)
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
from app.services.auth_service import auth_service
from app.services.email_service import MemoryEmailBackend, email_service

settings = get_settings()

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_memory_email():
    """Ensure tests run hermetically with memory email backend."""
    prev_backend = email_service.backend
    mem = MemoryEmailBackend()
    email_service.set_backend(mem)
    yield mem
    email_service.set_backend(prev_backend)


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


def create_test_doctor(
    db,
    email="doctor.reset@example.com",
    password="InitialPassword123!",
    auth_provider="email",
    is_active=True,
    email_verified=True,
):
    doc = Doctor(
        id=uuid.uuid4(),
        email=email,
        full_name="Dr. Reset Test",
        auth_provider=auth_provider,
        hashed_password=hash_password(password) if password else None,
        is_active=is_active,
        email_verified=email_verified,
        failed_login_attempts=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    tenant = Tenant(
        doctor_id=doc.id,
        slug="dr-reset-test",
        status="active",
    )
    db.add(tenant)
    db.commit()
    db.refresh(doc)
    return doc


# Test 1: test_forgot_password_sends_email — happy path, token created with purpose="password_reset"
def test_forgot_password_sends_email(db_session, setup_memory_email):
    doc = create_test_doctor(db_session)
    res = auth_service.forgot_password(db_session, doc.email)
    assert res["message"] == "If an account exists with this email, a password reset link has been sent."

    tokens = (
        db_session.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.doctor_id == doc.id,
            EmailVerificationToken.purpose == "password_reset",
        )
        .all()
    )
    assert len(tokens) == 2
    for t in tokens:
        assert t.sent_at is not None
        assert t.used_at is None
        exp = t.expires_at.replace(tzinfo=timezone.utc) if t.expires_at.tzinfo is None else t.expires_at
        assert exp > datetime.now(timezone.utc)

    assert len(setup_memory_email.outbox) == 1
    sent = setup_memory_email.outbox[0]
    assert sent["to"] == doc.email
    assert "Reset your" in sent["subject"]


# Test 2: test_forgot_password_nonexistent_email_no_leak — returns 200, no email sent, timing-safe
def test_forgot_password_nonexistent_email_no_leak(db_session, setup_memory_email):
    res = auth_service.forgot_password(db_session, "nonexistent@example.com")
    assert res["message"] == "If an account exists with this email, a password reset link has been sent."
    assert len(setup_memory_email.outbox) == 0

    tokens = db_session.query(EmailVerificationToken).all()
    assert len(tokens) == 0


# Test 3: test_forgot_password_inactive_account_no_leak — returns 200, no email sent
def test_forgot_password_inactive_account_no_leak(db_session, setup_memory_email):
    doc = create_test_doctor(db_session, is_active=False)
    res = auth_service.forgot_password(db_session, doc.email)
    assert res["message"] == "If an account exists with this email, a password reset link has been sent."
    assert len(setup_memory_email.outbox) == 0

    tokens = (
        db_session.query(EmailVerificationToken)
        .filter(EmailVerificationToken.doctor_id == doc.id)
        .all()
    )
    assert len(tokens) == 0


# Test 4: test_forgot_password_60s_cooldown — second request within 60s -> 429 with Retry-After
def test_forgot_password_60s_cooldown(db_session):
    doc = create_test_doctor(db_session)
    auth_service.forgot_password(db_session, doc.email)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.forgot_password(db_session, doc.email)

    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) > 0


# Test 5: test_forgot_password_google_only_account_sends_email — Google users can set a password
def test_forgot_password_google_only_account_sends_email(db_session, setup_memory_email):
    doc = create_test_doctor(db_session, password=None, auth_provider="google")
    assert doc.hashed_password is None

    res = auth_service.forgot_password(db_session, doc.email)
    assert res["message"] == "If an account exists with this email, a password reset link has been sent."

    tokens = (
        db_session.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.doctor_id == doc.id,
            EmailVerificationToken.purpose == "password_reset",
        )
        .all()
    )
    assert len(tokens) == 2
    assert len(setup_memory_email.outbox) == 1


# Test 6: test_reset_password_valid_otp — OTP resets password, returns AuthResponse with JWT
def test_reset_password_valid_otp(db_session):
    doc = create_test_doctor(db_session)
    otp, token = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
    )
    db_session.commit()

    res = auth_service.reset_password(
        db=db_session,
        raw_code_or_token=otp,
        email=doc.email,
        new_password="BrandNewPassword2026!",
    )
    assert res.access_token is not None
    assert res.doctor.email == doc.email
    db_session.refresh(doc)
    assert verify_password("BrandNewPassword2026!", doc.hashed_password)


# Test 7: test_reset_password_valid_url_token — URL token resets password, returns AuthResponse
def test_reset_password_valid_url_token(db_session):
    doc = create_test_doctor(db_session)
    otp, token = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(token),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
    )
    db_session.commit()

    # URL token reset may omit email (magic link)
    res = auth_service.reset_password(
        db=db_session,
        raw_code_or_token=token,
        new_password="BrandNewPassword2026!",
    )
    assert res.access_token is not None
    assert res.doctor.email == doc.email
    db_session.refresh(doc)
    assert verify_password("BrandNewPassword2026!", doc.hashed_password)


# Test 8: test_reset_password_expired_token — returns 400
def test_reset_password_expired_token(db_session):
    doc = create_test_doctor(db_session)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now - timedelta(minutes=5),  # expired
            sent_at=now - timedelta(minutes=35),
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(
            db=db_session,
            raw_code_or_token=otp,
            email=doc.email,
            new_password="BrandNewPassword2026!",
        )
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "expired" in exc_info.value.detail.lower()


# Test 9: test_reset_password_already_used_token — replay -> returns 400
def test_reset_password_already_used_token(db_session):
    doc = create_test_doctor(db_session)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
            used_at=now,  # already used
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(
            db=db_session,
            raw_code_or_token=otp,
            email=doc.email,
            new_password="BrandNewPassword2026!",
        )
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "already been used" in exc_info.value.detail.lower()


# Test 10: test_reset_password_wrong_code_increments_attempts — brute-force counter
def test_reset_password_wrong_code_increments_attempts(db_session):
    doc = create_test_doctor(db_session)
    assert doc.failed_login_attempts == 0

    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(
            db=db_session,
            raw_code_or_token="999999",
            email=doc.email,
            new_password="BrandNewPassword2026!",
        )
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    db_session.refresh(doc)
    assert doc.failed_login_attempts == 1


# Test 11: test_reset_password_5_failures_invalidates_all_tokens — lockout protection
def test_reset_password_5_failures_invalidates_all_tokens(db_session):
    doc = create_test_doctor(db_session)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)

    token = EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose="password_reset",
        expires_at=now + timedelta(minutes=30),
        sent_at=now,
    )
    db_session.add(token)
    db_session.commit()

    # 4 wrong attempts
    for i in range(4):
        with pytest.raises(HTTPException):
            auth_service.reset_password(
                db=db_session,
                raw_code_or_token=f"00000{i}",
                email=doc.email,
                new_password="BrandNewPassword2026!",
            )

    db_session.refresh(doc)
    assert doc.failed_login_attempts == 4
    db_session.refresh(token)
    assert token.used_at is None

    # 5th wrong attempt -> invalidates all tokens
    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(
            db=db_session,
            raw_code_or_token="000004",
            email=doc.email,
            new_password="BrandNewPassword2026!",
        )
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "too many failed" in exc_info.value.detail.lower()

    db_session.refresh(token)
    assert token.used_at is not None


# Test 12: test_reset_password_same_as_current_rejected — must differ from current password
def test_reset_password_same_as_current_rejected(db_session):
    current_pw = "CurrentPassword123!"
    doc = create_test_doctor(db_session, password=current_pw)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(
            db=db_session,
            raw_code_or_token=otp,
            email=doc.email,
            new_password=current_pw,
        )
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "different from the current password" in exc_info.value.detail.lower()


# Test 13: test_reset_password_weak_password_rejected — password policy enforcement
def test_reset_password_weak_password_rejected(db_session):
    doc = create_test_doctor(db_session)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
    )
    db_session.commit()

    # Weak password (< 8 chars, or common password)
    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(
            db=db_session,
            raw_code_or_token=otp,
            email=doc.email,
            new_password="short",
        )
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "at least 8 characters" in exc_info.value.detail.lower()


# Test 14: test_reset_password_auto_login_returns_jwt — JWT is valid, /me works
def test_reset_password_auto_login_returns_jwt(client, db_session):
    doc = create_test_doctor(db_session)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
    )
    db_session.commit()

    res = auth_service.reset_password(
        db=db_session,
        raw_code_or_token=otp,
        email=doc.email,
        new_password="BrandNewPassword2026!",
    )
    assert res.access_token is not None

    # Test /me endpoint using client
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {res.access_token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == doc.email


# Test 15: test_reset_password_clears_lockout — failed_login_attempts=0, locked_until=None
def test_reset_password_clears_lockout(db_session):
    doc = create_test_doctor(db_session)
    now = datetime.now(timezone.utc)
    doc.failed_login_attempts = 3
    doc.locked_until = now + timedelta(minutes=15)
    db_session.commit()

    otp, _ = generate_verification_token()
    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
    )
    db_session.commit()

    res = auth_service.reset_password(
        db=db_session,
        raw_code_or_token=otp,
        email=doc.email,
        new_password="BrandNewPassword2026!",
    )
    assert res.access_token is not None
    db_session.refresh(doc)
    assert doc.failed_login_attempts == 0
    assert doc.locked_until is None


# Test 16: test_reset_does_not_affect_email_verification_tokens — purpose="email_verification" tokens untouched
def test_reset_does_not_affect_email_verification_tokens(db_session):
    doc = create_test_doctor(db_session)
    now = datetime.now(timezone.utc)

    # Verification token
    verif_token = EmailVerificationToken(
        doctor_id=doc.id,
        token_hash="hash_verif_123",
        purpose="email_verification",
        expires_at=now + timedelta(minutes=30),
        sent_at=now,
    )
    # Reset token
    reset_otp, _ = generate_verification_token()
    reset_token = EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(reset_otp),
        purpose="password_reset",
        expires_at=now + timedelta(minutes=30),
        sent_at=now,
    )
    db_session.add_all([verif_token, reset_token])
    db_session.commit()

    auth_service.reset_password(
        db=db_session,
        raw_code_or_token=reset_otp,
        email=doc.email,
        new_password="BrandNewPassword2026!",
    )

    db_session.refresh(verif_token)
    db_session.refresh(reset_token)
    # Reset token marked used
    assert reset_token.used_at is not None
    # Email verification token remains untouched
    assert verif_token.used_at is None


# Test 17: test_concurrent_reset_requests — ThreadPoolExecutor, exactly one succeeds
def test_concurrent_reset_requests():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name

    try:
        concur_engine = create_engine(f"sqlite:///{temp_db_path}", connect_args={"timeout": 15})
        Base.metadata.create_all(bind=concur_engine)
        ConcurSession = sessionmaker(autocommit=False, autoflush=False, bind=concur_engine)

        init_db = ConcurSession()
        doc = Doctor(
            id=uuid.uuid4(),
            email="dr.isolation@hospital.org",
            full_name="Dr. Isolation",
            auth_provider="email",
            hashed_password=hash_password("OldPassword123!"),
            is_active=True,
            email_verified=True,
        )
        init_db.add(doc)
        init_db.commit()

        tenant = Tenant(doctor_id=doc.id, slug="dr-isolation", status="active")
        init_db.add(tenant)

        otp, _ = generate_verification_token()
        now = datetime.now(timezone.utc)
        token_record = EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
        init_db.add(token_record)
        init_db.commit()
        init_db.close()

        def attempt_reset():
            thread_db = ConcurSession()
            try:
                res = auth_service.reset_password(
                    db=thread_db,
                    raw_code_or_token=otp,
                    email="dr.isolation@hospital.org",
                    new_password="SuperSecretPassword2026!",
                )
                return {"status": 200, "token": res.access_token}
            except HTTPException as e:
                return {"status": e.status_code, "detail": e.detail}
            finally:
                thread_db.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut1 = executor.submit(attempt_reset)
            fut2 = executor.submit(attempt_reset)
            results = [fut1.result(), fut2.result()]

        statuses = [r["status"] for r in results]
        assert 200 in statuses
        assert 400 in statuses
    finally:
        import os
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)


# Test 18: test_reset_password_email_delivery_failure_503 — SMTP error -> 503, no token committed
def test_reset_password_email_delivery_failure_503(db_session):
    doc = create_test_doctor(db_session)

    # Force backend.send to raise or fail
    class FailingBackend:
        def send(self, *args, **kwargs):
            return False

    prev_backend = email_service.backend
    email_service.set_backend(FailingBackend())

    try:
        with pytest.raises(HTTPException) as exc_info:
            auth_service.forgot_password(db_session, doc.email)

        assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

        # No token committed
        tokens = (
            db_session.query(EmailVerificationToken)
            .filter(
                EmailVerificationToken.doctor_id == doc.id,
                EmailVerificationToken.purpose == "password_reset",
            )
            .all()
        )
        assert len(tokens) == 0
    finally:
        email_service.set_backend(prev_backend)
