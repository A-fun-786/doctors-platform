import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.core.rate_limit import limiter
from app.core.security import (
    generate_verification_token,
    hash_token,
    verify_token_hash,
    create_access_token,
    decode_access_token,
    DUMMY_BCRYPT_HASH,
    verify_password,
)
from app.schemas.auth import (
    validate_email_id,
    validate_password_strength,
    sanitize_full_name,
    sanitize_phone,
    EmailRegisterRequest,
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


# ==========================================
# 1. Email RFC & Boundary Tests
# ==========================================

def test_validate_email_id_valid_cases():
    valid = [
        "standard.doctor@clinic.org",
        "sub.domain.doctor@sub.hospital.co.uk",
        "doctor+cardiology@med-center.health",
        "  Dr.Ahmed@Example.Com  ",
    ]
    for email in valid:
        cleaned = validate_email_id(email)
        assert cleaned == email.strip().lower()
        assert "@" in cleaned


def test_validate_email_id_rejections():
    # Non-string types
    for non_str in [None, 12345, [], {}, True]:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(non_str)

    # Length boundaries (>254 chars total)
    long_email = "a" * 245 + "@example.com"
    assert len(long_email) > 254
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id(long_email)

    # Local-part length boundary (>64 chars)
    long_local = "a" * 65 + "@example.com"
    with pytest.raises(ValueError, match="Invalid email address format"):
        validate_email_id(long_local)

    # Consecutive dots
    for dot_case in ["doc..tor@example.com", "doctor@example..com", "doc...tor@test.org"]:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(dot_case)

    # Leading and trailing dots
    for dot_case in [".doctor@example.com", "doctor.@example.com", "doctor@example.com."]:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(dot_case)

    # Unicode homographs and control characters
    for attack in [
        "dоctor@example.com",  # Cyrillic 'о' (\u043e)
        "doctor\x00@example.com",  # Null byte
        "doctor\n@example.com",  # Line break
        "doctor\t@example.com",  # Tab
    ]:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(attack)

    # SQL/XSS payloads
    for injection in [
        "admin'--@example.com",
        "admin';DROP TABLE users;--@example.com",
        "<script>alert(1)</script>@example.com",
        "doc\"quote@example.com",
    ]:
        with pytest.raises(ValueError, match="Invalid email address format"):
            validate_email_id(injection)

    # Disposable / throwaway domains
    for throwaway in [
        "fake@mailinator.com",
        "temp@tempmail.com",
        "anon@10minutemail.com",
        "throwaway@guerrillamail.com",
    ]:
        with pytest.raises(ValueError, match="Disposable or temporary email addresses are not allowed"):
            validate_email_id(throwaway)


# ==========================================
# 2. Password Policy Tests
# ==========================================

def test_validate_password_strength_valid():
    # Standard complex password (>= 8 chars with 4 classes)
    assert validate_password_strength("ValidP@ss123") == "ValidP@ss123"
    assert validate_password_strength("MyClin1c#Secure") == "MyClin1c#Secure"

    # Passphrase rule (>= 16 characters bypasses character class requirements)
    passphrase = "correct horse battery staple"
    assert len(passphrase) >= 16
    assert validate_password_strength(passphrase) == passphrase


def test_validate_password_strength_rejections():
    # Empty or whitespace-only
    for empty in ["", "   ", "\t\n"]:
        with pytest.raises(ValueError, match="cannot be empty or whitespace-only"):
            validate_password_strength(empty)

    # Length < 8 chars
    for short in ["Ab1!", "Pass1!", "1234567"]:
        with pytest.raises(ValueError, match="at least 8 characters long"):
            validate_password_strength(short)

    # Maximum 72 bytes (bcrypt truncation)
    # 73 ASCII characters
    long_ascii = "A" * 70 + "1!a"
    assert len(long_ascii.encode("utf-8")) == 73
    with pytest.raises(ValueError, match="cannot exceed 72 bytes"):
        validate_password_strength(long_ascii)

    # Multi-byte emoji password that exceeds 72 bytes at < 72 characters
    # Each emoji is 4 bytes; 19 * 4 = 76 bytes (19 characters)
    emoji_pwd = "🔒" * 19
    assert len(emoji_pwd) == 19
    assert len(emoji_pwd.encode("utf-8")) == 76
    with pytest.raises(ValueError, match="cannot exceed 72 bytes"):
        validate_password_strength(emoji_pwd)

    # Missing character classes (< 16 chars)
    with pytest.raises(ValueError, match="one uppercase letter"):
        validate_password_strength("lowercase123!")
    with pytest.raises(ValueError, match="one lowercase letter"):
        validate_password_strength("UPPERCASE123!")
    with pytest.raises(ValueError, match="one digit"):
        validate_password_strength("NoDigitsHere!!")
    with pytest.raises(ValueError, match="one special character"):
        validate_password_strength("NoSpecial123")

    # Common breached passwords
    for common in ["Password123!", "admin1234", "welcome123", "password", "doctor123"]:
        with pytest.raises(ValueError, match="too common and easily guessable"):
            validate_password_strength(common)

    # Password containing email local-part
    with pytest.raises(ValueError, match="must not contain parts of your email address"):
        validate_password_strength("AhmedCardio123!", email="ahmed.cardio@clinic.com")

    with pytest.raises(ValueError, match="must not contain parts of your email address"):
        validate_password_strength("SecretDoctor123!", email="doctor@hospital.org")


# ==========================================
# 3. Profile Field Sanitization Tests
# ==========================================

def test_sanitize_full_name():
    assert sanitize_full_name(None) is None
    assert sanitize_full_name("  Dr. Jane Doe  ") == "Dr. Jane Doe"

    # HTML tags stripped
    assert sanitize_full_name("<b>Dr. Jane Doe</b>") == "Dr. Jane Doe"
    assert sanitize_full_name("<script>alert('xss')</script>Dr. Bob") == "Dr. Bob"

    # Control characters stripped
    assert sanitize_full_name("Dr. Jane\x00 Doe\x1f") == "Dr. Jane Doe"

    # Length bounds
    with pytest.raises(ValueError, match="between 2 and 120 characters"):
        sanitize_full_name("A")
    with pytest.raises(ValueError, match="between 2 and 120 characters"):
        sanitize_full_name("A" * 121)


def test_sanitize_phone():
    assert sanitize_phone(None) is None
    assert sanitize_phone("+1 (555) 019-2834") == "+1 (555) 019-2834"
    assert sanitize_phone("+44 20 7946 0991") == "+44 20 7946 0991"
    assert sanitize_phone("555-123-4567") == "555-123-4567"

    # Invalid phone
    with pytest.raises(ValueError, match="Invalid phone number format"):
        sanitize_phone("invalid-phone-abc")

    # Exceeding 25 chars
    with pytest.raises(ValueError, match="cannot exceed 25 characters"):
        sanitize_phone("+12345678901234567890123456")


# ==========================================
# 4. Token Generation & Constant-Time Crypto
# ==========================================

def test_token_generation_and_hashing():
    tokens = generate_verification_token()
    assert hasattr(tokens, "otp")
    assert hasattr(tokens, "token")

    # 6-digit OTP
    assert len(tokens.otp) == 6
    assert tokens.otp.isdigit()

    # High-entropy URL-safe token (32 bytes urlsafe is 43 chars)
    assert len(tokens.token) >= 40

    # SHA-256 hash length is 64 hex characters
    hashed_otp = hash_token(tokens.otp)
    hashed_token = hash_token(tokens.token)
    assert len(hashed_otp) == 64
    assert len(hashed_token) == 64

    # Verification helper using secrets.compare_digest
    assert verify_token_hash(tokens.otp, hashed_otp) is True
    assert verify_token_hash(tokens.token, hashed_token) is True
    assert verify_token_hash("999999", hashed_otp) is False
    assert verify_token_hash("wrong-raw-token", hashed_token) is False
    assert verify_token_hash("", hashed_token) is False
    assert verify_token_hash(tokens.token, "") is False


def test_jwt_access_token_claims():
    token = create_access_token("doc-uuid-1234")
    payload = decode_access_token(token)

    assert payload["sub"] == "doc-uuid-1234"
    assert payload["type"] == "access"
    assert "jti" in payload
    # jti is a valid UUID
    uuid.UUID(payload["jti"])
    assert "exp" in payload
    assert "iat" in payload


def test_dummy_bcrypt_hash_constant_time():
    assert DUMMY_BCRYPT_HASH.startswith(("$2b$", "$2a$"))
    # Verifying against dummy hash returns False safely
    assert verify_password("AnyGuessPassword", DUMMY_BCRYPT_HASH) is False


# ==========================================
# 5. Endpoint Integration & Validation Tests
# ==========================================

def test_register_endpoint_rejects_weak_passwords(client):
    # Weak password (< 8 chars)
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "dr.valid@example.com", "password": "weak"},
    )
    assert resp.status_code == 422
    assert "at least 8 characters long" in str(resp.json())

    # Password containing email local part
    resp2 = client.post(
        "/api/v1/auth/register",
        json={"email": "dr.robert@example.com", "password": "DrRobertSecret123!"},
    )
    assert resp2.status_code == 422
    assert "must not contain parts of your email address" in str(resp2.json())

    # Disposable email
    resp3 = client.post(
        "/api/v1/auth/register",
        json={"email": "hacker@mailinator.com", "password": "ValidPassword123!"},
    )
    assert resp3.status_code == 422
    assert "Disposable or temporary email addresses are not allowed" in str(resp3.json())


