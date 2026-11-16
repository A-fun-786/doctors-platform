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


def validate_identifier(identifier: str) -> str:
    """Validate an authentication identifier (either RFC-compliant email or alphanumeric username)."""
    if not isinstance(identifier, str):
        raise ValueError("Invalid login identifier.")
    cleaned = identifier.strip().lower()
    if not cleaned:
        raise ValueError("Login identifier cannot be empty.")
    if "@" in cleaned:
        return validate_email_id(cleaned)
    if not (3 <= len(cleaned) <= 60 and USERNAME_REGEX.match(cleaned)):
        raise ValueError("User ID must be between 3 and 60 alphanumeric characters (dots, underscores, and hyphens allowed).")
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
            if "@" in cleaned:
                validate_email_id(cleaned)
            elif not (3 <= len(cleaned) <= 60 and USERNAME_REGEX.match(cleaned)):
                raise ValueError("User ID must be between 3 and 60 alphanumeric characters.")
        else:
            # Default and Admin portals require a valid RFC-compliant email address
            validate_email_id(cleaned)
        self.email = cleaned
        return self


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str


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
