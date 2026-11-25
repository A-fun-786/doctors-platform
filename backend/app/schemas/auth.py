import re
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$"
)
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9._-]+$")


def validate_email_id(email: str) -> str:
    """Validate that the provided string is a well-formed, RFC-compliant email address."""
    if not isinstance(email, str):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")
    cleaned = email.strip().lower()
    if not cleaned or not EMAIL_REGEX.match(cleaned):
        raise ValueError("Invalid email address format. Please provide a valid email ID.")
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


# Extensible schema for email/username/password login
class EmailLoginRequest(BaseModel):
    email: str  # Functions as identifier: User ID (staff) or Email (admin/default)
    password: str
    portal_type: Optional[str] = None

    @model_validator(mode="after")
    def validate_identifier(self) -> "EmailLoginRequest":
        cleaned = self.email.strip().lower()
        if self.portal_type == "staff":
            if not (3 <= len(cleaned) <= 60 and USERNAME_REGEX.match(cleaned)):
                raise ValueError("Invalid User ID or password")
        else:
            # Default and Admin portals require a valid RFC-compliant email address
            validate_email_id(cleaned)
        self.email = cleaned
        return self


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str


COMMON_EASY_PASSWORDS = {
    "password", "password123", "admin123", "12345678", "123456789",
    "qwerty123", "letmein123", "welcome123", "doctor123", "clinic123"
}


def validate_strong_password(v: str) -> str:
    """Validate that the provided password meets enterprise strength criteria."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter (A-Z)")
    if not any(c.islower() for c in v):
        raise ValueError("Password must contain at least one lowercase letter (a-z)")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one number (0-9)")
    if not any(c in r"""!@#$%^&*()-_=+[]{};:'",.<>/?\\|`~""" for c in v):
        raise ValueError("Password must contain at least one special character (!@#$%^&*)")
    if v.lower() in COMMON_EASY_PASSWORDS:
        raise ValueError("Password is too common or easy to guess. Please choose a stronger password.")
    return v


class ChangePasswordRequest(BaseModel):
    new_password: str
    current_password: Optional[str] = None

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return validate_strong_password(v)


class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: str = "google"
    onboarding_completed: bool = False
    role: Optional[str] = "Doctor"
    user_type: Optional[str] = "doctor"  # "doctor" | "staff"
    staff_id: Optional[uuid.UUID] = None
    must_change_password: Optional[bool] = False


class AuthResponse(BaseModel):
    """Response returned upon successful authentication / registration."""
    access_token: str
    token_type: str = "bearer"
    doctor: DoctorResponse
    tenant: TenantResponse


class DoctorMeResponse(BaseModel):
    """Response returned by protected /me endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    speciality: Optional[str] = None
    bio: Optional[str] = None
    onboarding_completed: bool = False
    auth_provider: str = "google"
    tenant: Optional[TenantResponse] = None
    role: Optional[str] = "Doctor"
    user_type: Optional[str] = "doctor"  # "doctor" | "staff"
    staff_id: Optional[uuid.UUID] = None
    can_manage_staff: Optional[bool] = True
    must_change_password: Optional[bool] = False
