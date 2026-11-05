import uuid
from datetime import date, time, datetime
from typing import List, Optional, Tuple, Dict, Union
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.staff import StaffMember
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
    staff_id: Optional[Union[uuid.UUID, str]] = None,
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
    4. Multi-Doctor Capacity & Exclusions:
       - If specific doctor requested (primary or staff):
         - Subtract holiday and specific doctor's leaves/blocks and occupied appointments.
       - If clinic-wide query (staff_id is None):
         - Total clinic capacity = 1 (primary doctor) + active staff doctors.
         - Subtract clinic holiday (blocks all capacity).
         - At each slot, count unavailable doctors (on leave/block or booked).
         - If unavailable < total capacity, slot is available!
    5. Return deduplicated, sorted available slots.
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
            # Evaluate closed days (JS/Schema convention: 0=Sun, 1=Mon...6=Sat, plus ISO Sunday=6)
            js_day = (query_date.weekday() + 1) % 7
            is_closed = (js_day in closed_days) or (query_date.weekday() == 6 and 6 in closed_days)
            if not is_closed:
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

    # Step D: Exclusions & Active Appointments
    # Query clinic schedules for query_date
    all_schedules = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date == query_date,
            Schedule.type.in_(["LEAVE", "HOLIDAY", "BLOCKED"]),
        )
        .all()
    )

    # Check clinic-wide holiday
    has_holiday = any(s.type == "HOLIDAY" for s in all_schedules)
    if has_holiday:
        return []

    # Query active appointments for query_date
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == query_date,
            Appointment.status.in_(["BOOKED", "COMPLETED"]),
        )
        .all()
    )

    # Determine if query is for a specific practitioner
    is_primary_only = (staff_id == "primary")
    target_staff_uuid = None
    if staff_id and staff_id != "primary":
        if isinstance(staff_id, str):
            try:
                target_staff_uuid = uuid.UUID(staff_id)
            except ValueError:
                target_staff_uuid = None
        else:
            target_staff_uuid = staff_id

    # Active staff doctors
    doctor_keywords = ["doctor", "physician", "specialist", "consultant", "surgeon", "pediatrician", "cardiologist", "dermatologist"]
    staff_members = (
        db.query(StaffMember)
        .filter(
            StaffMember.doctor_id == doctor_id,
            StaffMember.status.in_(["active", "on_leave"]),
        )
        .all()
    )
    staff_doctors = [
        s for s in staff_members
        if any(kw in s.role.lower() for kw in doctor_keywords) or s.department == "Clinical"
    ]

    # Handle specific practitioner slot generation
    if is_primary_only or target_staff_uuid is not None:
        blocked_intervals: List[Tuple[int, int]] = []
        if is_primary_only:
            # Primary doctor leaves and blocked times
            for s in all_schedules:
                if s.type in ("LEAVE", "BLOCKED"):
                    s_st = _time_to_minutes(s.start_time)
                    s_en = 24 * 60 if s.end_time >= time(23, 59) else _time_to_minutes(s.end_time)
                    blocked_intervals.append((s_st, s_en))
            # Primary doctor appointments (staff_id is None)
            for apt in appointments:
                if apt.staff_id is None:
                    a_st = _time_to_minutes(apt.start_time)
                    a_en = 24 * 60 if apt.end_time >= time(23, 59) else _time_to_minutes(apt.end_time)
                    blocked_intervals.append((a_st, a_en))
        else:
            # Staff doctor: check if staff member is on leave
            target_staff = next((s for s in staff_doctors if s.id == target_staff_uuid), None)
            if target_staff and target_staff.status == "on_leave":
                return []
            # Staff doctor appointments
            for apt in appointments:
                if apt.staff_id == target_staff_uuid:
                    a_st = _time_to_minutes(apt.start_time)
                    a_en = 24 * 60 if apt.end_time >= time(23, 59) else _time_to_minutes(apt.end_time)
                    blocked_intervals.append((a_st, a_en))

        valid_slots: List[Dict[str, str]] = []
        seen_slots = set()
        for s_start, s_end in candidate_slots:
            if (s_start, s_end) in seen_slots:
                continue
            seen_slots.add((s_start, s_end))

            is_blocked = any(s_start < b_end and s_end > b_start for b_start, b_end in blocked_intervals)
            if not is_blocked:
                valid_slots.append({
                    "start": _minutes_to_time_str(s_start),
                    "end": _minutes_to_time_str(s_end),
                })
        valid_slots.sort(key=lambda s: s["start"])
        return valid_slots

    # Multi-Doctor Capacity (staff_id is None):
    # Total active doctor capacity = 1 (primary) + active staff doctors
    active_staff_docs = [s for s in staff_doctors if s.status == "active"]
    total_capacity = 1 + len(active_staff_docs)

    # Primary doctor leave/block intervals
    primary_leaves: List[Tuple[int, int]] = []
    for s in all_schedules:
        if s.type in ("LEAVE", "BLOCKED"):
            s_st = _time_to_minutes(s.start_time)
            s_en = 24 * 60 if s.end_time >= time(23, 59) else _time_to_minutes(s.end_time)
            primary_leaves.append((s_st, s_en))

    valid_slots = []
    seen_slots = set()
    for s_start, s_end in candidate_slots:
        if (s_start, s_end) in seen_slots:
            continue
        seen_slots.add((s_start, s_end))

        # Count unavailable doctors during this interval
        unavailable_count = 0

        # Check primary doctor availability
        primary_unavailable = any(s_start < l_en and s_end > l_st for l_st, l_en in primary_leaves)
        if not primary_unavailable:
            primary_unavailable = any(
                apt.staff_id is None
                and s_start < (_time_to_minutes(apt.end_time) if apt.end_time < time(23, 59) else 1440)
                and s_end > _time_to_minutes(apt.start_time)
                for apt in appointments
            )
        if primary_unavailable:
            unavailable_count += 1

        # Check each staff doctor availability
        for s in active_staff_docs:
            staff_booked = any(
                apt.staff_id == s.id
                and s_start < (_time_to_minutes(apt.end_time) if apt.end_time < time(23, 59) else 1440)
                and s_end > _time_to_minutes(apt.start_time)
                for apt in appointments
            )
            if staff_booked:
                unavailable_count += 1

        # If at least one doctor is free, slot is available!
        if unavailable_count < total_capacity:
            valid_slots.append({
                "start": _minutes_to_time_str(s_start),
                "end": _minutes_to_time_str(s_end),
            })

    valid_slots.sort(key=lambda s: s["start"])
    return valid_slots