def test_register_endpoint_sanitizes_full_name_and_phone(client, db_session):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr.carter@hospital.org",
            "password": "ValidPassword123!",
            "full_name": "  <b>Dr. John Carter</b>  ",
            "phone": "+1 (555) 012-3456",
        },
    )
    assert resp.status_code == 201
    data = resp.json()

    assert data["doctor"]["full_name"] == "Dr. John Carter"
    assert "access_token" in data

    # Check decoded JWT has jti and type
    payload = decode_access_token(data["access_token"])
    assert payload["type"] == "access"
    assert "jti" in payload

    # DB persistence check
    doc = db_session.query(Doctor).filter(Doctor.email == "dr.carter@hospital.org").first()
    assert doc is not None
    assert doc.full_name == "Dr. John Carter"
    assert doc.phone == "+1 (555) 012-3456"


def test_auth_service_login_calls_dummy_hash_on_missing_user(db_session, monkeypatch):
    from unittest.mock import MagicMock
    from fastapi import HTTPException
    from app.services.auth_service import auth_service
    import app.services.auth_service as auth_service_module

    mock_verify = MagicMock(return_value=False)
    monkeypatch.setattr(auth_service_module, "verify_password", mock_verify)

    with pytest.raises(HTTPException) as exc:
        auth_service.login_email(db_session, "nonexistent@example.com", "SomePassword123!")

    assert exc.value.status_code == 401
    assert "Invalid email or password" in exc.value.detail
    # Must have called verify_password with DUMMY_BCRYPT_HASH to neutralize timing attack
    mock_verify.assert_called_once_with("SomePassword123!", DUMMY_BCRYPT_HASH)


