import uuid
from datetime import date, datetime, time
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import time as clinic_time
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.staff import StaffMember, is_doctor_role
from app.models.schedule import Schedule
from app.schemas.appointment import (
    AppointmentCreateRequest,
    AppointmentRescheduleRequest,
    AppointmentResponse,
)
from app.schemas.schedule import resolve_doctor_working_hours
from app.services import idempotency_service


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _validate_slot_not_in_past(
    slot_date: date,
    end_time: time,
    is_reschedule: bool = False,
    now: Optional[datetime] = None,
) -> None:
    """Reject appointments on past dates or today's already-elapsed time slots."""
    current_dt = clinic_time.get_clinic_now(now)
    action = "reschedule an appointment to" if is_reschedule else "create an appointment on"
    if slot_date < current_dt.date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {action} a past date",
        )
    if slot_date == current_dt.date() and end_time <= current_dt.time():
        slot_action = "reschedule an appointment to" if is_reschedule else "create an appointment in"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {slot_action} an elapsed time slot",
        )


def _validate_slot_against_schedule(
    doctor_id: uuid.UUID,
    slot_date: date,
    start_time: time,
    end_time: time,
    db: Session,
    is_reschedule: bool = False,
    staff_id: Optional[uuid.UUID] = None,
    now: Optional[datetime] = None,
) -> None:
    """
    Validate that [start_time, end_time) is not in the past, falls cleanly within
    an AVAILABLE window, and does not overlap any LEAVE, HOLIDAY, or BLOCKED period.
    """
    _validate_slot_not_in_past(
        slot_date=slot_date,
        end_time=end_time,
        is_reschedule=is_reschedule,
        now=now,
    )
    s_start = _time_to_minutes(start_time)
    s_end = _time_to_minutes(end_time)

    # 1. Check explicit AVAILABLE schedules (takes precedence for custom/test overrides)
    available_schedules = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == slot_date,
            Schedule.type == "AVAILABLE",
        )
        .all()
    )

    if available_schedules:
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
    else:
        # Step B: Fall back to doctor working_hours (or default shifts if unconfigured)
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No AVAILABLE schedule window for this date",
            )

        working_hours = resolve_doctor_working_hours(doctor.working_hours)
        shifts = working_hours.get("shifts", [])
        if not shifts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No AVAILABLE schedule window for this date",
            )

        closed_days = working_hours.get("closed_days", [])
        # Evaluate closed days using schema standard convention (0=Sun, 1=Mon, ..., 6=Sat)
        day_index = (slot_date.weekday() + 1) % 7
        is_closed = day_index in closed_days
        if is_closed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clinic is closed on this date",
            )

        shifts = working_hours.get("shifts", [])
        in_shift_window = False
        for shift in shifts:
            if shift.get("enabled", True):
                start_h, start_m = map(int, shift["start"].split(":"))
                end_h, end_m = map(int, shift["end"].split(":"))
                w_start = start_h * 60 + start_m
                w_end = end_h * 60 + end_m
                if s_start >= w_start and s_end <= w_end:
                    in_shift_window = True
                    break

        if not in_shift_window:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slot does not fall within doctor's working hours",
            )

    # 2. Check exclusions: LEAVE, HOLIDAY, BLOCKED
    # If staff_id is set, only clinic-wide HOLIDAY blocks; LEAVE/BLOCKED belong to primary doctor
    exclusion_types = ["HOLIDAY"] if staff_id is not None else ["LEAVE", "HOLIDAY", "BLOCKED"]
    exclusions = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == slot_date,
            Schedule.type.in_(exclusion_types),
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


