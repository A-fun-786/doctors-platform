# Appointment System - Implementation Progress & Decision Log

## Overview & Context
This document tracks the end-to-end design, implementation, and verification of the doctor appointment system based on the architectural specification in [`docs/APPOINTMENT_SYSTEM.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/APPOINTMENT_SYSTEM.md).

All work in this initial milestone covers **Phase 1: Database Models, Alembic Migration, Connection Pool Hardening, and Pydantic Schemas**.

---

## 1. Branch Strategy & Initialization
- **Action**: Created a dedicated feature branch from `develop`.
- **Refinement**: Initially created as `feature/appointment-system-phase-1`, then simplified to `appointment-system` to maintain cleaner git ergonomics across all implementation phases.
- **Current Active Branch**: `appointment-system`.

---

## 2. Phase 1 Architecture & Implementation Reasoning

### 2.1 Database Models
Two core relational models were created to support scheduling and appointment booking:

1. **[`Schedule`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/schedule.py) (`schedules` table)**:
   - **Reasoning**: Represents doctor calendar windows for both working hours (`AVAILABLE`) and unavailability (`LEAVE`, `HOLIDAY`, `BLOCKED`).
   - **Columns**: `id` (UUID PK), `doctor_id` (FK `doctors.id`, `ondelete="CASCADE"`), `date` (Date), `start_time` (Time), `end_time` (Time), `type` (String 20), `reason` (Text nullable), and timestamps via `TimestampMixin`.
   - **Performance Design**: Composite index `ix_schedules_doctor_date` on `(doctor_id, date)` ensures slot generation lookups filter by doctor and date in $O(\log N)$ time.

2. **[`Appointment`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/appointment.py) (`appointments` table)**:
   - **Reasoning**: Represents confirmed slot bookings.
   - **Forward Compatibility Strategy**: To prevent premature coupling to a patient authentication system that doesn't yet exist, inline text fields (`patient_name`, `patient_contact`) are stored directly, while nullable foreign keys (`patient_id`, `request_id`) are reserved. When the patient portal is built, existing rows remain valid without requiring table restructuring.
   - **Double-Booking Prevention**: Database-level constraint `UniqueConstraint("doctor_id", "date", "start_time", name="uq_doctor_appointment_slot")` guarantees race-condition immunity against overlapping bookings at the database tier.
   - **Indexes**: Composite index `(doctor_id, date)` for calendar view queries and `(doctor_id, status)` for fast dashboard filtering by status (`BOOKED`, `COMPLETED`, `CANCELLED`).

3. **Entity Relationships & Exports**:
   - Updated [`Doctor`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py) with 1:N relations `schedules` and `appointments` (`cascade="all, delete-orphan"`).
   - Exported both models in [`backend/app/models/__init__.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/__init__.py).

---

### 2.2 Alembic Migration & Dynamic URL Handling

1. **Migration 006**:
   - File: [`backend/alembic/versions/006_appointment_system_foundation.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/006_appointment_system_foundation.py).
   - Filename length: 38 characters (Neon production database has a 128-character limit on `alembic_version.version_num`).
   - Fully bidirectional: `upgrade()` creates tables, foreign keys, composite indexes, and unique constraints; `downgrade()` cleanly tears down in exact reverse dependency order.

2. **Fix in [`backend/alembic/env.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/env.py)**:
   - **Issue Discovered**: `env.py` was unconditionally overriding the database URL with cached `get_settings().DATABASE_URL`, ignoring `config.set_main_option("sqlalchemy.url", ...)` used by programmatic test fixtures and environment overrides.
   - **Resolution**: Updated `env.py` to prioritize `config.get_main_option("sqlalchemy.url")` and `os.environ.get("DATABASE_URL")` before falling back to `get_settings().DATABASE_URL`. This allows SQLite test fixtures, CLI migrations, and production pipelines to inject connection targets cleanly.

---

