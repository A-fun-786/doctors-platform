import uuid
from datetime import date, time, datetime
from typing import List, Optional, Tuple, Dict
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.schemas.schedule import ScheduleCreateRequest


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_time_str(m: int) -> str:
    hours = m // 60
    minutes = m % 60
    return f"{hours:02d}:{minutes:02d}"


def create_schedule_entries(
    doctor_id: uuid.UUID,
    entries: List[ScheduleCreateRequest],
    db: Session,
) -> List[Schedule]:
    """
    Create one or more schedule entries for a doctor.
    Validates time range and rejects overlapping AVAILABLE windows.
    """
    available_by_date: Dict[date, List[ScheduleCreateRequest]] = {}

    for entry in entries:
        if entry.end_time <= entry.start_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_time must be after start_time",
            )
        if entry.type == "AVAILABLE":
            available_by_date.setdefault(entry.date, []).append(entry)

    for entry_date, date_entries in available_by_date.items():
        # Check internal batch collisions
        for i in range(len(date_entries)):
            a = date_entries[i]
            for j in range(i + 1, len(date_entries)):
                b = date_entries[j]
                if a.start_time < b.end_time and a.end_time > b.start_time:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Overlapping AVAILABLE schedule window detected on date {entry_date}",
                    )

        # Check collisions against existing persisted AVAILABLE records
        existing_available = (
            db.query(Schedule)
            .filter(
                Schedule.doctor_id == doctor_id,
                Schedule.date == entry_date,
                Schedule.type == "AVAILABLE",
            )
            .all()
        )
        for new_entry in date_entries:
            for existing in existing_available:
                if (
                    new_entry.start_time < existing.end_time
                    and new_entry.end_time > existing.start_time
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Overlapping AVAILABLE schedule window detected on date {entry_date}",
                    )

    created_records: List[Schedule] = []
    for entry in entries:
        record = Schedule(
            doctor_id=doctor_id,
            date=entry.date,
            start_time=entry.start_time,
            end_time=entry.end_time,
            type=entry.type,
            reason=entry.reason,
        )
        db.add(record)
        created_records.append(record)

    db.commit()
    for record in created_records:
        db.refresh(record)

    return created_records


def get_schedule(
    doctor_id: uuid.UUID,
    from_date: Optional[date],
    to_date: Optional[date],
    page: int,
    page_size: int,
    db: Session,
) -> Tuple[List[Schedule], int]:
    """
    Retrieve paginated schedule entries for a doctor within an optional date range.
    """
    query = db.query(Schedule).filter(Schedule.doctor_id == doctor_id)

    if from_date is not None:
        query = query.filter(Schedule.date >= from_date)
    if to_date is not None:
        query = query.filter(Schedule.date <= to_date)

    query = query.order_by(Schedule.date.asc(), Schedule.start_time.asc())
    total = query.count()

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return items, total


def delete_schedule_entry(
    doctor_id: uuid.UUID,
    schedule_id: uuid.UUID,
    db: Session,
) -> None:
    """
    Delete a single schedule entry belonging to the doctor.
    Raises 404 if not found or owned by another doctor.
    """
    record = (
        db.query(Schedule)
        .filter(Schedule.id == schedule_id)
        .first()
    )

    if not record or record.doctor_id != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule entry not found",
        )

    db.delete(record)
    db.commit()