def _stage_appointment(
    doctor_id: uuid.UUID,
    payload: AppointmentCreateRequest,
    db: Session,
    now: Optional[datetime] = None,
) -> Appointment:
    """
    Validate appointment constraints and stage a new Appointment on the session
    without committing.
    """
    staff = None
    if payload.staff_id is not None:
        staff = (
            db.query(StaffMember)
            .filter(
                StaffMember.id == payload.staff_id,
                StaffMember.doctor_id == doctor_id,
            )
            .first()
        )
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected staff doctor was not found",
            )
        if staff.status == "on_leave":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dr. {staff.full_name} is currently on leave",
            )
        if staff.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Staff member is {staff.status} and cannot accept appointments",
            )
        if not is_doctor_role(staff.role):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Staff member {staff.full_name} is not a clinical practitioner",
            )

    _validate_slot_against_schedule(
        doctor_id=doctor_id,
        slot_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        db=db,
        is_reschedule=False,
        staff_id=payload.staff_id,
        now=now,
    )

    # Check existing active appointment overlapping with requested interval for THIS doctor
    conflict_query = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == payload.date,
            Appointment.status != "CANCELLED",
            Appointment.start_time < payload.end_time,
            Appointment.end_time > payload.start_time,
        )
    )
    if payload.staff_id is not None:
        conflict_query = conflict_query.filter(Appointment.staff_id == payload.staff_id)
    else:
        conflict_query = conflict_query.filter(Appointment.staff_id.is_(None))

    existing = conflict_query.first()
    if existing:
        doc_label = staff.full_name if staff else "Primary Doctor"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slot already booked for {doc_label}",
        )

    appointment = Appointment(
        doctor_id=doctor_id,
        staff_id=payload.staff_id,
        patient_id=uuid.uuid4(),
        patient_name=payload.patient_name,
        patient_contact=payload.patient_contact,
        patient_gender=payload.patient_gender,
        patient_age=payload.patient_age,
        patient_height=payload.patient_height,
        patient_weight=payload.patient_weight,
        patient_blood_group=payload.patient_blood_group,
        patient_address=payload.patient_address,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
        notes=payload.notes,
        status="BOOKED",
    )
    db.add(appointment)
    return appointment


def create_appointment(
    doctor_id: uuid.UUID,
    payload: AppointmentCreateRequest,
    db: Session,
    now: Optional[datetime] = None,
) -> Appointment:
    """
    Create a new appointment:
    - Validate staff_id belongs to doctor tenant if provided and doctor is active
    - Validate schedule availability and absence of exclusions
    - Validate slot is not already BOOKED for this specific doctor
    - Insert with status = BOOKED
    - Catch race-condition IntegrityError from unique index and return 409
    """
    appointment = _stage_appointment(
        doctor_id=doctor_id,
        payload=payload,
        db=db,
        now=now,
    )
    try:
        db.commit()
        db.refresh(appointment)
        return appointment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot already booked for this doctor",
        )


