from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.database import get_db
from app.models.doctor import Doctor
from app.schemas.auth import (
    GoogleAuthRequest,
    AuthResponse,
    DoctorMeResponse,
    TenantResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/google",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Google Sign-In / Registration",
    description="Authenticate a doctor with a Google ID token. Auto-registers new doctors with an isolated tenant workspace.",
)
def google_auth(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Authenticate or register doctor using Google ID token."""
    return auth_service.authenticate_google(db=db, credential=payload.credential)


@router.get(
    "/me",
    response_model=DoctorMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current Doctor",
    description="Retrieve profile and tenant details of the currently authenticated doctor.",
)
def get_me(
    current_doctor: Doctor = Depends(get_current_doctor),
) -> DoctorMeResponse:
    """Return currently logged-in doctor profile and workspace tenant."""
    return DoctorMeResponse(
        id=current_doctor.id,
        full_name=current_doctor.full_name,
        email=current_doctor.email,
        avatar_url=current_doctor.avatar_url,
        auth_provider=current_doctor.auth_provider,
        tenant=TenantResponse.model_validate(current_doctor.tenant) if current_doctor.tenant else None,
    )
