import collections
import uuid
from datetime import date
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.schedule import Schedule
from app.services.schedule_service import generate_available_slots


def get_doctor_calendar(
    doctor_id: uuid.UUID,
    from_date: date,
    to_date: date,
    db: Session,
) -> Dict[str, Any]:
    """
    Composes schedules and appointments into a unified, time-ordered calendar view.

    1. Query schedules in range [from_date, to_date] for doctor.
    2. Query active appointments (BOOKED, COMPLETED) in range [from_date, to_date] for doctor.
    3. Group schedules and appointments by date.
    4. For each date with events:
       - Generate available 30m slots using slot generation engine.
       - Include non-AVAILABLE schedules (LEAVE, HOLIDAY, BLOCKED).
       - Include active appointments (BOOKED, COMPLETED).
       - Exclude CANCELLED appointments (they do not block slots or appear on calendar).
       - Sort events chronologically by start time.
    5. Return dates list.
    """
    schedules = (
        db.query(Schedule)
        .filter(
            Schedule.doctor_id == doctor_id,
            Schedule.date >= from_date,
            Schedule.date <= to_date,
        )
        .order_by(Schedule.date.asc(), Schedule.start_time.asc())
        .all()
    )

    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date >= from_date,
            Appointment.date <= to_date,
            Appointment.status.in_(["BOOKED", "COMPLETED"]),
        )
        .order_by(Appointment.date.asc(), Appointment.start_time.asc())
        .all()
    )

    schedules_by_date: Dict[date, List[Schedule]] = collections.defaultdict(list)
    for s in schedules:
        schedules_by_date[s.date].append(s)

    appointments_by_date: Dict[date, List[Appointment]] = collections.defaultdict(list)
    for a in appointments:
        appointments_by_date[a.date].append(a)

    active_dates = sorted(set(schedules_by_date.keys()) | set(appointments_by_date.keys()))

    calendar_dates: List[Dict[str, Any]] = []

    for d in active_dates:
        events: List[Dict[str, Any]] = []

        day_schedules = schedules_by_date.get(d, [])
        day_appointments = appointments_by_date.get(d, [])

        # Step A: Generate available slots if there are AVAILABLE schedules
        if any(s.type == "AVAILABLE" for s in day_schedules):
            available_slots = generate_available_slots(
                doctor_id=doctor_id,
                query_date=d,
                db=db,
            )
            for slot in available_slots:
                events.append({
                    "type": "AVAILABLE",
                    "start": slot["start"],
                    "end": slot["end"],
                })

        # Step B: Add non-AVAILABLE schedules (LEAVE, HOLIDAY, BLOCKED)
        for s in day_schedules:
            if s.type in ("LEAVE", "HOLIDAY", "BLOCKED"):
                ev: Dict[str, Any] = {
                    "type": s.type,
                    "start": s.start_time.strftime("%H:%M"),
                    "end": s.end_time.strftime("%H:%M"),
                }
                if s.reason:
                    ev["reason"] = s.reason
                events.append(ev)

        # Step C: Add active appointments (BOOKED, COMPLETED)
        for a in day_appointments:
            ev = {
                "type": "APPOINTMENT",
                "start": a.start_time.strftime("%H:%M"),
                "end": a.end_time.strftime("%H:%M"),
                "patient_name": a.patient_name,
                "status": a.status,
                "appointment_id": str(a.id),
            }
            if a.reason:
                ev["reason"] = a.reason
            events.append(ev)

        # Step D: Sort chronologically by start time, then end time
        events.sort(key=lambda e: (e["start"], e["end"]))

        if events:
            calendar_dates.append({
                "date": d.isoformat(),
                "events": events,
            })

    return {"dates": calendar_dates}
