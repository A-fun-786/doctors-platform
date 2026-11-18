# Overlapping Appointments Rejection & Database Guard — Progress Tracker (SSOT)

**Reference Issue:** [GitHub Issue #20 — [PR #17] Appointments: overlapping bookings accepted for the same practitioner](https://github.com/A-fun-786/doctors-platform/issues/20)  
**Related PR Review:** [PR #17 Discussion Comment r4587043038](https://github.com/A-fun-786/doctors-platform/pull/17#discussion_r4587043038)  
**Status:** Completed & Fully Verified  
**Date:** November 18, 2026  

---

## 1. Mathematical Invariant & Architecture

### 1.1 Root Cause & Solution
Prior to this implementation, conflict detection in `appointment_service.py` evaluated exact start-time equality (`Appointment.start_time == payload.start_time`) and only filtered on `status == "BOOKED"`. This permitted overlapping intervals (e.g. 10:00–11:00 and 10:30–11:30 or 10:15–10:45) as well as double-booking against `COMPLETED` appointments.

### 1.2 Half-Open Interval Logic
Two half-open intervals $[S_1, E_1)$ and $[S_2, E_2)$ collide if and only if:
$$\max(S_1, S_2) < \min(E_1, E_2) \iff S_1 < E_2 \land E_1 > S_2$$
- **Adjacent intervals** ($[10:00, 10:30)$ and $[10:30, 11:00)$): $10:00 < 11:00$ (True) but $10:30 > 10:30$ (False) $\rightarrow$ Allowed.
- **Enclosed intervals** ($[10:00, 11:00)$ and $[10:15, 10:45)$): $10:00 < 10:45$ (True) and $11:00 > 10:15$ (True) $\rightarrow$ Rejected (409 Conflict).
- **Overlapping boundaries** ($[10:00, 11:00)$ and $[10:30, 11:30)$): $10:00 < 11:30$ (True) and $11:00 > 10:30$ (True) $\rightarrow$ Rejected (409 Conflict).

### 1.3 Two-Tier Defense Architecture
1. **Tier 1 (Application Layer)**:
   - Query filters by `doctor_id == doctor_id`, `date == payload.date`, `status != "CANCELLED"`.
   - Overlap check: `start_time < payload.end_time AND end_time > payload.start_time`.
   - Practitioner partitioning: `(staff_id IS NULL)` for Primary Doctor vs `(staff_id == target_staff)` for Staff Doctor.
   - For reschedule: `Appointment.id != appointment_id` ensures self-updates succeed.
   - Raises `HTTPException(status_code=409, detail=...)`.
2. **Tier 2 (Database-Level Guard)**:
   - **PostgreSQL**: `EXCLUDE USING gist` constraints on `tsrange(date + start_time, date + end_time, '[)')` with `btree_gist` extension for primary and staff doctors where `status != 'CANCELLED'`.
   - **SQLite**: `BEFORE INSERT` and `BEFORE UPDATE` triggers executing `SELECT RAISE(ABORT, 'Slot overlap detected: practitioner already booked')` when an active overlapping row exists for the same practitioner.
   - **SQLAlchemy Event Listener**: `@event.listens_for(Appointment.__table__, "after_create")` attaches triggers on SQLite and constraints on PostgreSQL during `Base.metadata.create_all()`.
   - `IntegrityError` is caught in application service layer and cleanly translated to `HTTP 409 Conflict`.

---

## 2. Phase-by-Phase Implementation Log

### Phase 1: Application Service Layer Interval Overlap Engine
- Modified `backend/app/services/appointment_service.py`:
  - In `create_appointment`: replaced exact equality with `Appointment.start_time < payload.end_time` and `Appointment.end_time > payload.start_time` where `Appointment.status != "CANCELLED"`.
  - In `reschedule_appointment`: replaced exact equality with interval overlap conditions and `Appointment.id != appointment_id` where `Appointment.status != "CANCELLED"`.
  - Preserved multi-tenancy and doctor partition (`staff_id.is_(None)` vs `staff_id == target_staff_id`).

### Phase 2: Database-Level Guard & Migration Hardening
- Modified `backend/app/models/appointment.py`:
  - Retained `uq_primary_doctor_active_slot` and `uq_staff_doctor_active_slot` partial unique indexes.
  - Attached `@event.listens_for(Appointment.__table__, "after_create")` to create triggers for SQLite and GiST constraints for PostgreSQL.
- Modified `backend/alembic/versions/012_multi_doctor_appointments.py`:
  - Added dialect check (`op.get_context().dialect.name`).
  - Added PostgreSQL `btree_gist` extension and `uq_primary_doctor_no_overlap` / `uq_staff_doctor_no_overlap` exclusion constraints.
  - Added SQLite `trg_appointment_no_overlap_insert` and `trg_appointment_no_overlap_update` triggers.
  - Added clean downgrade operations dropping triggers/constraints before batch table alteration.

### Phase 3: Comprehensive Automated Verification & Regression Testing
- Created `backend/tests/test_appointment_overlap.py` with 12 targeted unit tests covering:
  - Adjacent slots without collision.
  - Head overlap, tail overlap, enclosed sub-interval, and enclosing super-interval rejection.
  - Multi-practitioner concurrent overlap allowance.
  - Cancelled appointment reuse and completed appointment blocking.
  - Reschedule self-update vs conflicting target update.
  - Database-level SQLite trigger enforcement on direct raw SQL / session insert & update raising `IntegrityError`.
- Updated `backend/tests/test_multi_doctor_appointments.py`:
  - Added `test_staff_doctor_overlapping_interval_collision`.
  - Added `test_concurrent_different_doctors_overlapping_intervals_allowed`.

### Phase 4: Productionization & Live Verification
- Backend test suite: 194 / 194 passed (100%).
- Frontend test suite: `npm test` passed (100% across all suites).
- TypeScript check: `npx tsc --noEmit` passed with 0 errors.
- ESLint check: `npm run lint` passed with 0 warnings or errors.

---

## 3. Verification Scorecard

| Test Suite | Tests Run | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- |
| `backend/tests/test_appointment_overlap.py` | 12 | 12 | 0 | PASSED |
| `backend/tests/test_multi_doctor_appointments.py` | 9 | 9 | 0 | PASSED |
| `backend/tests/test_appointment_phase1.py` (Alembic) | 5 | 5 | 0 | PASSED |
| Full Backend (`pytest backend/tests`) | 194 | 194 | 0 | PASSED |
| Frontend Unit & Responsive Tests (`npm test`) | 50+ | 50+ | 0 | PASSED |
| Frontend Type Check (`npx tsc --noEmit`) | — | — | 0 | PASSED |
| Frontend Lint (`npm run lint`) | — | — | 0 | PASSED |
