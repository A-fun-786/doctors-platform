from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.models.doctor import Doctor
from app.schemas.auth import (
    GoogleAuthRequest,
    EmailRegisterRequest,
    EmailLoginRequest,
    AuthResponse,
    DoctorMeResponse,
    TenantResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()
logger = get_logger("auth")


@router.post(
    "/google",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Google Sign-In / Registration",
    description="Authenticate a doctor with a Google ID token. Auto-registers new doctors with an isolated tenant workspace.",
)
@limiter.limit(settings.RATE_LIMIT_AUTH_GOOGLE)
def google_auth(
    request: Request,
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Authenticate or register doctor using Google ID token."""
    return auth_service.authenticate_google(db=db, credential=payload.credential)


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Doctor Email Registration",
    description="Register a new doctor account with email and password. Automatically creates isolated tenant workspace.",
)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def email_register(
    request: Request,
    payload: EmailRegisterRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Register doctor using email and password."""
    return auth_service.register_email(
        db=db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        phone=payload.phone,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Doctor Email Login",
    description="Authenticate an existing doctor with email and password.",
)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def email_login(
    request: Request,
    payload: EmailLoginRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Authenticate doctor using email and password."""
    return auth_service.login_email(
        db=db,
        email=payload.email,
        password=payload.password,
        portal_type=payload.portal_type,
    )



@router.get(
    "/me",
    response_model=DoctorMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current Doctor",
    description="Retrieve profile and tenant details of the currently authenticated doctor or staff member.",
)
def get_me(
    current_doctor: Doctor = Depends(get_current_doctor),
) -> DoctorMeResponse:
    """Return currently logged-in doctor profile and workspace tenant."""
    if getattr(current_doctor, "_is_staff", False):
        staff = current_doctor._current_staff
        return DoctorMeResponse(
            id=staff.id,
            full_name=staff.full_name,
            email=staff.email or "",
            phone=staff.phone,
            avatar_url=None,
            speciality=staff.department,
            bio=staff.notes,
            onboarding_completed=True,
            auth_provider="email",
            tenant=TenantResponse.model_validate(current_doctor.tenant) if current_doctor.tenant else None,
            role=staff.role,
            user_type="staff",
            staff_id=staff.id,
            can_manage_staff=False,
            must_change_password=staff.must_change_password,
        )

    return DoctorMeResponse(
        id=current_doctor.id,
        full_name=current_doctor.full_name,
        email=current_doctor.email,
        phone=current_doctor.phone,
        avatar_url=current_doctor.avatar_url,
        speciality=current_doctor.speciality,
        bio=current_doctor.bio,
        onboarding_completed=current_doctor.onboarding_completed,
        auth_provider=current_doctor.auth_provider,
        tenant=TenantResponse.model_validate(current_doctor.tenant) if current_doctor.tenant else None,
        role="Doctor",
        user_type="doctor",
        staff_id=None,
        can_manage_staff=True,
        must_change_password=False,
    )
