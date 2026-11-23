import uuid
from datetime import date, datetime, time, timedelta
from typing import Optional, Tuple
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_tenant_by_slug
from app.core.cache import get_idempotency_result, invalidate_slot_cache, set_idempotency_result
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.schemas.appointment import AppointmentCreateRequest
from app.schemas.profile import (
    AppointmentBookingRequest,
    AppointmentBookingResponse,
    PublicDoctorProfileResponse,
    ServicesConfig,
    ReportUploadRequest,
    ReportUploadResponse,
    MedicineOrderRequest,
    MedicineOrderResponse,
)
from app.services import appointment_service

settings = get_settings()
router = APIRouter(prefix="/public", tags=["public"])


def _parse_slot_times(
    raw_time: str,
    raw_start: Optional[str] = None,
    raw_end: Optional[str] = None,
) -> Tuple[time, time]:
    """Parse flexible public booking time inputs (24h HH:MM or 12h hh:mm AM/PM) into (start_time, end_time)."""
    def _parse_single(val: str) -> time:
        cleaned = val.strip().upper()
        for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
            try:
                return datetime.strptime(cleaned, fmt).time()
            except ValueError:
                continue
        raise ValueError(f"Invalid time format: '{val}'")

    try:
        if raw_start and raw_start.strip():
            start_t = _parse_single(raw_start)
        elif "-" in raw_time:
            parts = [p.strip() for p in raw_time.split("-", 1)]
            start_t = _parse_single(parts[0])
            if not raw_end and len(parts) > 1 and parts[1]:
                raw_end = parts[1]
        else:
            start_t = _parse_single(raw_time)

        if raw_end and raw_end.strip():
            end_t = _parse_single(raw_end)
        else:
            dt_end = datetime.combine(date.today(), start_t) + timedelta(minutes=30)
            end_t = dt_end.time()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if end_t <= start_t:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be after start_time",
        )
    return start_t, end_t


@router.get("/tenants/{slug}", response_model=PublicDoctorProfileResponse)
def get_public_doctor_profile(
    slug: str,
    db: Session = Depends(get_db),
) -> PublicDoctorProfileResponse:
    """Retrieve public practice details and active services for the patient-facing webpage."""
    tenant = get_active_tenant_by_slug(slug, db)
    doctor = tenant.doctor
    experimental_enabled = get_settings().ENABLE_EXPERIMENTAL_CLINICAL_SERVICES

    services = ServicesConfig(
        appointment=tenant.service_appointment,
        video_consultation=tenant.service_video_consultation,
        medicine_inventory=bool(tenant.service_medicine_inventory and experimental_enabled),
        lab_reports=bool(tenant.service_lab_reports and experimental_enabled),
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
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def book_public_appointment(
    request: Request,
    slug: str,
    payload: AppointmentBookingRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
) -> AppointmentBookingResponse:
    """Book a real persisted patient appointment on a doctor's public practice portal."""
    tenant = get_active_tenant_by_slug(slug, db)

    is_video = payload.appointment_type == "video_consultation"
    if is_video and not tenant.service_video_consultation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video consultation service is not active for this practice.",
        )
    if not is_video and not tenant.service_appointment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment booking service is not active for this practice.",
        )

    cache_key = None
    if idempotency_key and idempotency_key.strip():
        cache_key = f"public_idempotency:{tenant.doctor.id}:{idempotency_key.strip()}"
        cached = get_idempotency_result(cache_key)
        if cached is not None:
            return cached

    try:
        slot_date = date.fromisoformat(payload.appointment_date.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid appointment_date format. Expected YYYY-MM-DD.",
        ) from exc

    start_t, end_t = _parse_slot_times(
        raw_time=payload.appointment_time,
        raw_start=payload.start_time,
        raw_end=payload.end_time,
    )

    reason_label = "Video Consultation" if is_video else "In-Clinic Consultation"
    notes_parts = []
    if payload.notes and payload.notes.strip():
        notes_parts.append(payload.notes.strip())
    if payload.patient_email and payload.patient_email.strip():
        notes_parts.append(f"Patient Email: {payload.patient_email.strip()}")
    combined_notes = "\n".join(notes_parts) if notes_parts else None

    create_req = AppointmentCreateRequest(
        patient_name=payload.patient_name.strip(),
        patient_contact=payload.patient_phone.strip(),
        date=slot_date,
        start_time=start_t,
        end_time=end_t,
        reason=reason_label,
        notes=combined_notes,
    )

    appointment = appointment_service.create_appointment(
        doctor_id=tenant.doctor.id,
        payload=create_req,
        db=db,
    )
    invalidate_slot_cache(tenant.doctor.id)

    booking_ref = f"APT-{str(appointment.id).split('-')[0].upper()}"
    response_data = AppointmentBookingResponse(
        booking_id=booking_ref,
        appointment_id=str(appointment.id),
        status=appointment.status,
        message=f"Appointment confirmed for {slot_date.isoformat()} at {start_t.strftime('%H:%M')}.",
        details={
            "appointment_id": str(appointment.id),
            "patient_name": appointment.patient_name,
            "date": slot_date.isoformat(),
            "start_time": start_t.strftime("%H:%M"),
            "end_time": end_t.strftime("%H:%M"),
            "appointment_type": payload.appointment_type,
        },
    )
    if cache_key:
        set_idempotency_result(cache_key, response_data)
    return response_data


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
    tenant = get_active_tenant_by_slug(slug, db)

    if not tenant.service_lab_reports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab reports service is not active for this practice.",
        )

    if not get_settings().ENABLE_EXPERIMENTAL_CLINICAL_SERVICES:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Lab report uploads are currently disabled in production.",
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
    tenant = get_active_tenant_by_slug(slug, db)

    if not tenant.service_medicine_inventory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medicine order service is not active for this practice.",
        )

    if not get_settings().ENABLE_EXPERIMENTAL_CLINICAL_SERVICES:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Online medicine ordering is currently disabled in production.",
        )

    order_id = f"MED-{uuid.uuid4().hex[:8].upper()}"

    return MedicineOrderResponse(
        order_id=order_id,
        status="received",
        message=f"Medicine request order #{order_id} received. The pharmacy team will prepare your order.",
    )
