# Agent Guidelines & Repository Architecture (AGENTS.md)
*Last updated: November 24, 2026*

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
  - Canonical Role Classifier: [`backend/app/models/staff.py`](file:///Users/emanur/doctors-platform/backend/app/models/staff.py) (`is_doctor_role`), [`lib/api.ts`](file:///Users/emanur/doctors-platform/lib/api.ts) (`isDoctorRole`)
  - Tests: [`backend/tests/test_staff_auth.py`](file:///Users/emanur/doctors-platform/backend/tests/test_staff_auth.py), [`backend/tests/test_staff.py`](file:///Users/emanur/doctors-platform/backend/tests/test_staff.py)
  - Deep Doc: [`docs/STAFF_MANAGEMENT_ARCHITECTURE.md`](file:///Users/emanur/doctors-platform/docs/STAFF_MANAGEMENT_ARCHITECTURE.md)
- **Dashboard & Overview UI:**
  - Overview Component: [`components/dashboard/OverviewTab.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/OverviewTab.tsx) (uses O(1) server-side total counting and local calendar date normalization)
  - Shell & Navigation: [`components/dashboard/DashboardShell.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx)
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
- **Validate Practitioner Availability Boundary (Issue #29)**: In `GET /doctor/available-slots` and `GET /public/tenants/{slug}/available-slots`, strictly validate `staff_id` before computing candidate slots. Malformed strings or non-doctor roles must return 400 Bad Request; nonexistent or foreign staff doctors must return 404 Not Found. On-leave staff doctors return `[]`. Never fall back to clinic-wide multi-doctor slots when a specific practitioner ID is invalid.
- **Explicit Primary Practitioner on Reschedule (Issue #30)**: When rescheduling appointments attended by the primary clinic doctor, always pass `targetStaffId="primary"` to `SlotSelectorGrid` and `getDoctorAvailableSlots`. Never pass `null` or omit `staff_id`, which would calculate clinic-wide multi-doctor capacity and hide or miscalculate valid primary doctor slots.
- **Persist Rescheduled Reason and Notes (Issue #32)**: `AppointmentRescheduleRequest` accepts `reason` and `notes`. In `reschedule_appointment`, evaluate `"reason" in payload.model_fields_set` and `"notes" in payload.model_fields_set` to persist edits to clinical notes. In `AppointmentRescheduleForm`, propagate `reason` and `notes` to both the API payload and the `onSuccess` callback.
- **Standard Input Ergonomics**: Keep form inputs at `h-10` with `pl-11 pr-3.5` (or `h-11` for prominent forms) to prevent icon/placeholder text collisions.
- **Beside-Input Generate Button**: Position the blue password Generate button directly beside the password input box (`flex items-center gap-2`, matching `h-10` height and `rounded-xl`).
- **Case-Insensitive Identity Uniqueness & Normalization (Issue #35)**: Enforce strict case-insensitive uniqueness on staff User IDs and login-enabled emails using functional unique indexes (`uq_staff_username_lower` and `uq_staff_login_email_lower`). Always normalize User IDs (`strip().lstrip('@').lower()`) and emails (`strip().lower()`) on create, update, and login lookup to prevent cross-account login collision.
- **Cross-Account Email Shadowing Prevention (Issue #36)**: In `register_email` and `authenticate_google`, reject any attempt to register a Doctor with an email that is already used by a login-enabled Staff member (`can_login.is_(True)`). Conversely, in `create_staff` and `update_staff`, reject assigning an email that belongs to any registered `Doctor`. Lookups must be case-insensitive (`func.lower(email) == email.lower()`).
- **Enforce Token Version & Immediate Session Invalidation (Issue #34)**: Require a matching `token_version` claim for all staff JWT tokens in `get_current_doctor` ([`backend/app/api/deps.py`](file:///Users/emanur/doctors-platform/backend/app/api/deps.py)). Tokens with missing, null, or mismatched `token_version` must be rejected immediately with 401 Unauthorized (`detail="Credentials have changed. Please log in again."`). Increment `token_version` on password change or reset to invalidate all existing sessions.
- **Doctor Speciality Selection**: Enforce mandatory `speciality` dropdown selection when creating/editing doctor roles, defaulting to `"General Physician"` if omitted.
- **Canonical Practitioner Classification**: Use `is_doctor_role(role)` from [`app.models.staff`](file:///Users/emanur/doctors-platform/backend/app/models/staff.py) on backend and `isDoctorRole(role)` from [`lib/api.ts`](file:///Users/emanur/doctors-platform/lib/api.ts) on frontend for all practitioner boundaries (`is_staff_doctor`, `list_practitioners`, and slot generation). Never infer doctor status from department (`department == 'Clinical'`) or fragile substring checks (`role.includes('doctor')`).
- **Mask Sensitive Staff Roster Data**: Mask compensation (`base_salary_paise`), emergency contact, and administrative notes to `None` in `GET /api/v1/staff` and `GET /api/v1/staff/{staff_id}` for non-owner staff accounts. Restrict full financial and personal HR visibility to clinic owner doctors.
- **Scalable KPI Queries**: When retrieving count metrics (e.g. booked/completed counts in `OverviewTab`), query with `page_size: 1` and extract `total` instead of fetching large item batches into memory.
- **Local Date Derivation**: Construct calendar query dates from local client date components (`getFullYear()`, `getMonth()`, `getDate()`) to avoid UTC midnight skew across different time zones.

### Don'ts:
- **Do NOT allow staff doctors to book, cancel, or reschedule**: Return 403 Forbidden on the backend and omit booking/cancellation buttons in the UI.
- **Do NOT allow non-doctor staff to complete appointments**: Return 403 Forbidden on the backend (`detail="Non-doctor staff members are not permitted to complete appointments."`) and omit the Mark Completed button in the UI (`canComplete = false`).
- **Do NOT delete staff members with active or completed appointments**: Return 400 Bad Request if a staff member has active (`BOOKED`) or completed (`COMPLETED`) visits. Staff with clinical history must be deactivated (`status = 'inactive'`) rather than hard deleted to prevent `SET NULL` slot collisions and preserve medical records.
- **Do NOT allow staff members to modify clinic schedules or working hours**: All schedule entries (LEAVE, BLOCKED, HOLIDAY, AVAILABLE) and clinic-wide shift changes must be restricted to clinic owner doctors (`require_doctor_owner`).
- **Do NOT return clinic-wide slots for invalid practitioner queries**: When a specific `staff_id` is queried, do NOT fall back to multi-doctor capacity if the ID is missing or invalid; reject with 400 or 404 immediately.
- **Do NOT query clinic-wide slots for single-practitioner rescheduling (Issue #30)**: Rescheduling is always practitioner-specific; pass the attending doctor's staff UUID or `"primary"`. Do not pass `null` or empty `staff_id` when rescheduling.
- **Do NOT silently discard reason or notes edits on reschedule (Issue #32)**: Reschedule requests must propagate updated clinical reason and notes through the API, service layer, and UI state without data loss.
- **Do NOT accept staff tokens without token_version (Issue #34)**: Never skip token version validation when the claim is omitted or null; all staff tokens must explicitly match `staff.token_version` to prevent pre-revocation session survival.
- **Do NOT allow duplicate usernames or login emails across casings (Issue #35)**: Reject mixed-case username collisions and duplicate login emails with 400 Bad Request; never permit case-sensitive index leaks or unnormalized login lookups.
- **Do NOT allow doctor registration to shadow existing staff emails (Issue #36)**: Return 400 Bad Request on doctor email registration and 409 Conflict on Google sign-in when the email belongs to an active staff member; never allow doctor provisioning to hijack or shadow staff identities.
- **Do NOT require email for staff logins**: Staff authenticate via clinic-assigned User ID (`username`) + password. Email is purely optional.
- **Do NOT reintroduce dynamic text in toolbar buttons**: Do not put dynamic dates inside button labels (e.g. `Day (Nov 6)`). Keep button labels static (`Day`, `Agenda`, `All`, `Confirmed`).
- **Do NOT commit temporary seeding scripts**: Keep `scripts/` clean of temporary dummy data generators.
- **Do NOT bypass sandbox or security constraints**: Rely on documented API methods and tests in `:memory:` or isolated DB sessions.

## Open Questions / Known Tech Debt
- Staff members currently inherit clinic working hours; individual shift schedules per staff doctor are designed for future release.
- Staff usernames are globally unique; future multi-tenant expansion may scope User IDs under tenant slugs (`username@clinic-slug`).
