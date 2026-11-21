# Agent Guidelines & Repository Architecture (`AGENTS.md`)

## Verification Policy (Change-Scoped)
- **No pre-edit baseline** unless diagnosing a pre-existing failure.
- **Targeted during work:**
  - Backend: `ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests/<file>.py -x -q`
  - Frontend: `npm run test:<suite>` or `node scripts/<test>.mjs` (`npm test -- <pattern>` does NOT filter)
  - Types: `npx tsc --noEmit`
  - Lint: `npx eslint <changed files>`
- **Before finishing — scope by what changed:**
  - `backend/**` only: `ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests -q`
  - `app/**`, `components/**`, `lib/**` only: `npm test`, `npx tsc --noEmit`, `npm run lint`
  - Both / shared API contract: all of the above
  - Docs / comments only: skip all checks
- **`npm run build` only** when touching `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `package.json`, App Router layouts/routes, or env handling.
- **Never re-run** a check that passed with no edits since.

## Where to Look First
Read deep docs (`docs/*.md`) only when modifying that domain.

- **Appointment concurrency & booking logic:** `backend/app/models/appointment.py`, `backend/app/services/appointment_service.py`, `backend/app/services/schedule_service.py`, `docs/APPOINTMENT_SYSTEM.md`
- **Schedule & Working Hours mutations (Clinic Owner Only):** `backend/app/api/routes/schedule.py` (`require_doctor_owner` on create/delete/update working-hours), `backend/app/services/schedule_service.py`, `backend/tests/test_schedule.py`
- **Staff management, User ID auth, & permissions:** `backend/app/api/routes/staff.py`, `backend/app/models/staff.py`, `backend/app/schemas/staff.py`, `backend/app/services/auth_service.py`, `components/auth/EmailAuthForm.tsx`, `backend/app/services/staff_service.py`, `backend/app/api/deps.py`, `backend/app/api/routes/appointment.py`, `backend/app/api/routes/calendar.py`, `backend/tests/test_staff_auth.py`, `backend/tests/test_staff.py`, `docs/STAFF_MANAGEMENT_ARCHITECTURE.md`
- **Calendar & Appointment UI:** `components/dashboard/CalendarTab.tsx`, `components/dashboard/calendar/views/CalendarHeader.tsx`, `components/dashboard/calendar/views/AgendaView.tsx`, `components/dashboard/calendar/panels/AppointmentDetailsPanel.tsx`

## Permissions (RBAC)
- **Staff Doctor Boundaries**: Use `is_staff_doctor(current_doctor)` in backend and `isStaffDoctor` in UI. Staff doctors can view and complete only their own bookings; booking, rescheduling, and cancellation are reserved for receptionists and clinic owners (return 403 Forbidden on backend; omit booking/cancellation buttons in UI).
- **Doctor-Only Completion**: Non-doctor staff cannot complete appointments. Return 403 Forbidden (`detail="Non-doctor staff members are not permitted to complete appointments."`) on backend and omit the Mark Completed button (`canComplete = false`) in UI.
- **Owner-Only Schedule & Working Hours**: Enforce `require_doctor_owner` for `POST /doctor/schedule`, `DELETE /doctor/schedule/{id}`, and `PUT /doctor/working-hours` (all `LEAVE`, `BLOCKED`, `HOLIDAY`, `AVAILABLE` entries and clinic-wide shift changes). Staff members (receptionists and staff doctors) must receive 403 Forbidden. Read endpoints (`GET /doctor/schedule`, `GET /doctor/available-slots`, `GET /doctor/working-hours`) remain open to all authenticated staff.
- **Canonical Practitioner Classification**: Use `is_doctor_role(role)` from `app.models.staff` (`backend/app/models/staff.py`) for all practitioner boundaries (`is_staff_doctor`, `list_practitioners`, slot generation). Never infer doctor status from department (`department == 'Clinical'`).
- **Mask Sensitive Staff Roster Data**: Mask compensation (`base_salary_paise`), emergency contact, and administrative notes to `None` in `GET /api/v1/staff` and `GET /api/v1/staff/{staff_id}` for non-owner staff accounts. Restrict full financial and personal HR visibility to clinic owner doctors.

## Backend Invariants
- **Multi-Doctor Partial Indexes**: Never use a single unique index across nullable `staff_id`; preserve `uq_primary_doctor_active_slot` and `uq_staff_doctor_active_slot`.
- **Eager Load Doctor/Staff**: Always use `lazy="joined"` or eager options when joining `staff_member` or `doctor` in appointment queries to prevent N+1 overhead.
- **No Hard-Deleting Staff With History**: Return 400 Bad Request if a staff member has active (`BOOKED`) or completed (`COMPLETED`) visits. Deactivate (`status = 'inactive'`) instead of hard deleting to prevent `SET NULL` slot collisions and preserve medical records.
- **Staff User ID Auth & Normalization**: Staff authenticate via clinic-assigned User ID (`username`) + password; email is optional. Normalize User IDs via schema field validators by stripping leading `@`, trimming whitespace, and lowercasing.
- **Immediate Session Invalidation**: Increment `token_version` on password change or reset to invalidate all existing JWT tokens.
- **Doctor Speciality Selection**: Enforce mandatory `speciality` dropdown selection when creating/editing doctor roles, defaulting to `"General Physician"` if omitted.
- **Test Isolation**: Tests run against `:memory:` or isolated DB sessions.

## UI & Shared Conventions
- **Agenda Table Width**: Enforce `overflow-x-hidden` and `table-fixed w-full` so all columns fit 100% of viewport without a horizontal scrollbar.
- **Static Toolbar Button Labels**: Do not put dynamic dates inside button labels (e.g. `Day (Nov 6)`); keep labels static (`Day`, `Agenda`, `All`, `Confirmed`).
- **Input Ergonomics & Generate Button**: Keep form inputs at `h-10` with `pl-11 pr-3.5` (or `h-11` for prominent forms) to prevent icon/placeholder collisions. Position the blue password Generate button directly beside the password input (`flex items-center gap-2`, `h-10`, `rounded-xl`).
- **Structured Logger**: Always import `logger` from `@/lib/logger` instead of `console.log` or `console.warn`.
- **Clean Scripts**: Keep `scripts/` clean of temporary dummy data seeding scripts.
