# Agent Guidelines & Repository Architecture (AGENTS.md)
*Last updated: November 6, 2026*

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
- **Staff management, auth, & permissions:**
  - Route / Models: [`backend/app/api/routes/staff.py`](file:///Users/emanur/doctors-platform/backend/app/api/routes/staff.py), [`backend/app/models/staff.py`](file:///Users/emanur/doctors-platform/backend/app/models/staff.py)
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

### Don'ts:
- **Do NOT reintroduce dynamic text in toolbar buttons**: Do not put dynamic dates inside button labels (e.g. `Day (Nov 6)`) as changing widths break responsive flex lines. Keep button labels static (`Day`, `Agenda`, `All`, `Confirmed`).
- **Do NOT commit temporary seeding scripts**: Keep `scripts/` clean of temporary dummy data generators.
- **Do NOT bypass sandbox or security constraints**: Rely on documented API methods and tests in `:memory:` or isolated DB sessions.

## Open Questions / Known Tech Debt
- Staff members currently inherit clinic working hours; individual shift schedules per staff doctor are designed for future release.

