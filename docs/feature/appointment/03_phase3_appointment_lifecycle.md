# Phase 3 — Appointment Lifecycle & Concurrency

[← Back to Index](index.md)

---

## Architecture & Implementation Reasoning

### 5.1 Summary
Implemented the full doctor appointment lifecycle including creation, cancellation, completion, rescheduling, and paginated listing with atomic concurrency guarantees. Replaced unconditional slot uniqueness with a partial unique index in Migration 007 (`status != 'CANCELLED'`), allowing cancelled slots to be immediately rebooked while retaining historical audit records. Deprecated the legacy appointment stub in `lib/api.ts` and removed the fake `/public/tenants/{slug}/appointments` endpoint, keeping medicine order and report upload stubs intact.

### 5.2 Plan Reference
- **Plan**: `docs/APPOINTMENT_SYSTEM.md` (Phase 3)
- **Base Commit SHA**: `23903c861aef76f1fa1b6511d4bd46d418eba980`

### 5.3 Changes
- [`backend/alembic/versions/007_appointment_active_slot_unique_index.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/007_appointment_active_slot_unique_index.py): Added migration 007 replacing table-level unique constraint with a partial unique index for active slots (`status != 'CANCELLED'`).
- [`backend/app/models/appointment.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/appointment.py): Updated [`Appointment`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/appointment.py) model `__table_args__` to declare partial unique index `uq_doctor_active_appointment_slot`.
- [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py): Added `RATE_LIMIT_APPOINTMENT: str = "20/minute"`.
- [`backend/.env.example`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env.example): Added `RATE_LIMIT_APPOINTMENT=20/minute`.
- [`backend/app/services/appointment_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/appointment_service.py): Implemented lifecycle business logic (`create_appointment`, `cancel_appointment`, `complete_appointment`, `reschedule_appointment`, `get_appointment`, `list_appointments`).
- [`backend/app/services/__init__.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/__init__.py): Initialized services package.
- [`backend/app/api/routes/appointment.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/appointment.py): Implemented authenticated doctor appointment management endpoints with slowapi rate limiting and pagination.
- [`backend/app/api/routes/__init__.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/__init__.py): Exported `appointment` router.
- [`backend/app/api/router.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/router.py): Registered `appointment.router` under `/api/v1`.
- [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py): Removed deprecated fake appointment booking stub `POST /tenants/{slug}/appointments`.
- [`backend/tests/test_profile_and_public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/test_profile_and_public.py): Updated public tenant test step 5 to assert 404 on removed stub endpoint.
- [`backend/tests/test_appointment_lifecycle.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/test_appointment_lifecycle.py): Added 30 integration test cases (3.1 to 3.32) verifying lifecycle, concurrency, state machine, and stub cleanup.
- [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts): Deprecated `bookPublicAppointment` with `@deprecated` annotation.

### 5.4 Key Decisions & Reasoning
1. **Partial Unique Index vs. Hard Unique Constraint (Migration 007)**:
   - **Decision**: Replaced `UniqueConstraint("doctor_id", "date", "start_time")` with partial index `uq_doctor_active_appointment_slot` filtered by `status != 'CANCELLED'`.
   - **Reasoning**: Unconditional unique constraint made it impossible to rebook a slot once cancelled (violating Test 3.11).
   - **Alternatives Considered**: Delete-then-insert (violates audit integrity, vulnerable to TOCTOU race conditions); in-place reuse (semantically corrupts UUID and creation history).
   - **Consequences**: Concurrency race protection is strictly enforced at database tier for active bookings, while slot rebooking after cancellation functions cleanly.
2. **Deprecation rather than immediate deletion of `bookPublicAppointment` in `lib/api.ts`**:
   - **Decision**: Added `@deprecated` JSDoc annotation and maintained export until frontend replacement in Phase 5.
   - **Reasoning**: `app/[slug]/page.tsx` still imported `bookPublicAppointment`; removing it immediately would break TypeScript compilation and build before Phase 5 UI overhaul.
   - **Alternatives Considered**: Prematurely editing `app/[slug]/page.tsx` outside Phase 3 scope.
   - **Consequences**: Preserves full frontend lint and type-check integrity (`npx tsc --noEmit` and `next lint` pass cleanly).

### 5.5 Deviations from Plan
- **Migration 007**: Introduced migration `007_appointment_active_slot_unique_index.py` to reconcile the conflict between Phase 1's unconditional unique constraint and Phase 3's requirement (Test 3.11) that cancelled slots can be re-booked without losing historical records. Approved by user before execution.

### 5.6 Assumptions
- None.

### 5.7 Delegation
- None (single thread sequential execution per global rule).

### 5.8 Verification Results
- **Automated Baseline**: 75 passed, 5 warnings in 6.27s.
- **Automated After Phase 3**: 105 passed, 5 warnings in 8.65s (30 new tests in `test_appointment_lifecycle.py`, 0 regressions).
- **TypeScript & Lint**: `npx tsc --noEmit` passed with exit code 0; `npm run lint` passed with exit code 0.
- **Migration Lifecycle**: `alembic upgrade head` -> `alembic downgrade -1` -> `alembic upgrade head` passed cleanly.
- **Agent Executable Scenarios**: 11-step end-to-end integration lifecycle test executed and passed with 100% integrity.

| Step | Type | Command / Scenario | Expected | Observed | Evidence | Verdict |
|:---|:---|:---|:---|:---|:---|:---|
| Backend Test Suite | AUTO | `pytest` | 105 tests pass | 105 passed in 8.65s | Exit 0 | PASS |
| Migration Rollback | AUTO | `alembic upgrade head && downgrade -1 && upgrade head` | Clean migration & rollback | All 7 versions applied, rolled back, reapplied | Exit 0 | PASS |
| Frontend Type Check | AUTO | `npx tsc --noEmit` | Zero TS errors | Zero errors | Exit 0 | PASS |
| Frontend Lint | AUTO | `npm run lint` | No warnings/errors | Clean lint | Exit 0 | PASS |
| 3.1–3.8 Creation | AUTO | `pytest tests/test_appointment_lifecycle.py` | Valid bookings & schedule guards | Passed (201, 400, 422) | Exit 0 | PASS |
| 3.9–3.11 Concurrency | AUTO | `pytest tests/test_appointment_lifecycle.py` | 409 conflict, cross-doctor ok, cancelled freed | Passed | Exit 0 | PASS |
| 3.12–3.17 State Transitions | AUTO | `pytest tests/test_appointment_lifecycle.py` | Valid transitions; reject invalid transitions | Passed | Exit 0 | PASS |
| 3.18–3.22 Reschedule | AUTO | `pytest tests/test_appointment_lifecycle.py` | Slot move, conflict 409, leave guard 400 | Passed | Exit 0 | PASS |
| 3.23–3.29 List & Lookup | AUTO | `pytest tests/test_appointment_lifecycle.py` | Pagination, status/date filters, 404 isolation | Passed | Exit 0 | PASS |
| 3.30–3.32 Stub Cleanup | AUTO | `pytest tests/test_appointment_lifecycle.py` | Removed apt stub (404), intact med/rep stubs (201) | Passed | Exit 0 | PASS |
| E2E Acceptance Lifecycle | AGENT_EXEC | Live TestClient 11-step sequence | Full lifecycle run | 11/11 assertions matched | Exit 0 | PASS |
| Live Uvicorn Curl Test | AGENT_EXEC | Running Uvicorn on port 8011 + live curl calls | Full lifecycle over HTTP/TCP | 10/10 curl requests matched expected responses | Exit 0 | PASS |

### 5.9 Manual Steps Pending
- None.

### 5.10 Production Neon Migration Verification
- **Executed**: `railway run --service backend alembic upgrade head` applied cleanly to production Neon DB with transactional DDL.
- **Verified**: `railway run --service backend alembic current` reports `007_appointment_active_slot_unique_index (head)`.
- **Health**: Production backend `GET /api/v1/health` verified healthy (`status: healthy`). Zero downtime experienced.

### 5.11 Rollback Plan
- Revert Git commit.
- Run `alembic downgrade 006_appointment_system_foundation` to revert partial unique index back to constraint `uq_doctor_appointment_slot`.

---
