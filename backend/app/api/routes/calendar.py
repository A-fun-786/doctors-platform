import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor, is_staff_doctor
from app.core.database import get_db
from app.models.doctor import Doctor
from app.schemas.calendar import DoctorCalendarResponse
from app.services import calendar_service

router = APIRouter(tags=["calendar"])


@router.get(
    "/doctor/calendar",
    response_model=DoctorCalendarResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Get Doctor Unified Operational Calendar",
)
def get_doctor_calendar(
    from_date: date = Query(..., alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., alias="to", description="End date (YYYY-MM-DD)"),
    staff_id: Optional[str] = Query(None, description="Filter calendar by staff member UUID or 'primary'"),
    primary_only: Optional[bool] = Query(None, description="Filter calendar by primary doctor only"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """
    Retrieve unified operational calendar for the authenticated doctor,
    aggregating working hours, available slots, bookings, leave, holidays, and blocks.
    Max query range: 31 days.
    """
    if to_date < from_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'to' date must be on or after 'from' date",
        )

    if (to_date - from_date).days > 31:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range exceeds 31 days",
        )

    target_staff_id: Optional[uuid.UUID] = None

    # Staff Doctor restriction: can only see their own bookings
    if is_staff_doctor(current_doctor):
        target_staff_id = current_doctor._current_staff.id
        primary_only = False
    elif staff_id:
        normalized = staff_id.strip().lower()
        if normalized in ("primary", "owner"):
            primary_only = True
            target_staff_id = None
        elif normalized in ("all", "none", ""):
            target_staff_id = None
        else:
            try:
                target_staff_id = uuid.UUID(staff_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid staff_id format. Must be a valid UUID or 'primary'.",
                )

    return calendar_service.get_doctor_calendar(
        doctor_id=current_doctor.id,
        from_date=from_date,
        to_date=to_date,
        db=db,
        staff_id=target_staff_id,
        primary_only=primary_only,
    )
