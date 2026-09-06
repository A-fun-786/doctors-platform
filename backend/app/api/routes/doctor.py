from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.database import get_db
from app.models.doctor import Doctor
from app.schemas.profile import (
    DoctorProfileResponse,
    DoctorProfileUpdateRequest,
    ServicesConfig,
)

router = APIRouter(prefix="/doctor", tags=["doctor"])


def _build_profile_response(doctor: Doctor) -> DoctorProfileResponse:
    tenant = doctor.tenant
    services = ServicesConfig(
        appointment=tenant.service_appointment if tenant else True,
        video_consultation=tenant.service_video_consultation if tenant else True,
        medicine_inventory=tenant.service_medicine_inventory if tenant else False,
        lab_reports=tenant.service_lab_reports if tenant else False,
    )

    return DoctorProfileResponse(
        id=doctor.id,
        email=doctor.email,
        full_name=doctor.full_name,
        phone=doctor.phone,
        avatar_url=doctor.avatar_url,
        app_icon_url=doctor.app_icon_url,
        speciality=doctor.speciality,
        bio=doctor.bio,
        onboarding_completed=doctor.onboarding_completed,
        tenant_id=tenant.id if tenant else None,
        tenant_slug=tenant.slug if tenant else None,
        clinic_name=tenant.clinic_name if tenant else None,
        location=tenant.location if tenant else None,
        services=services,
    )


@router.get("/profile", response_model=DoctorProfileResponse)
def get_doctor_profile(
    current_doctor: Doctor = Depends(get_current_doctor),
) -> DoctorProfileResponse:
    """Retrieve full practice profile and services configuration for authenticated doctor."""
    return _build_profile_response(current_doctor)


@router.put("/profile", response_model=DoctorProfileResponse)
def update_doctor_profile(
    payload: DoctorProfileUpdateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> DoctorProfileResponse:
    """Update doctor profile details, clinic information, and enabled platform services."""
    if payload.full_name is not None:
        current_doctor.full_name = payload.full_name.strip()
    if payload.phone is not None:
        current_doctor.phone = payload.phone.strip()
    if payload.avatar_url is not None:
        current_doctor.avatar_url = payload.avatar_url.strip()
    if payload.app_icon_url is not None:
        current_doctor.app_icon_url = payload.app_icon_url.strip()
    if payload.speciality is not None:
        current_doctor.speciality = payload.speciality.strip()
    if payload.bio is not None:
        current_doctor.bio = payload.bio.strip()
    if payload.onboarding_completed is not None:
        current_doctor.onboarding_completed = payload.onboarding_completed
    else:
        # Saving profile automatically completes onboarding
        current_doctor.onboarding_completed = True

    tenant = current_doctor.tenant
    if tenant:
        if payload.clinic_name is not None:
            tenant.clinic_name = payload.clinic_name.strip()
        if payload.location is not None:
            tenant.location = payload.location.strip()

        if payload.services is not None:
            tenant.service_appointment = payload.services.appointment
            tenant.service_video_consultation = payload.services.video_consultation
            tenant.service_medicine_inventory = payload.services.medicine_inventory
            tenant.service_lab_reports = payload.services.lab_reports

    db.add(current_doctor)
    if tenant:
        db.add(tenant)
    db.commit()
    db.refresh(current_doctor)
    if tenant:
        db.refresh(tenant)

    return _build_profile_response(current_doctor)
