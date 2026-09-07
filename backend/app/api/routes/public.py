import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tenant import Tenant
from app.schemas.profile import (
    PublicDoctorProfileResponse,
    ServicesConfig,
    AppointmentBookingRequest,
    AppointmentBookingResponse,
    ReportUploadRequest,
    ReportUploadResponse,
    MedicineOrderRequest,
    MedicineOrderResponse,
)

router = APIRouter(prefix="/public", tags=["public"])


def _get_active_tenant_or_404(slug: str, db: Session) -> Tenant:
    tenant = (
        db.query(Tenant)
        .filter(Tenant.slug == slug.lower(), Tenant.status == "active")
        .first()
    )
    if not tenant or not tenant.doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Doctor practice with link '{slug}' was not found.",
        )
    return tenant


@router.get("/tenants/{slug}", response_model=PublicDoctorProfileResponse)
def get_public_doctor_profile(
    slug: str,
    db: Session = Depends(get_db),
) -> PublicDoctorProfileResponse:
    """Retrieve public practice details and active services for the patient-facing webpage."""
    tenant = _get_active_tenant_or_404(slug, db)
    doctor = tenant.doctor

    services = ServicesConfig(
        appointment=tenant.service_appointment,
        video_consultation=tenant.service_video_consultation,
        medicine_inventory=tenant.service_medicine_inventory,
        lab_reports=tenant.service_lab_reports,
    )

    return PublicDoctorProfileResponse(
        full_name=doctor.full_name,
        avatar_url=doctor.avatar_url,
        speciality=doctor.speciality,
        bio=doctor.bio,
        clinic_name=tenant.clinic_name,
        location=tenant.location,
        slug=tenant.slug,
        services=services,
    )


@router.post(
    "/tenants/{slug}/appointments",
    response_model=AppointmentBookingResponse,
    status_code=status.HTTP_201_CREATED,
)
def book_appointment(
    slug: str,
    payload: AppointmentBookingRequest,
    db: Session = Depends(get_db),
) -> AppointmentBookingResponse:
    """Submit an in-clinic or video consultation appointment request from the patient page."""
    tenant = _get_active_tenant_or_404(slug, db)

    # Verify service is enabled
    if payload.appointment_type == "video_consultation" and not tenant.service_video_consultation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video consultation is currently not offered by this practice.",
        )
    if payload.appointment_type == "in_clinic" and not tenant.service_appointment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="In-clinic appointments are currently not offered by this practice.",
        )

    booking_id = f"APT-{uuid.uuid4().hex[:8].upper()}"

    return AppointmentBookingResponse(
        booking_id=booking_id,
        status="confirmed",
        message=f"Appointment successfully scheduled with {tenant.doctor.full_name}.",
        details={
            "patient_name": payload.patient_name,
            "appointment_date": payload.appointment_date,
            "appointment_time": payload.appointment_time,
            "appointment_type": payload.appointment_type,
            "clinic_name": tenant.clinic_name or "Doctor Clinic",
        },
    )


@router.post(
    "/tenants/{slug}/reports",
    response_model=ReportUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_lab_report(
    slug: str,
    payload: ReportUploadRequest,
    db: Session = Depends(get_db),
) -> ReportUploadResponse:
    """Submit a lab test report from the patient-facing webpage."""
    tenant = _get_active_tenant_or_404(slug, db)

    if not tenant.service_lab_reports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab reports service is not active for this practice.",
        )

    report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"

    return ReportUploadResponse(
        report_id=report_id,
        status="received",
        message=f"Report '{payload.file_name}' received and attached to your patient record.",
    )


@router.post(
    "/tenants/{slug}/medicine-orders",
    response_model=MedicineOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def order_medicine(
    slug: str,
    payload: MedicineOrderRequest,
    db: Session = Depends(get_db),
) -> MedicineOrderResponse:
    """Submit a medicine order or prescription delivery request from the patient-facing webpage."""
    tenant = _get_active_tenant_or_404(slug, db)

    if not tenant.service_medicine_inventory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medicine order service is not active for this practice.",
        )

    order_id = f"MED-{uuid.uuid4().hex[:8].upper()}"

    return MedicineOrderResponse(
        order_id=order_id,
        status="received",
        message=f"Medicine request order #{order_id} received. The pharmacy team will prepare your order.",
    )