def test_auth_service_login_calls_dummy_hash_for_google_account(db_session, monkeypatch):
    from unittest.mock import MagicMock
    from fastapi import HTTPException
    from app.services.auth_service import auth_service
    import app.services.auth_service as auth_service_module

    # Create google doctor without password
    doc = Doctor(
        email="google.user@example.com",
        full_name="Dr. Google User",
        auth_provider="google",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()

    mock_verify = MagicMock(return_value=False)
    monkeypatch.setattr(auth_service_module, "verify_password", mock_verify)

    with pytest.raises(HTTPException) as exc:
        auth_service.login_email(db_session, "google.user@example.com", "GuessPassword123!")

    assert exc.value.status_code == 400
    assert "registered using Google" in exc.value.detail
    mock_verify.assert_called_once_with("GuessPassword123!", DUMMY_BCRYPT_HASH)


def test_auth_service_register_defensive_validation(db_session):
    from fastapi import HTTPException
    from app.services.auth_service import auth_service

    # Weak password
    with pytest.raises(HTTPException) as exc:
        auth_service.register_email(db_session, "test.doc@example.com", "weak")
    assert exc.value.status_code == 400
    assert "at least 8 characters long" in exc.value.detail

    # Invalid phone
    with pytest.raises(HTTPException) as exc2:
        auth_service.register_email(
            db_session,
            "test.doc2@example.com",
            "SecurePass123!",
            phone="invalid-phone-num",
        )
    assert exc2.value.status_code == 400
    assert "Invalid phone number format" in exc2.value.detail
