import uuid
from datetime import date
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.schemas.schedule import (
    ScheduleCreateRequest,
    ScheduleBulkCreateRequest,
    ScheduleResponse,
    ScheduleListResponse,
    AvailableSlotResponse,
)
from app.services import schedule_service

settings = get_settings()

router = APIRouter(tags=["schedule"])


@router.post(
    "/doctor/schedule",
    response_model=Union[ScheduleResponse, List[ScheduleResponse]],
    status_code=status.HTTP_201_CREATED,
    summary="Create Doctor Schedule Entry / Entries",
)
@limiter.limit(settings.RATE_LIMIT_SCHEDULE)
def create_schedule(
    request: Request,
    payload: Union[ScheduleCreateRequest, List[ScheduleCreateRequest], ScheduleBulkCreateRequest],
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Create single or bulk schedule entries for the authenticated doctor.
    Enforces time order and rejects overlapping AVAILABLE windows.
    """
    if isinstance(payload, ScheduleBulkCreateRequest):
        created = schedule_service.create_schedule_entries(
            doctor_id=current_doctor.id,
            entries=payload.entries,
            db=db,
        )
        return [ScheduleResponse.model_validate(item) for item in created]
    elif isinstance(payload, list):
        created = schedule_service.create_schedule_entries(
            doctor_id=current_doctor.id,
            entries=payload,
            db=db,
        )
        return [ScheduleResponse.model_validate(item) for item in created]
    else:
        created = schedule_service.create_schedule_entries(
            doctor_id=current_doctor.id,
            entries=[payload],
            db=db,
        )
        return ScheduleResponse.model_validate(created[0])


@router.get(
    "/doctor/schedule",
    response_model=ScheduleListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Doctor Schedule",
)
def get_doctor_schedule(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Retrieve paginated schedule entries for the authenticated doctor.
    Supports filtering by date range (from / to).
    """
    items, total = schedule_service.get_schedule(
        doctor_id=current_doctor.id,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
        db=db,
    )
    return ScheduleListResponse(
        items=[ScheduleResponse.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.delete(
    "/doctor/schedule/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Doctor Schedule Entry",
)
def delete_doctor_schedule(
    schedule_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Delete a specific schedule entry by ID for the authenticated doctor.
    """
    schedule_service.delete_schedule_entry(
        doctor_id=current_doctor.id,
        schedule_id=schedule_id,
        db=db,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/doctor/available-slots",
    response_model=List[AvailableSlotResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Available Slots for Authenticated Doctor",
)
def get_doctor_available_slots(
    date: date = Query(..., description="Query date for available slots"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Generate available 30-minute booking slots for the authenticated doctor.
    """
    slots = schedule_service.generate_available_slots(
        doctor_id=current_doctor.id,
        query_date=date,
        db=db,
    )
    return [AvailableSlotResponse(**slot) for slot in slots]


@router.get(
    "/public/tenants/{slug}/available-slots",
    response_model=List[AvailableSlotResponse],
    status_code=status.HTTP_200_OK,
    summary="Public Available Slots for Doctor Practice",
)
@limiter.limit(settings.RATE_LIMIT_SCHEDULE)
def get_public_available_slots(
    request: Request,
    slug: str,
    date: date = Query(..., description="Query date for available slots"),
    db: Session = Depends(get_db),
):
    """
    Public, rate-limited endpoint returning available 30-minute slots for a tenant practice.
    """
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

    slots = schedule_service.generate_available_slots(
        doctor_id=tenant.doctor.id,
        query_date=date,
        db=db,
    )
    return [AvailableSlotResponse(**slot) for slot in slots]
