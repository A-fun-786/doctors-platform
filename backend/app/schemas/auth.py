import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict


class GoogleAuthRequest(BaseModel):
    """Payload sent by frontend containing Google ID Token."""
    credential: str


# Extensible schema for future email/password registration
class EmailRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    phone: Optional[str] = None


# Extensible schema for future email/password login
class EmailLoginRequest(BaseModel):
    email: str
    password: str


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
    avatar_url: Optional[str] = None
    auth_provider: str = "google"
    tenant: Optional[TenantResponse] = None