def generate_available_slots(
    doctor_id: uuid.UUID,
    query_date: date,
    db: Session,
    now: Optional[datetime] = None,
) -> List[Dict[str, str]]:
    """
    Deterministic 30-minute slot generation engine:
    1. Precedence Rule: Check explicit AVAILABLE schedule intervals on query_date.
    2. Shift Fallback: If no AVAILABLE records exist and doctor has working_hours:
       - Check query_date.weekday() against closed_days (ISO: Mon=0 ... Sun=6).
       - Slice enabled shifts into 30m slots.
    3. Past-Slot Guard: If query_date == date.today(), filter out candidate intervals
       where end_time <= datetime.now().time().
    4. Exclusions: Subtract LEAVE, HOLIDAY, BLOCKED schedule windows.
    5. Subtract occupied appointments (BOOKED, COMPLETED).
    6. Return deduplicated, sorted available slots.
    """
    available_schedules = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == query_date,
            Schedule.type == "AVAILABLE",
        )
        .order_by(Schedule.start_time.asc())
        .all()
    )

    candidate_slots: List[Tuple[int, int]] = []

    if available_schedules:
        # Step A: Explicit AVAILABLE schedule records take precedence
        for sched in available_schedules:
            start_m = _time_to_minutes(sched.start_time)
            end_m = _time_to_minutes(sched.end_time)
            curr = start_m
            while curr + 30 <= end_m:
                candidate_slots.append((curr, curr + 30))
                curr += 30
    else:
        # Step B: Shift Fallback from Doctor.working_hours
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if doctor and doctor.working_hours:
            working_hours = doctor.working_hours
            if isinstance(working_hours, str):
                import json
                try:
                    working_hours = json.loads(working_hours)
                except Exception:
                    working_hours = {}

            closed_days = working_hours.get("closed_days", [])
            # Evaluate query_date.weekday() against closed_days (ISO: Monday=0 ... Sunday=6)
            if query_date.weekday() not in closed_days:
                shifts = working_hours.get("shifts", [])
                for shift in shifts:
                    if shift.get("enabled", True):
                        start_h, start_m = map(int, shift["start"].split(":"))
                        end_h, end_m = map(int, shift["end"].split(":"))
                        s_start = start_h * 60 + start_m
                        s_end = end_h * 60 + end_m
                        curr = s_start
                        while curr + 30 <= s_end:
                            candidate_slots.append((curr, curr + 30))
                            curr += 30

    if not candidate_slots:
        return []

    # Step C: Past-Slot Guard
    # If query_date is today, filter out candidate intervals where end_time <= now.time()
    current_dt = now or datetime.now()
    if query_date == current_dt.date():
        curr_time = current_dt.time()
        filtered_candidates: List[Tuple[int, int]] = []
        for s_start, s_end in candidate_slots:
            slot_end_t = time(s_end // 60, s_end % 60) if s_end < 1440 else time(23, 59, 59)
            if slot_end_t > curr_time:
                filtered_candidates.append((s_start, s_end))
        candidate_slots = filtered_candidates

    if not candidate_slots:
        return []

    # Step D: Exclusion windows (LEAVE, HOLIDAY, BLOCKED)
    exclusions = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == query_date,
            Schedule.type.in_(["LEAVE", "HOLIDAY", "BLOCKED"]),
        )
        .all()
    )

    exclusion_intervals: List[Tuple[int, int]] = []
    for excl in exclusions:
        e_start = _time_to_minutes(excl.start_time)
        e_end = _time_to_minutes(excl.end_time)
        # Full-day holiday check (e.g. 23:59 covers through end of day)
        if excl.end_time >= time(23, 59):
            e_end = 24 * 60
        exclusion_intervals.append((e_start, e_end))

    # Step E: Occupied Appointments (BOOKED, COMPLETED)
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == query_date,
            Appointment.status.in_(["BOOKED", "COMPLETED"]),
        )
        .all()
    )
    for apt in appointments:
        a_start = _time_to_minutes(apt.start_time)
        a_end = _time_to_minutes(apt.end_time)
        if apt.end_time >= time(23, 59):
            a_end = 24 * 60
        exclusion_intervals.append((a_start, a_end))

    # Step F: Intersection & Subtraction
    valid_slots: List[Dict[str, str]] = []
    # Deduplicate candidate slots if any duplicate windows existed
    seen_slots = set()
    for s_start, s_end in candidate_slots:
        if (s_start, s_end) in seen_slots:
            continue
        seen_slots.add((s_start, s_end))

        # Check overlap with any exclusion
        is_blocked = False
        for e_start, e_end in exclusion_intervals:
            if s_start < e_end and s_end > e_start:
                is_blocked = True
                break

        if not is_blocked:
            valid_slots.append({
                "start": _minutes_to_time_str(s_start),
                "end": _minutes_to_time_str(s_end),
            })

    # Step G: Sort by start
    valid_slots.sort(key=lambda s: s["start"])
    return valid_slots
