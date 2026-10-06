import uuid
from datetime import date, time
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.schedule import Schedule
from app.schemas.appointment import (
    AppointmentCreateRequest,
    AppointmentRescheduleRequest,
)


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _validate_slot_against_schedule(
    doctor_id: uuid.UUID,
    slot_date: date,
    start_time: time,
    end_time: time,
    db: Session,
    is_reschedule: bool = False,
) -> None:
    """
    Validate that [start_time, end_time) falls cleanly within an AVAILABLE window
    and does not overlap any LEAVE, HOLIDAY, or BLOCKED period.
    """
    s_start = _time_to_minutes(start_time)
    s_end = _time_to_minutes(end_time)

    # 1. Check AVAILABLE schedules
    available_schedules = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == slot_date,
            Schedule.type == "AVAILABLE",
        )
        .all()
    )

    if not available_schedules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No AVAILABLE schedule window for this date",
        )

    in_available_window = False
    for sched in available_schedules:
        w_start = _time_to_minutes(sched.start_time)
        w_end = _time_to_minutes(sched.end_time)
        if s_start >= w_start and s_end <= w_end:
            in_available_window = True
            break

    if not in_available_window:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slot does not fall within any AVAILABLE schedule window",
        )

    # 2. Check exclusions: LEAVE, HOLIDAY, BLOCKED
    exclusions = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == slot_date,
            Schedule.type.in_(["LEAVE", "HOLIDAY", "BLOCKED"]),
        )
        .all()
    )

    for excl in exclusions:
        e_start = _time_to_minutes(excl.start_time)
        e_end = _time_to_minutes(excl.end_time)
        if excl.end_time >= time(23, 59):
            e_end = 24 * 60

        if s_start < e_end and s_end > e_start:
            prefix = "Target slot overlaps" if is_reschedule else "Slot overlaps with"
            if excl.type == "LEAVE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{prefix} LEAVE" if is_reschedule else "Slot overlaps with LEAVE period",
                )
            elif excl.type == "HOLIDAY":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{prefix} HOLIDAY",
                )
            elif excl.type == "BLOCKED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{prefix} BLOCKED period" if is_reschedule else "Slot overlaps with BLOCKED period",
                )


def create_appointment(
    doctor_id: uuid.UUID,
    payload: AppointmentCreateRequest,
    db: Session,
) -> Appointment:
    """
    Create a new appointment:
    - Validate schedule availability and absence of exclusions
    - Validate slot is not already BOOKED
    - Insert with status = BOOKED
    - Catch race-condition IntegrityError from unique index and return 409
    """
    _validate_slot_against_schedule(
        doctor_id=doctor_id,
        slot_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        db=db,
        is_reschedule=False,
    )

    # Check existing BOOKED appointment at same slot
    existing = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == payload.date,
            Appointment.start_time == payload.start_time,
            Appointment.status == "BOOKED",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot already booked",
        )

    appointment = Appointment(
        doctor_id=doctor_id,
        patient_name=payload.patient_name,
        patient_contact=payload.patient_contact,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
        notes=payload.notes,
        status="BOOKED",
    )
    db.add(appointment)
    try:
        db.commit()
        db.refresh(appointment)
        return appointment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot already booked",
        )


def cancel_appointment(
    doctor_id: uuid.UUID,
    appointment_id: uuid.UUID,
    db: Session,
) -> Appointment:
    """
    Cancel an appointment:
    - Verify doctor ownership and status == BOOKED
    - Transition to CANCELLED
    """
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment or appointment.doctor_id != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only BOOKED appointments can be cancelled",
        )
    if appointment.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed appointments cannot be cancelled",
        )
    if appointment.status != "BOOKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only BOOKED appointments can be cancelled",
        )

    appointment.status = "CANCELLED"
    db.commit()
    db.refresh(appointment)
    return appointment


def complete_appointment(
    doctor_id: uuid.UUID,
    appointment_id: uuid.UUID,
    db: Session,
) -> Appointment:
    """
    Complete an appointment:
    - Verify doctor ownership and status == BOOKED
    - Transition to COMPLETED
    """
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment or appointment.doctor_id != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment already completed",
        )
    if appointment.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancelled appointments cannot be completed",
        )
    if appointment.status != "BOOKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only BOOKED appointments can be completed",
        )

    appointment.status = "COMPLETED"
    db.commit()
    db.refresh(appointment)
    return appointment


def reschedule_appointment(
    doctor_id: uuid.UUID,
    appointment_id: uuid.UUID,
    payload: AppointmentRescheduleRequest,
    db: Session,
) -> Appointment:
    """
    Reschedule an existing appointment:
    - Verify doctor ownership and status == BOOKED
    - Validate new slot availability and exclusion absence
    - Verify new slot is not occupied by another BOOKED appointment
    - Update date, start_time, end_time while status remains BOOKED
    """
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment or appointment.doctor_id != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.status != "BOOKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only BOOKED appointments can be rescheduled",
        )

    _validate_slot_against_schedule(
        doctor_id=doctor_id,
        slot_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        db=db,
        is_reschedule=True,
    )

    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == payload.date,
            Appointment.start_time == payload.start_time,
            Appointment.status == "BOOKED",
            Appointment.id != appointment_id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target slot already occupied",
        )

    appointment.date = payload.date
    appointment.start_time = payload.start_time
    appointment.end_time = payload.end_time
    try:
        db.commit()
        db.refresh(appointment)
        return appointment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target slot already occupied",
        )


def get_appointment(
    doctor_id: uuid.UUID,
    appointment_id: uuid.UUID,
    db: Session,
) -> Appointment:
    """
    Retrieve single appointment verifying doctor ownership.
    """
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment or appointment.doctor_id != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    return appointment


def list_appointments(
    doctor_id: uuid.UUID,
    status_filter: Optional[str],
    from_date: Optional[date],
    to_date: Optional[date],
    page: int,
    page_size: int,
    db: Session,
) -> Tuple[List[Appointment], int]:
    """
    Retrieve paginated appointments for doctor with optional status and date filters.
    """
    query = db.query(Appointment).filter(Appointment.doctor_id == doctor_id)

    if status_filter is not None:
        query = query.filter(Appointment.status == status_filter)
    if from_date is not None:
        query = query.filter(Appointment.date >= from_date)
    if to_date is not None:
        query = query.filter(Appointment.date <= to_date)

    query = query.order_by(Appointment.date.asc(), Appointment.start_time.asc())
    total = query.count()

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return items, total
