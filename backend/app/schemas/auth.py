import re
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$"
)


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


# Extensible schema for email/password login
class EmailLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def check_valid_email(cls, v: str) -> str:
        return validate_email_id(v)


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
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    speciality: Optional[str] = None
    bio: Optional[str] = None
    onboarding_completed: bool = False
    auth_provider: str = "google"
    tenant: Optional[TenantResponse] = None
