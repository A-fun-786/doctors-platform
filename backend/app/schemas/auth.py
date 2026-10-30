import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "throwawaymail.com",
    "yopmail.com",
    "trashmail.com",
    "sharklasers.com",
    "getairmail.com",
    "temp-mail.org",
    "fakeinbox.com",
    "dispostable.com",
}

FORBIDDEN_EMAIL_SUBSTRINGS = ["'", '"', "<", ">", ";", "--", "/*", "*/", "\\"]

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$"
)

COMMON_BREACHED_PASSWORDS = {
    "password",
    "password123",
    "password1234",
    "12345678",
    "123456789",
    "qwertyuiop",
    "qwerty123",
    "admin123",
    "admin1234",
    "welcome123",
    "letmein123",
    "doctor123",
    "doctor1234",
    "hospital123",
    "Password123!",
    "Password1234!",
    "Admin123!",
    "Welcome123!",
}

PHONE_REGEX = re.compile(r"^\+?[0-9\s\-().]{7,25}$")


def validate_email_id(email: str) -> str:
    """
    Validate that the provided string is a well-formed, RFC-compliant email address.
    Enforces RFC 5321 length limits, rejects disposable domains, control characters,
    unicode homographs, and SQL/XSS payloads.
    """
    if not isinstance(email, str):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    cleaned = email.strip().lower()
    if not cleaned or len(cleaned) > 254:
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    # Reject non-ASCII / Unicode homographs
    try:
        cleaned.encode("ascii")
    except UnicodeEncodeError:
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    # Reject control and null characters
    if any(ord(c) <= 31 or ord(c) == 127 for c in cleaned):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    # Reject SQL / XSS injection markers
    if any(pattern in cleaned for pattern in FORBIDDEN_EMAIL_SUBSTRINGS):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    if cleaned.count("@") != 1:
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    local_part, domain = cleaned.split("@", 1)

    if not local_part or len(local_part) > 64:
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    if not domain or len(domain) > 253:
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    # Disallow consecutive dots or leading/trailing dots in local part or domain
    if ".." in cleaned or local_part.startswith(".") or local_part.endswith(".") or domain.startswith(".") or domain.endswith("."):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    if not EMAIL_REGEX.match(cleaned):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")

    if domain in DISPOSABLE_EMAIL_DOMAINS:
        raise ValueError("Disposable or temporary email addresses are not allowed. Please provide a valid email ID.")

    return cleaned


def validate_password_strength(password: str, email: Optional[str] = None) -> str:
    """
    Validate password meets platform security policy:
    - Minimum 8 characters, maximum 72 bytes (bcrypt truncation/DoS prevention).
    - Requires 1 uppercase, 1 lowercase, 1 digit, and 1 special character (or passphrase >= 16 chars).
    - Rejects whitespace-only passwords.
    - Rejects passwords matching user's email local-part.
    - Rejects common breached passwords.
    """
    if not isinstance(password, str) or not password.strip():
        raise ValueError("Password cannot be empty or whitespace-only.")

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")

    # 72-byte UTF-8 limit for bcrypt
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password cannot exceed 72 bytes.")

    # Check common breached passwords
    if password.lower() in {p.lower() for p in COMMON_BREACHED_PASSWORDS}:
        raise ValueError("This password is too common and easily guessable. Please choose a more secure password.")

    # Passphrase check (>= 16 characters bypasses character class requirements)
    if len(password) < 16:
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(not c.isalnum() and not c.isspace() for c in password)

        if not (has_upper and has_lower and has_digit and has_special):
            raise ValueError(
                "Password must contain at least one uppercase letter, one lowercase letter, "
                "one digit, and one special character (or be a passphrase of 16+ characters)."
            )

    # Check against email local-part if email is provided
    if email and isinstance(email, str) and "@" in email:
        local_part = email.split("@")[0].lower().strip()
        tokens = [t for t in re.split(r"[._\-+]", local_part) if len(t) >= 3]
        if len(local_part) >= 3:
            tokens.append(local_part)
        lower_pwd = password.lower()
        for token in tokens:
            if token in lower_pwd:
                raise ValueError("Password must not contain parts of your email address.")

    return password


def sanitize_full_name(name: Optional[str]) -> Optional[str]:
    """Sanitize and validate doctor's full name (strip HTML/control chars, 2-120 chars)."""
    if name is None:
        return None
    # Strip control characters
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    # Remove script and style blocks entirely
    cleaned = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    # Strip remaining HTML tags
    cleaned = re.sub(r"<[^>]*>", "", cleaned).strip()
    # Normalize multiple whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return None
    if len(cleaned) < 2 or len(cleaned) > 120:
        raise ValueError("Full name must be between 2 and 120 characters.")
    return cleaned


def sanitize_phone(phone: Optional[str]) -> Optional[str]:
    """Sanitize and validate doctor's phone number (E.164 or clinic standard, max 25 chars)."""
    if phone is None:
        return None
    cleaned = phone.strip()
    if not cleaned:
        return None
    if len(cleaned) > 25:
        raise ValueError("Phone number cannot exceed 25 characters.")
    if not PHONE_REGEX.match(cleaned):
        raise ValueError("Invalid phone number format.")
    return cleaned


class GoogleAuthRequest(BaseModel):
    """Payload sent by frontend containing Google ID Token."""
    credential: str


class EmailRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_valid_email(cls, v: str) -> str:
        return validate_email_id(v)

    @field_validator("password")
    @classmethod
    def check_valid_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @field_validator("full_name")
    @classmethod
    def check_valid_full_name(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_full_name(v)

    @field_validator("phone")
    @classmethod
    def check_valid_phone(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_phone(v)

    @model_validator(mode="after")
    def check_password_not_in_email(self) -> "EmailRegisterRequest":
        if self.email and self.password:
            validate_password_strength(self.password, email=self.email)
        return self


# Extensible schema for email/password login
class EmailLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def check_valid_email(cls, v: str) -> str:
        return validate_email_id(v)


class VerifyEmailRequest(BaseModel):
    """Payload to verify email address via 6-digit OTP or URL-safe token."""
    email: Optional[str] = None
    code: Optional[str] = None
    token: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_email_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return validate_email_id(v)
        return v

    @model_validator(mode="after")
    def check_at_least_one_token_or_code(self) -> "VerifyEmailRequest":
        raw = (self.code or self.token or "").strip()
        if not raw:
            raise ValueError("Verification code or token is required.")
        return self


class ResendVerificationRequest(BaseModel):
    """Payload to request a fresh verification email / OTP."""
    email: str

    @field_validator("email")
    @classmethod
    def check_valid_email(cls, v: str) -> str:
        return validate_email_id(v)


class VerificationMessageResponse(BaseModel):
    """Generic status response for verification events."""
    message: str
    email: Optional[str] = None


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str


class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    auth_provider: str = "google"
    onboarding_completed: bool = False
    email_verified: bool = False
    email_verified_at: Optional[datetime] = None


class AuthResponse(BaseModel):
    """Response returned upon successful authentication / registration."""
    access_token: str
    token_type: str = "bearer"
    doctor: DoctorResponse
    tenant: TenantResponse
    verification_email_sent: Optional[bool] = None


class DoctorMeResponse(BaseModel):
    """Response returned by protected /me endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    speciality: Optional[str] = None
    bio: Optional[str] = None
    onboarding_completed: bool = False
    auth_provider: str = "google"
    email_verified: bool = False
    email_verified_at: Optional[datetime] = None
    tenant: Optional[TenantResponse] = None

