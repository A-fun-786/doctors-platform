# Agent Guidelines & Repository Architecture (AGENTS.md)
*Last updated: November 20, 2026*

## Quick Verification Commands
Always run these before and after changes:
- **Backend tests:** `ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests`
- **Frontend tests:** `npm test`
- **Type check:** `npx tsc --noEmit`
- **Linting:** `npm run lint`
- **Production build:** `npm run build`

## Architecture Map & "If You Need to Change X, Look at Y First"
- **Appointment concurrency & booking logic:**
  - DB Models & Indexes: [`backend/app/models/appointment.py`](file:///Users/emanur/doctors-platform/backend/app/models/appointment.py)
  - Backend Service: [`backend/app/services/appointment_service.py`](file:///Users/emanur/doctors-platform/backend/app/services/appointment_service.py)
  - Slot Capacity: [`backend/app/services/schedule_service.py`](file:///Users/emanur/doctors-platform/backend/app/services/schedule_service.py)
  - Deep Doc: [`docs/APPOINTMENT_SYSTEM.md`](file:///Users/emanur/doctors-platform/docs/APPOINTMENT_SYSTEM.md)
- **Schedule & Working Hours mutations (Clinic Owner Only):**
  - Routes & RBAC: [`backend/app/api/routes/schedule.py`](file:///Users/emanur/doctors-platform/backend/app/api/routes/schedule.py) (uses `require_doctor_owner` on create/delete/update working-hours)
  - Service: [`backend/app/services/schedule_service.py`](file:///Users/emanur/doctors-platform/backend/app/services/schedule_service.py)
  - Tests: [`backend/tests/test_schedule.py`](file:///Users/emanur/doctors-platform/backend/tests/test_schedule.py)
- **Staff management, User ID auth, & permissions:**
  - Route / Models / Schemas: [`backend/app/api/routes/staff.py`](file:///Users/emanur/doctors-platform/backend/app/api/routes/staff.py), [`backend/app/models/staff.py`](file:///Users/emanur/doctors-platform/backend/app/models/staff.py), [`backend/app/schemas/staff.py`](file:///Users/emanur/doctors-platform/backend/app/schemas/staff.py)
  - Auth Service & Login: [`backend/app/services/auth_service.py`](file:///Users/emanur/doctors-platform/backend/app/services/auth_service.py), [`components/auth/EmailAuthForm.tsx`](file:///Users/emanur/doctors-platform/components/auth/EmailAuthForm.tsx)
  - Staff Service: [`backend/app/services/staff_service.py`](file:///Users/emanur/doctors-platform/backend/app/services/staff_service.py)
  - Staff Doctor Restrictions: [`backend/app/api/deps.py`](file:///Users/emanur/doctors-platform/backend/app/api/deps.py), [`backend/app/api/routes/appointment.py`](file:///Users/emanur/doctors-platform/backend/app/api/routes/appointment.py), [`backend/app/api/routes/calendar.py`](file:///Users/emanur/doctors-platform/backend/app/api/routes/calendar.py)
  - Tests: [`backend/tests/test_staff_auth.py`](file:///Users/emanur/doctors-platform/backend/tests/test_staff_auth.py), [`backend/tests/test_staff.py`](file:///Users/emanur/doctors-platform/backend/tests/test_staff.py)
  - Deep Doc: [`docs/STAFF_MANAGEMENT_ARCHITECTURE.md`](file:///Users/emanur/doctors-platform/docs/STAFF_MANAGEMENT_ARCHITECTURE.md)
- **Calendar & Appointment UI:**
  - Main Tab: [`components/dashboard/CalendarTab.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/CalendarTab.tsx)
  - Header & Date Picker: [`components/dashboard/calendar/views/CalendarHeader.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/calendar/views/CalendarHeader.tsx)
  - Agenda View: [`components/dashboard/calendar/views/AgendaView.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/calendar/views/AgendaView.tsx)
  - Details Drawer: [`components/dashboard/calendar/panels/AppointmentDetailsPanel.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/calendar/panels/AppointmentDetailsPanel.tsx)

## Core Conventions & Rules

### Do's:
- **Keep Agenda Table strictly locked in width**: Enforce `overflow-x-hidden` and `table-fixed w-full`. All columns must fit 100% of viewport without horizontal scrollbar.
- **Maintain CalendarSidebar mounting**: Keep `<CalendarSidebar>` in `CalendarTab.tsx` (using `<div className="hidden" aria-hidden="true">` wrapper) to preserve automated test assertions.
- **Multi-Doctor Partial Indexes**: When modifying appointment constraints, never use a single unique index across nullable `staff_id`; preserve `uq_primary_doctor_active_slot` and `uq_staff_doctor_active_slot`.
- **Eager load doctor/staff**: Always use `lazy="joined"` or eager options when joining `staff_member` or `doctor` in appointment queries to prevent N+1 overhead.
- **Use Structured Logger**: Always import `logger` from `@/lib/logger` instead of using `console.log` or `console.warn`.
- **Enforce Staff Doctor Boundaries**: Use `is_staff_doctor(current_doctor)` in backend and `isStaffDoctor` in UI. Staff doctors can view and complete only their own bookings; booking, rescheduling, and cancellation are reserved for receptionists and clinic owners.
- **Restrict Schedule & Working Hours Mutations to Clinic Owner**: Enforce `require_doctor_owner` for `POST /doctor/schedule`, `DELETE /doctor/schedule/{id}`, and `PUT /doctor/working-hours`. Staff members (receptionists and staff doctors) must receive 403 Forbidden. Read endpoints (`GET /doctor/schedule`, `GET /doctor/available-slots`, `GET /doctor/working-hours`) remain open to all authenticated staff.
- **Standard Input Ergonomics**: Keep form inputs at `h-10` with `pl-11 pr-3.5` (or `h-11` for prominent forms) to prevent icon/placeholder text collisions.
- **Beside-Input Generate Button**: Position the blue password Generate button directly beside the password input box (`flex items-center gap-2`, matching `h-10` height and `rounded-xl`).
- **Staff User ID Normalization**: Normalize User IDs via schema field validators by stripping leading `@`, trimming whitespace, and converting to lowercase.
- **Immediate Session Invalidation**: Increment `token_version` on password change or reset to invalidate all existing JWT tokens.
- **Doctor Speciality Selection**: Enforce mandatory `speciality` dropdown selection when creating/editing doctor roles, defaulting to `"General Physician"` if omitted.
- **Canonical Practitioner Classification**: Use `is_doctor_role(role)` from [`app.models.staff`](file:///Users/emanur/doctors-platform/backend/app/models/staff.py) for all practitioner boundaries (`is_staff_doctor`, `list_practitioners`, and slot generation). Never infer doctor status from department (`department == 'Clinical'`).

### Don'ts:
- **Do NOT allow staff doctors to book, cancel, or reschedule**: Return 403 Forbidden on the backend and omit booking/cancellation buttons in the UI.
- **Do NOT allow staff members to modify clinic schedules or working hours**: All schedule entries (LEAVE, BLOCKED, HOLIDAY, AVAILABLE) and clinic-wide shift changes must be restricted to clinic owner doctors (`require_doctor_owner`).
- **Do NOT require email for staff logins**: Staff authenticate via clinic-assigned User ID (`username`) + password. Email is purely optional.
- **Do NOT reintroduce dynamic text in toolbar buttons**: Do not put dynamic dates inside button labels (e.g. `Day (Nov 6)`). Keep button labels static (`Day`, `Agenda`, `All`, `Confirmed`).
- **Do NOT commit temporary seeding scripts**: Keep `scripts/` clean of temporary dummy data generators.
- **Do NOT bypass sandbox or security constraints**: Rely on documented API methods and tests in `:memory:` or isolated DB sessions.

## Open Questions / Known Tech Debt
- Staff members currently inherit clinic working hours; individual shift schedules per staff doctor are designed for future release.
- Staff usernames are globally unique; future multi-tenant expansion may scope User IDs under tenant slugs (`username@clinic-slug`).
