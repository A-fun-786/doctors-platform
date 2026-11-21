import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import status
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
)
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
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
    email="doctor.routes@example.com",
    password="InitialPassword123!",
    auth_provider="email",
    is_active=True,
    email_verified=True,
    slug=None,
):
    doc = Doctor(
        id=uuid.uuid4(),
        email=email,
        full_name="Dr. Route Test",
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
        slug=slug or f"dr-route-{uuid.uuid4().hex[:8]}",
        status="active",
    )
    db.add(tenant)
    db.commit()
    db.refresh(doc)
    return doc


# --- /api/v1/auth/forgot-password route tests ---

def test_forgot_password_route_happy_path(client, db_session, setup_memory_email):
    doc = create_test_doctor(db_session)
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": doc.email},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data
    assert data["message"] == "If an account exists with this email, a password reset link has been sent."

    # Confirm email sent and tokens created
    assert len(setup_memory_email.outbox) == 1
    tokens = db_session.query(EmailVerificationToken).filter_by(doctor_id=doc.id, purpose="password_reset").all()
    assert len(tokens) == 2


def test_forgot_password_route_nonexistent_email_anti_enumeration(client, db_session, setup_memory_email):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "ghost.nonexistent@example.com"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "If an account exists with this email, a password reset link has been sent."
    assert len(setup_memory_email.outbox) == 0


def test_forgot_password_route_inactive_doctor_anti_enumeration(client, db_session, setup_memory_email):
    doc = create_test_doctor(db_session, email="inactive.route@example.com", is_active=False)
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": doc.email},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "If an account exists with this email, a password reset link has been sent."
    assert len(setup_memory_email.outbox) == 0


def test_forgot_password_route_invalid_email_format_422(client):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "not-a-valid-email"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_forgot_password_route_domain_cooldown_429(client, db_session):
    doc = create_test_doctor(db_session)
    r1 = client.post("/api/v1/auth/forgot-password", json={"email": doc.email})
    assert r1.status_code == status.HTTP_200_OK

    r2 = client.post("/api/v1/auth/forgot-password", json={"email": doc.email})
    assert r2.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in r2.headers
    assert int(r2.headers["Retry-After"]) > 0


def test_forgot_password_route_slowapi_rate_limit(client, db_session):
    # RATE_LIMIT_PASSWORD_RESET is 3/minute
    # Use different emails to bypass domain-level 60s single-account cooldown
    for i in range(3):
        create_test_doctor(db_session, email=f"doc{i}@example.com")
        res = client.post("/api/v1/auth/forgot-password", json={"email": f"doc{i}@example.com"})
        assert res.status_code == status.HTTP_200_OK

    # 4th request from same client IP triggers SlowAPI 429
    res4 = client.post("/api/v1/auth/forgot-password", json={"email": "doc_extra@example.com"})
    assert res4.status_code == status.HTTP_429_TOO_MANY_REQUESTS


# --- /api/v1/auth/reset-password route tests ---

def test_reset_password_route_valid_otp(client, db_session):
    doc = create_test_doctor(db_session)
    otp, token = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
            sent_at=now,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": doc.email,
            "code": otp,
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["doctor"]["email"] == doc.email
    assert data["tenant"]["slug"] == doc.tenant.slug

    # Verify doctor can immediately log in with new password
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": doc.email, "password": "BrandNewPassword2026!"},
    )
    assert login_res.status_code == status.HTTP_200_OK


def test_reset_password_route_valid_url_token_without_email(client, db_session):
    doc = create_test_doctor(db_session)
    otp, token = generate_verification_token()
    now = datetime.now(timezone.utc)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(token),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
            sent_at=now,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": token,
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()


def test_reset_password_route_missing_code_and_token_422(client):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "doc@example.com",
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "Either code or token is required" in response.text


def test_reset_password_route_invalid_code_400(client, db_session):
    doc = create_test_doctor(db_session)
    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": doc.email,
            "code": "999999",
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid reset code or token" in response.json()["detail"]


def test_reset_password_route_expired_token_400(client, db_session):
    doc = create_test_doctor(db_session)
    otp, _ = generate_verification_token()
    past = datetime.now(timezone.utc) - timedelta(minutes=10)

    db_session.add(
        EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp),
            purpose="password_reset",
            expires_at=past,
            sent_at=past,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": doc.email,
            "code": otp,
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "expired" in response.json()["detail"].lower()


def test_reset_password_route_reused_token_400(client, db_session):
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
            used_at=now,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": doc.email,
            "code": otp,
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already been used" in response.json()["detail"].lower()


def test_reset_password_route_same_as_current_password_400(client, db_session):
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

    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": doc.email,
            "code": otp,
            "new_password": current_pw,
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "different from the current password" in response.json()["detail"].lower()


def test_reset_password_route_weak_password_400(client, db_session):
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

    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": doc.email,
            "code": otp,
            "new_password": "weak",
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "at least 8 characters" in response.json()["detail"].lower()


def test_reset_password_route_slowapi_rate_limit(client, db_session):
    # RATE_LIMIT_PASSWORD_RESET is 3/minute
    for i in range(3):
        res = client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": f"doc{i}@example.com",
                "code": "000000",
                "new_password": "BrandNewPassword2026!",
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    # 4th request from same IP hits SlowAPI 429
    res4 = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "doc_extra@example.com",
            "code": "000000",
            "new_password": "BrandNewPassword2026!",
        },
    )
    assert res4.status_code == status.HTTP_429_TOO_MANY_REQUESTS