def create_appointment_with_idempotency(
    doctor_id: uuid.UUID,
    payload: AppointmentCreateRequest,
    db: Session,
    idempotency_key: Optional[str] = None,
    endpoint: str = "POST:/doctor/appointments",
    now: Optional[datetime] = None,
) -> Tuple[AppointmentResponse, bool]:
    """
    Create an appointment with optional DB-backed Idempotency-Key enforcement.
    Returns (AppointmentResponse, replayed) where replayed=True when an existing
    matching idempotency record was returned.
    """
    normalized_key = idempotency_service.normalize_idempotency_key(idempotency_key)
    if normalized_key is None:
        appointment = create_appointment(
            doctor_id=doctor_id,
            payload=payload,
            db=db,
            now=now,
        )
        return AppointmentResponse.model_validate(appointment), False

    request_hash = idempotency_service.compute_request_hash(payload)

    existing_record = idempotency_service.lookup_idempotency_record(
        db=db,
        doctor_id=doctor_id,
        endpoint=endpoint,
        idempotency_key=normalized_key,
        request_hash=request_hash,
        now=now,
    )
    if existing_record is not None:
        return AppointmentResponse.model_validate(existing_record.response_body), True

    # Claim the idempotency slot before checking/inserting the appointment so
    # concurrent transactions serialize on the unique index instead of racing.
    record = idempotency_service.build_idempotency_record(
        doctor_id=doctor_id,
        endpoint=endpoint,
        idempotency_key=normalized_key,
        request_hash=request_hash,
        status_code=status.HTTP_201_CREATED,
        now=now,
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing_record = idempotency_service.lookup_idempotency_record(
            db=db,
            doctor_id=doctor_id,
            endpoint=endpoint,
            idempotency_key=normalized_key,
            request_hash=request_hash,
            now=now,
        )
        if existing_record is not None:
            return AppointmentResponse.model_validate(existing_record.response_body), True
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Concurrent request conflict for Idempotency-Key; please retry",
        )

    try:
        appointment = _stage_appointment(
            doctor_id=doctor_id,
            payload=payload,
            db=db,
            now=now,
        )
        db.flush()
        db.refresh(appointment)
        response_data = AppointmentResponse.model_validate(appointment)
        record.appointment_id = appointment.id
        record.response_body = response_data.model_dump(mode="json")
        db.commit()
        return response_data, False
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        existing_record = idempotency_service.lookup_idempotency_record(
            db=db,
            doctor_id=doctor_id,
            endpoint=endpoint,
            idempotency_key=normalized_key,
            request_hash=request_hash,
            now=now,
        )
        if existing_record is not None:
            return AppointmentResponse.model_validate(existing_record.response_body), True
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot already booked for this doctor",
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
    now: Optional[datetime] = None,
) -> Appointment:
    """
    Reschedule an existing appointment:
    - Verify doctor ownership and status == BOOKED
    - Validate new slot availability and exclusion absence
    - Verify new slot is not occupied by another BOOKED appointment for target doctor
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

    target_staff_id = payload.staff_id if payload.staff_id is not None else appointment.staff_id
    if payload.staff_id is not None and payload.staff_id != appointment.staff_id:
        staff = (
            db.query(StaffMember)
            .filter(
                StaffMember.id == payload.staff_id,
                StaffMember.doctor_id == doctor_id,
            )
            .first()
        )
        if not staff or staff.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected staff doctor is not available",
            )
        if not is_doctor_role(staff.role):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected staff member is not a clinical practitioner",
            )

    _validate_slot_against_schedule(
        doctor_id=doctor_id,
        slot_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        db=db,
        is_reschedule=True,
        staff_id=target_staff_id,
        now=now,
    )

    conflict_query = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == payload.date,
            Appointment.status != "CANCELLED",
            Appointment.start_time < payload.end_time,
            Appointment.end_time > payload.start_time,
            Appointment.id != appointment_id,
        )
    )
    if target_staff_id is not None:
        conflict_query = conflict_query.filter(Appointment.staff_id == target_staff_id)
    else:
        conflict_query = conflict_query.filter(Appointment.staff_id.is_(None))

    conflict = conflict_query.first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target slot already occupied for this doctor",
        )

    appointment.date = payload.date
    appointment.start_time = payload.start_time
    appointment.end_time = payload.end_time
    if payload.staff_id is not None:
        appointment.staff_id = payload.staff_id
    try:
        db.commit()
        db.refresh(appointment)
        return appointment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target slot already occupied for this doctor",
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
    staff_id: Optional[uuid.UUID] = None,
    primary_only: Optional[bool] = None,
) -> Tuple[List[Appointment], int]:
    """
    Retrieve paginated appointments for doctor with optional status, date, and staff filters.
    """
    query = db.query(Appointment).filter(Appointment.doctor_id == doctor_id)

    if primary_only:
        query = query.filter(Appointment.staff_id.is_(None))
    elif staff_id is not None:
        query = query.filter(Appointment.staff_id == staff_id)
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


def list_practitioners(
    doctor_id: uuid.UUID,
    db: Session,
) -> List[dict]:
    """
    List all practitioners available for appointments in the clinic:
    - Primary doctor (practice owner)
    - Active staff members who are doctors, consultants, physicians, or clinical personnel
    """
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        return []

    practitioners = [
        {
            "id": None,
            "name": doctor.full_name,
            "role": "Primary Doctor (Owner)",
            "speciality": doctor.speciality or "General Practice",
            "department": "Clinical",
            "is_primary": True,
        }
    ]

    staff_members = (
        db.query(StaffMember)
        .filter(
            StaffMember.doctor_id == doctor_id,
            StaffMember.status == "active",
        )
        .order_by(StaffMember.full_name.asc())
        .all()
    )

    for s in staff_members:
        if s.is_doctor:
            practitioners.append({
                "id": s.id,
                "name": s.full_name,
                "role": s.role,
                "speciality": s.speciality or s.role,
                "department": s.department,
                "is_primary": False,
            })

    return practitioners
