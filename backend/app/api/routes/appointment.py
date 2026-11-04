import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.cache import get_idempotency_result, set_idempotency_result, invalidate_slot_cache
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.doctor import Doctor
from app.schemas.appointment import (
    AppointmentCreateRequest,
    AppointmentRescheduleRequest,
    AppointmentResponse,
    AppointmentListResponse,
)
from app.services import appointment_service

settings = get_settings()

router = APIRouter(tags=["appointment"])


@router.post(
    "/doctor/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Doctor Appointment",
)
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def create_appointment(
    request: Request,
    payload: AppointmentCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Create a new appointment for the authenticated doctor.
    Verifies slot falls within AVAILABLE schedule and does not overlap exclusions or existing bookings.
    Supports optional Idempotency-Key header to prevent duplicate booking on network retries.
    """
    cache_key = None
    if idempotency_key:
        cache_key = f"idempotency:{current_doctor.id}:{idempotency_key}"
        cached = get_idempotency_result(cache_key)
        if cached is not None:
            return cached

    appointment = appointment_service.create_appointment(
        doctor_id=current_doctor.id,
        payload=payload,
        db=db,
    )
    invalidate_slot_cache(current_doctor.id)
    response_data = AppointmentResponse.model_validate(appointment)
    if cache_key:
        set_idempotency_result(cache_key, response_data)
    return response_data


@router.get(
    "/doctor/appointments",
    response_model=AppointmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Doctor Appointments",
)
def list_appointments(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by status (BOOKED, COMPLETED, CANCELLED)"),
    from_date: Optional[date] = Query(None, alias="from", description="Filter from date"),
    to_date: Optional[date] = Query(None, alias="to", description="Filter to date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    List appointments for the authenticated doctor with pagination and optional filters.
    """
    items, total = appointment_service.list_appointments(
        doctor_id=current_doctor.id,
        status_filter=status,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
        db=db,
    )
    return AppointmentListResponse(
        items=[AppointmentResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get(
    "/doctor/appointments/{id}",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Single Doctor Appointment",
)
def get_appointment(
    id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Retrieve single appointment for the authenticated doctor.
    """
    appointment = appointment_service.get_appointment(
        doctor_id=current_doctor.id,
        appointment_id=id,
        db=db,
    )
    return AppointmentResponse.model_validate(appointment)


@router.post(
    "/doctor/appointments/{id}/cancel",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel Doctor Appointment",
)
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def cancel_appointment(
    request: Request,
    id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Cancel an existing BOOKED appointment.
    """
    appointment = appointment_service.cancel_appointment(
        doctor_id=current_doctor.id,
        appointment_id=id,
        db=db,
    )
    invalidate_slot_cache(current_doctor.id)
    return AppointmentResponse.model_validate(appointment)


@router.post(
    "/doctor/appointments/{id}/complete",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete Doctor Appointment",
)
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def complete_appointment(
    request: Request,
    id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Complete an existing BOOKED appointment.
    """
    appointment = appointment_service.complete_appointment(
        doctor_id=current_doctor.id,
        appointment_id=id,
        db=db,
    )
    return AppointmentResponse.model_validate(appointment)


@router.patch(
    "/doctor/appointments/{id}",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Reschedule Doctor Appointment",
)
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def reschedule_appointment(
    request: Request,
    id: uuid.UUID,
    payload: AppointmentRescheduleRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Reschedule an existing BOOKED appointment to a new date and time slot.
    """
    appointment = appointment_service.reschedule_appointment(
        doctor_id=current_doctor.id,
        appointment_id=id,
        payload=payload,
        db=db,
    )
    invalidate_slot_cache(current_doctor.id)
    return AppointmentResponse.model_validate(appointment)