### 2.3 Connection Pool Hardening (Neon Serverless Protection)
- **File**: [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py).
- **Reasoning**: Neon's free tier enforces a strict limit of 20 concurrent connections. Default SQLAlchemy pooling (`pool_size=5, max_overflow=10`) across background tasks or multiple worker processes risks throwing `OperationalError: too many connections`.
- **Configuration**:
  - `pool_size = 3`: Low base connection allocation.
  - `max_overflow = 5`: Safe burst ceiling (max 8 connections per instance).
  - `pool_recycle = 300`: Refreshes connections every 5 minutes to prevent stale idle socket disconnects from Neon's autosuspend.
  - `pool_pre_ping = True`: Tests connection liveness before checking out from pool.

---

### 2.4 Pydantic Schemas
- **[`backend/app/schemas/schedule.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/schedule.py)**:
  - `ScheduleType`: Constrained to `"AVAILABLE" | "LEAVE" | "HOLIDAY" | "BLOCKED"`.
  - `ScheduleCreateRequest`: Validates payload and asserts `end_time > start_time`.
  - `ScheduleBulkCreateRequest`: Validates non-empty batch entries.
  - `ScheduleResponse`: ORM-compatible response mapping.
  - `AvailableSlotResponse`: Standard `{"start": "HH:MM", "end": "HH:MM"}` format.
- **[`backend/app/schemas/appointment.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/appointment.py)**:
  - `AppointmentStatus`: Constrained to `"BOOKED" | "COMPLETED" | "CANCELLED"`.
  - `AppointmentCreateRequest`: Required non-empty `patient_name`, date/time range validation.
  - `AppointmentRescheduleRequest`: Date/time validation for slot moves.
  - `AppointmentResponse` & `AppointmentListResponse`: Typed responses with pagination support (`page`, `page_size`, `total`).

---

