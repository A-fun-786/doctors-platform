# Issue #27 — Preventing Past-Date & Elapsed-Time Appointment Bookings and Reschedules

**Issue:** [A-fun-786/doctors-platform#27](https://github.com/A-fun-786/doctors-platform/issues/27)  
**PR Review Context:** [PR #17 Comment](https://github.com/A-fun-786/doctors-platform/pull/17#discussion_r4587043060)  
**Status:** Fixed and verified (`227 passed` backend tests)

---

## Summary Story (What Happened & Why)

Imagine walking into a clinic at **2:00 PM**, looking at the reception screen, and seeing only afternoon and evening appointment slots available—because morning slots from 9:00 AM to 1:00 PM have already passed. That is how our **slot generator** worked: when the UI asked *"which slots are open today?"*, the backend quietly hid any time slot that had already ended.

However, the **front desk's actual booking and rescheduling doors** (`POST /api/v1/doctor/appointments` and `PATCH /api/v1/doctor/appointments/{id}`) never checked the clock or the calendar date against "today." They only asked two questions:
1. Does this time fall inside the doctor's normal working hours (or an `AVAILABLE` schedule block)?
2. Is there a holiday, leave, or existing booking in the way?

Because working hours repeat every week and schedule validation didn't look at the current time, a direct API request—or a stale browser tab—could walk right through the door and book an appointment for **yesterday**, **last year**, or **10:00 AM earlier the same morning**. Even worse, the slot generator relied on the server's naive system clock (`datetime.now()`), meaning a server running in UTC could disagree with a clinic operating in local time (e.g., `Asia/Kolkata`) around midnight.

Backdated appointments silently polluted the clinic's calendar and reports. To close this gap permanently, we introduced a single **clinic timezone** configuration (`CLINIC_TIMEZONE`) and placed the exact same clock-and-calendar guard in the shared appointment validation path used by both **create** and **reschedule**. Now, the UI's view of availability and the backend's booking rules tell the same story—in the clinic's own local time.

---

## Root Cause Analysis

1. **Asymmetry between read and write paths:**
   - `generate_available_slots()` in `backend/app/services/schedule_service.py` filtered out same-day slots where `end_time <= current_dt.time()`.
   - `_validate_slot_against_schedule()` in `backend/app/services/appointment_service.py` (used by `create_appointment()` and `reschedule_appointment()`) only checked `AVAILABLE` windows, `working_hours` / `closed_days`, and `LEAVE` / `HOLIDAY` / `BLOCKED` exclusions—with no check against current date or time.
2. **Timezone ambiguity:**
   - `schedule_service.py` used naive `datetime.now()`, coupling slot filtering to the host OS timezone rather than an explicit clinic timezone.

---

## What Changed

| File | Change |
|---|---|
| `backend/app/core/config.py` | Added `CLINIC_TIMEZONE: str = "Asia/Kolkata"` setting with `ZoneInfo` validation (`validate_clinic_timezone`). |
| `backend/.env.example` | Documented `CLINIC_TIMEZONE=Asia/Kolkata`. |
| `backend/app/core/time.py` | Added `get_clinic_timezone()` and `get_clinic_now(now=None)` to resolve current clinic wall-clock time consistently (converting aware `now` overrides into `CLINIC_TIMEZONE`). |
| `backend/app/services/schedule_service.py` | Updated `generate_available_slots()` to use `get_clinic_timezone()` when evaluating `now` / `datetime.now(clinic_tz)`. |
| `backend/app/services/appointment_service.py` | Added `_validate_slot_not_in_past(slot_date, end_time, now)` inside `_validate_slot_against_schedule()`, and exposed optional `now` on `create_appointment()` and `reschedule_appointment()`. |
| `components/dashboard/calendar/panels/AppointmentRescheduleForm.tsx` | Added `min={todayStr}` on the target date picker and client-side past-date / elapsed-slot checks before opening the reschedule confirmation modal. |
| `components/dashboard/calendar/panels/SlotSelectorGrid.tsx` | Marked past-date (`"Past Date"`) and same-day elapsed (`"Elapsed"`) slots as unavailable in the reschedule slot picker. |
| `backend/tests/appointments/test_appointment_past_guard.py` | Added tests for past-date rejection, same-day elapsed/boundary rejection, in-progress slot allowance, reschedule rejection without mutating the booking, clinic timezone boundary consistency, and invalid timezone validation. |
| `backend/tests/appointments/test_appointment_lifecycle.py`, `test_working_hours_engine.py`, `tests/core/test_productionization.py` | Pinned test clocks / updated hardcoded past fixture dates so historical suite tests remain time-independent. |

---

## Guard Semantics

Both `POST /api/v1/doctor/appointments` and `PATCH /api/v1/doctor/appointments/{id}` enforce:
- **Past date (`slot_date < current_dt.date()`):** Rejected with `400 Bad Request` (`"Cannot book or reschedule an appointment in the past"`).
- **Elapsed same-day slot (`slot_date == current_dt.date()` and `end_time <= current_dt.time()`):** Rejected with `400 Bad Request` (`"Cannot book or reschedule an appointment for an elapsed time slot"`), matching `generate_available_slots()` (`slot_end_t > curr_time`).
- **In-progress or future slot (`end_time > current_dt.time()` today or future date):** Allowed if schedule/exclusion/conflict checks pass.

---

## Verification

Ran the full backend test suite after final edits:

```bash
cd backend && .venv/bin/pytest -v
```

Result: **227 passed** (`tests/appointments/test_appointment_past_guard.py` plus all existing backend suites).
