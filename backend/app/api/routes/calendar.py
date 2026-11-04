from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
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

    return calendar_service.get_doctor_calendar(
        doctor_id=current_doctor.id,
        from_date=from_date,
        to_date=to_date,
        db=db,
    )