### 2.5 Automated Testing Suite
- **File**: [`backend/tests/test_appointment_phase1.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/test_appointment_phase1.py).
- **Streamlining Decision**: Based on user guidance to avoid redundant test overkills, replaced 16 micro unit checks with 5 high-coverage integration tests:
  1. `test_models_and_relationships`: Verifies `Doctor` 1:N relations, persistence, and `TimestampMixin` auto-population.
  2. `test_appointment_unique_slot_constraint`: Asserts database-level `IntegrityError` when attempting duplicate booking of identical `(doctor_id, date, start_time)`.
  3. `test_schedule_and_appointment_schemas`: Validates enum restrictions, required fields, and time range assertions.
  4. `test_database_pool_settings`: Asserts configured `pool_size`, `max_overflow`, and `pool_recycle` on the app engine.
  5. `test_migration_006_upgrade_downgrade`: Full automated lifecycle upgrade to 006, rollback to 005, and re-upgrade to 006.
- **Test Results**: All 46 tests in the test suite pass cleanly (`46 passed, 5 warnings in 5.92s`).

---

## 3. Remote Verification & Neon Migration Execution
Following Phase 1 completion, the migration was applied and verified against the live Neon PostgreSQL database:

1. **Current Alembic Version Checked**: Verified database was at `005_alter_avatar_url_to_text`.
2. **Applied Migration**:
   ```bash
   railway run --service backend alembic upgrade head
   ```
   Migration applied cleanly with transactional DDL.
3. **Database Inspection on Neon**:
   - `schedules` and `appointments` tables confirmed created in schema `public`.
   - `uq_doctor_appointment_slot` unique constraint confirmed active in `pg_constraint`.
   - Current `alembic_version` updated to `006_appointment_system_foundation`.
4. **Backend Liveness**:
   - Queried Railway production API `GET /api/v1/health`.
   - Response: `{"status":"healthy","service":"doctor-platform-api","environment":"production",...}`.
   - Zero downtime experienced; existing doctor and practice routes completely unaffected.

---

## 4. Phase 2 Architecture & Implementation Reasoning (Schedule Engine & Slot Generation)

### 4.1 Schema Additions & Rate Limiting Configuration
1. **[`ScheduleListResponse`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/schedule.py)**:
   - Added standard paginated envelope (`items: List[ScheduleResponse]`, `page: int`, `page_size: int`, `total: int`).
2. **Rate Limiting Constant**:
   - Added `RATE_LIMIT_SCHEDULE: str = "30/minute"` in [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py) and documented in [`backend/.env.example`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env.example).

---

### 4.2 Schedule Service (`backend/app/services/schedule_service.py`)
Implemented deterministic schedule management and slot generation:
1. **`create_schedule_entries`**:
   - Validates time range ordering (`end_time > start_time`).
   - Detects and rejects overlapping `AVAILABLE` windows on the same date:
     - Internal batch collision detection ($A_{start} < B_{end} \land A_{end} > B_{start}$).
     - Persisted database collision detection against existing records for the doctor.
     - Raises `HTTPException(400, "Overlapping AVAILABLE schedule window detected on date {date}")`.
2. **`get_schedule`**:
   - Supports optional date filtering (`from_date`, `to_date`) with pagination (`page`, `page_size`, `total`).
   - Sorted chronologically (`date ASC, start_time ASC`).
3. **`delete_schedule_entry`**:
   - Doctor-scoped entry deletion with 404 enforcement if not found or owned by another doctor.
4. **`generate_available_slots`**:
   - **Step A (Candidate Intervals)**: Queries `AVAILABLE` schedule entries on `query_date`.
   - **Step B (Slot Slicing)**: Slices windows into contiguous 30-minute intervals $[t, t+30\text{m})$, dropping trailing fragments $< 30$m.
   - **Step C (Exclusion Windows)**: Queries `LEAVE`, `HOLIDAY`, and `BLOCKED` windows for that date.
   - **Step D (Occupied Appointments)**: Queries `BOOKED` and `COMPLETED` appointments (`CANCELLED` appointments are ignored).
   - **Step E (Intersection & Subtraction)**: Drops any candidate slot $[S_{start}, S_{end})$ where $S_{start} < E_{end} \land S_{end} > E_{start}$.
   - **Step F (Formatting)**: Returns deduplicated, sorted list of `{"start": "HH:MM", "end": "HH:MM"}`.

---

### 4.3 API Routes & Registration (`backend/app/api/routes/schedule.py` & `router.py`)
- `POST /api/v1/doctor/schedule`: Doctor authenticated, `@limiter.limit(30/min)`. Accepts single item, array, or `ScheduleBulkCreateRequest`. Returns 201 Created.
- `GET /api/v1/doctor/schedule`: Doctor authenticated. Paginated range query.
- `DELETE /api/v1/doctor/schedule/{id}`: Doctor authenticated. Returns 204 No Content.
- `GET /api/v1/doctor/available-slots`: Doctor authenticated slot generation for calendar management.
- `GET /api/v1/public/tenants/{slug}/available-slots`: Unauthenticated public endpoint, `@limiter.limit(30/min)`, resolves active tenant by slug.

---

### 4.4 Key Architectural Decisions
1. **Overlap Collision Detection for AVAILABLE Windows**:
   - Strictly rejects overlapping `AVAILABLE` windows on the same date ($A_{start} < B_{end} \land A_{end} > B_{start}$) both within incoming batches and against persisted records.
   - Raises `HTTPException(400, "Overlapping AVAILABLE schedule window detected on date {date}")`. Prevents ambiguous slot generation.
2. **Single & Batch Schedule Ingestion**:
   - `POST /api/v1/doctor/schedule` accepts `Union[ScheduleCreateRequest, List[ScheduleCreateRequest], ScheduleBulkCreateRequest]`.
   - Allows both single entries and bulk calendar population without introducing redundant endpoints.
3. **Full-Day Holiday Boundary Handling**:
   - Entries ending at `23:59` or `23:59:59` are normalized to 1,440 minutes (24:00) during exclusion checks, guaranteeing the trailing 30m window of the day is cleanly blocked.

---

### 4.5 Test Matrix & Verification Results
- **Schedule CRUD Suite ([`backend/tests/test_schedule.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/test_schedule.py))** (15 tests):
  - 2.1 Single AVAILABLE entry (201 Created)
  - 2.2 Bulk schedule entries (201 Created, distinct UUIDs)
  - 2.3 Reject invalid time range 13:00 to 09:00 (422)
  - 2.4 Reject invalid schedule type (422)
  - 2.5 Create LEAVE entry (201 Created)
  - 2.6 Create HOLIDAY entry (201 Created)
  - 2.7 Create BLOCKED entry (201 Created)
  - 2.8 List schedule range (200 OK, paginated)
  - 2.9 List empty range (200 OK, items=[], total=0)
  - 2.10 Delete entry (204 No Content)
  - 2.11 Delete cross-doctor forbidden (404 Not Found)
  - 2.12 Delete nonexistent ID (404 Not Found)
  - 2.13 Unauthenticated access rejection (401 Unauthorized)
  - 2.14 Rate limit creation (30 succeed, 31st returns 429)
  - Batch & persisted AVAILABLE overlap rejection (400 Bad Request)
- **Slot Generation Suite ([`backend/tests/test_slot_generation.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/test_slot_generation.py))** (14 tests):
  - 2.15 Basic 4h window 09:00–13:00 (8 slots)
  - 2.16 Multiple AVAILABLE windows (16 slots)
  - 2.17 LEAVE subtraction (4 slots remaining)
  - 2.18 HOLIDAY full-day (0 slots)
  - 2.19 BLOCKED window (6 slots)
  - 2.20 BOOKED appointment exclusion (7 slots)
  - 2.21 CANCELLED appointment preserved (8 slots)
  - 2.22 COMPLETED appointment blocked (7 slots)
  - 2.23 No AVAILABLE schedule on date (0 slots)
  - 2.24 Non-aligned window 09:00–10:15 (2 slots, trailing 15m dropped)
  - 2.25 Public slot endpoint (200 OK, 8 slots, unauthenticated)
  - 2.26 Public nonexistent tenant slug (404 Not Found)
  - 2.27 Public slot rate limit (30 succeed, 31st returns 429)
  - Authenticated doctor available-slots endpoint (200 OK)
- **Automated Verification**: Full suite passed cleanly: `75 passed, 5 warnings in 6.34s` (46 baseline + 29 new tests).
- **Manual Verification (Completed & Verified)**:
  - Spun up local server on `127.0.0.1:8009` with test doctor and tenant workspace (`dr-manual-tester`).
  - Executed `POST /api/v1/doctor/schedule` to add `AVAILABLE` (09:00–13:00) -> 201 Created.
  - Tested collision detection with overlapping `AVAILABLE` (12:00–15:00) -> 400 Bad Request returned as expected.
  - Added `LEAVE` exclusion (10:00–11:00) -> 201 Created.
  - Verified `GET /api/v1/doctor/schedule` -> 200 OK, paginated items returned.
  - Verified `GET /api/v1/doctor/available-slots` -> 200 OK, exactly 6 slots generated (10:00 and 10:30 cleanly excluded).
  - Verified `GET /api/v1/public/tenants/dr-manual-tester/available-slots` -> 200 OK unauthenticated, returns same 6 slots.
  - Verified `GET /api/v1/public/tenants/fake-slug/available-slots` -> 404 Not Found returned as expected.
  - Deleted `LEAVE` entry via `DELETE /api/v1/doctor/schedule/{id}` -> 204 No Content; verified all 8 slots instantly restored on public query.

---

## 5. Phase 3 Architecture & Implementation Reasoning (Appointment Lifecycle & Stub Cleanup)

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

## 6. Current Status & Next Steps

| Phase | Description | Status |
|:---|:---|:---|
| **Phase 1** | Database Models, Alembic Migration & Pool Hardening | **Completed & Verified** ✅ |
| **Phase 2** | Schedule Engine & Slot Generation (Backend) | **Completed & Verified** ✅ |
| **Phase 3** | Appointment Lifecycle & Stub Route Cleanup | **Completed & Verified** ✅ |
| **Phase 4** | Calendar Aggregator Service | Next ⏳ |
| **Phase 5** | Frontend API Client & TypeScript Types | Pending |
| **Phase 6** | Doctor Dashboard UI Expansion | Pending |
| **Phase 7** | Verification & Hardening | Pending |
| **Phase 8** | Production Deployment | Pending |

