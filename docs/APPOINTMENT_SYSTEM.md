# Stepwise Execution Plan: Doctor Appointment System (Doctor-Only)

## Scope

**In scope (build now):**
- Doctor schedule & availability management (AVAILABLE, LEAVE, HOLIDAY, BLOCKED)
- 30-minute slot generation engine
- Doctor-initiated appointment creation, cancellation, rescheduling, completion
- Doctor operational calendar (composite view)
- Doctor dashboard UI expansion (Calendar, Schedule, Appointments tabs)

**Designed for but NOT built:**
- Patient model, patient auth, patient routes, patient UI
- Appointment Requests table (patient-initiated; doctor creates appointments directly for now)

**Excluded entirely:**
- Notification service (Email / SMS / WhatsApp)
- Payment integration
- Video consultation scheduling

---

## Doctor-Only System Flow

```mermaid
flowchart TD
    subgraph DoctorSetup["Phase 1–2: Schedule Setup"]
        D1["Doctor Login"] --> D2["Dashboard"]
        D2 --> D3["Define Working Hours"]
        D3 --> D4["POST /doctor/schedule"]
        D4 --> D5["Save Schedule Events<br/>(AVAILABLE windows)"]
        D2 --> D6["Mark Leave / Holiday / Block"]
        D6 --> D7["POST /doctor/schedule<br/>(type: LEAVE/HOLIDAY/BLOCKED)"]
    end

    subgraph SlotEngine["Phase 2: Slot Generation"]
        D5 --> S1["Slot Generation Engine"]
        D7 --> S1
        S1 --> S2["30-min candidate slots"]
        S2 --> S3["Subtract LEAVE + HOLIDAY + BLOCKED"]
        S3 --> S4["Subtract existing BOOKED appointments"]
        S4 --> S5["Available Slots<br/>GET /doctor/available-slots?date="]
    end

    subgraph AppointmentOps["Phase 3: Appointment Lifecycle"]
        D2 --> A1["Create Appointment"]
        A1 --> A2["Select patient info + slot"]
        A2 --> A3["POST /doctor/appointments"]
        A3 --> A4{"Atomic Validation"}
        A4 -->|Valid| A5["Appointment Created<br/>status = BOOKED"]
        A4 -->|Conflict| A6["409 Conflict"]
        A5 --> A7["Cancel / Reschedule / Complete"]
    end

    subgraph CalendarView["Phase 4: Calendar"]
        D2 --> C1["GET /doctor/calendar?from=&to="]
        C1 --> C2["Composite View:<br/>Schedule + Appointments + Blocks"]
    end
```

---

## Phase 1: Database Models & Alembic Migration

**Goal:** Create `Schedule` and `Appointment` tables. Design `Appointment` with a nullable `patient_id` FK for future patient system, but don't create the `Patient` model yet.

### 1.1 Schedule Model

**New file:** `backend/app/models/schedule.py`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | `UUID` | PK, default `uuid4` |
| `doctor_id` | `UUID` | FK → `doctors.id`, NOT NULL, indexed |
| `date` | `Date` | NOT NULL |
| `start_time` | `Time` | NOT NULL |
| `end_time` | `Time` | NOT NULL |
| `type` | `String(20)` | NOT NULL, values: `AVAILABLE`, `LEAVE`, `HOLIDAY`, `BLOCKED` |
| `reason` | `Text` | nullable |
| `created_at` | `DateTime` | `TimestampMixin` |
| `updated_at` | `DateTime` | `TimestampMixin` |

- **Index:** `(doctor_id, date)` composite for fast day lookups.
- **Relationship:** `Doctor` → `schedules` (1:many).

### 1.2 Appointment Model

**New file:** `backend/app/models/appointment.py`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | `UUID` | PK, default `uuid4` |
| `doctor_id` | `UUID` | FK → `doctors.id`, NOT NULL, indexed |
| `patient_id` | `UUID` | nullable (no FK yet — future `patients.id` FK) |
| `request_id` | `UUID` | nullable (future `appointment_requests.id` FK) |
| `patient_name` | `String(255)` | NOT NULL (inline for now; replaced by FK join later) |
| `patient_contact` | `String(100)` | nullable |
| `date` | `Date` | NOT NULL |
| `start_time` | `Time` | NOT NULL |
| `end_time` | `Time` | NOT NULL |
| `reason` | `Text` | nullable |
| `notes` | `Text` | nullable (doctor's private notes) |
| `status` | `String(20)` | NOT NULL, values: `BOOKED`, `COMPLETED`, `CANCELLED` |
| `created_at` | `DateTime` | `TimestampMixin` |
| `updated_at` | `DateTime` | `TimestampMixin` |

- **Constraint:** `UniqueConstraint("doctor_id", "date", "start_time", name="uq_doctor_appointment_slot")` — prevents double-booking.
- **Index:** `(doctor_id, date)` for calendar queries.
- **Index:** `(doctor_id, status)` for filtered listing.

> [!IMPORTANT]
> `patient_name` and `patient_contact` are inline text fields used now. When the Patient system is built later, `patient_id` becomes a proper FK and these fields become derived from the join. This avoids building the Patient model prematurely while keeping the appointment fully functional.

### 1.3 Model Registration

**Edit:** [`backend/app/models/__init__.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/__init__.py) — import `Schedule` and `Appointment`.

### 1.4 Alembic Migration

**New file:** `backend/alembic/versions/006_appointment_system_foundation.py`

- Creates `schedules` and `appointments` tables.
- Adds indexes and unique constraints.
- Verify: `cd backend && alembic upgrade head`.

> [!CAUTION]
> **Migration filename must stay under 128 characters.** Neon's `alembic_version` table was widened to `VARCHAR(128)` during initial deployment (see [`deployment.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/deployment.md) Challenge #1). The name `006_appointment_system_foundation` (38 chars) is safe.

### 1.5 Neon Connection Pool Hardening

**Edit:** [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py) — add explicit pool config for Neon free tier (20 connection limit):

```python
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,          # Neon free tier safe (20 max connections)
    max_overflow=5,       # Burst capacity under load
    pool_recycle=300,     # Recycle stale connections (Neon idle timeout)
    connect_args=connect_args,
)
```

> [!WARNING]
> Without this, SQLAlchemy defaults to `pool_size=5, max_overflow=10` (15 connections). The new schedule + appointment queries under concurrent doctor usage could exhaust Neon's 20-connection limit and cause `OperationalError: too many connections`.

### 1.6 Pydantic Schemas

**New file:** `backend/app/schemas/schedule.py`

- `ScheduleCreateRequest`: `date`, `start_time`, `end_time`, `type`, `reason?`
- `ScheduleBulkCreateRequest`: `entries: list[ScheduleCreateRequest]`
- `ScheduleResponse`: full schedule event with `id`
- `AvailableSlotResponse`: `start: str`, `end: str`

**New file:** `backend/app/schemas/appointment.py`

- `AppointmentCreateRequest`: `patient_name`, `patient_contact?`, `date`, `start_time`, `end_time`, `reason?`, `notes?`
- `AppointmentResponse`: full appointment with all fields (+ `page`, `page_size`, `total` in list responses)
- `AppointmentRescheduleRequest`: `date`, `start_time`, `end_time`

### Phase 1 Test Cases

| # | Test Case | Input / Action | Expected Result |
|:---|:---|:---|:---|
| 1.1 | Migration applies cleanly | `cd backend && alembic upgrade head` | Exit code 0. Tables `schedules` and `appointments` exist in DB. `alembic_version` = `006_appointment_system_foundation` |
| 1.2 | Migration rolls back cleanly | `cd backend && alembic downgrade -1` | Exit code 0. Tables `schedules` and `appointments` dropped. `alembic_version` reverts to `005_alter_avatar_url_to_text` |
| 1.3 | Schedule model import | `from app.models.schedule import Schedule` | No `ImportError`. `Schedule.__tablename__ == "schedules"` |
| 1.4 | Appointment model import | `from app.models.appointment import Appointment` | No `ImportError`. `Appointment.__tablename__ == "appointments"` |
| 1.5 | No circular dependency | `from app.models import Schedule, Appointment, Doctor, Tenant` | All four models importable in a single statement without `ImportError` |
| 1.6 | Schedule model fields | Inspect `Schedule.__table__.columns` | Contains: `id` (UUID PK), `doctor_id` (UUID FK), `date` (Date), `start_time` (Time), `end_time` (Time), `type` (String(20)), `reason` (Text nullable), `created_at`, `updated_at` |
| 1.7 | Appointment model fields | Inspect `Appointment.__table__.columns` | Contains: `id`, `doctor_id`, `patient_id` (nullable), `request_id` (nullable), `patient_name`, `patient_contact` (nullable), `date`, `start_time`, `end_time`, `reason` (nullable), `notes` (nullable), `status`, `created_at`, `updated_at` |
| 1.8 | Unique constraint exists | Attempt `INSERT` two appointments with same `(doctor_id, date, start_time)` | Second insert raises `IntegrityError` due to `uq_doctor_appointment_slot` |
| 1.9 | Composite index exists | Inspect `schedules` table indexes | Index on `(doctor_id, date)` present |
| 1.10 | Doctor→Schedule relationship | Create a Doctor, then `doctor.schedules` | Returns empty list (no error). Adding a Schedule shows it in `doctor.schedules` |
| 1.11 | TimestampMixin on Schedule | Create a Schedule row, inspect `created_at` | Non-null `datetime` with timezone. `updated_at` auto-populates |
| 1.12 | TimestampMixin on Appointment | Create an Appointment row, inspect `created_at` | Non-null `datetime` with timezone. `updated_at` auto-populates |
| 1.13 | ScheduleCreateRequest validation | `ScheduleCreateRequest(date="2026-10-12", start_time="09:00", end_time="13:00", type="AVAILABLE")` | Passes validation. All fields correctly parsed |
| 1.14 | ScheduleCreateRequest — invalid type | `ScheduleCreateRequest(type="INVALID")` | `ValidationError` raised — type must be one of `AVAILABLE`, `LEAVE`, `HOLIDAY`, `BLOCKED` |
| 1.15 | AppointmentCreateRequest — missing patient_name | `AppointmentCreateRequest(date="2026-10-12", ...)` without `patient_name` | `ValidationError` — `patient_name` is required |
| 1.16 | Connection pool config | Inspect `engine.pool` attributes | `pool.size() == 3`, `pool._max_overflow == 5`, `pool._recycle == 300` |

---

## Phase 2: Schedule Engine & Slot Generation (Backend)

**Goal:** Doctor can define working hours and unavailable periods. System generates 30-minute available slots.

### 2.1 Schedule Service

**New file:** `backend/app/services/schedule_service.py`

Core logic:
1. **`create_schedule_entries(doctor_id, entries)`** — batch insert schedule events with validation (end_time > start_time, no overlapping AVAILABLE windows on same date).
2. **`get_schedule(doctor_id, from_date, to_date)`** — query all schedule events in range.
3. **`delete_schedule_entry(doctor_id, schedule_id)`** — remove with ownership check.
4. **`generate_available_slots(doctor_id, date)`**:
   - Query all `AVAILABLE` entries for doctor + date → candidate intervals.
   - Slice each interval into 30-minute slots.
   - Query `LEAVE`, `HOLIDAY`, `BLOCKED` entries for that date → exclusion intervals.
   - Query `appointments` with `status = BOOKED` for that date → occupied slots.
   - Return only slots that don't overlap any exclusion or occupied interval.

### 2.2 Schedule Routes

**New file:** `backend/app/api/routes/schedule.py`

| Method | Path | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/doctor/schedule` | `get_current_doctor` | `30/minute` | Create schedule entries (single or bulk) |
| `GET` | `/doctor/schedule` | `get_current_doctor` | global | List schedule events (query: `from`, `to`, `page`, `page_size`) |
| `DELETE` | `/doctor/schedule/{id}` | `get_current_doctor` | global | Delete a schedule entry |
| `GET` | `/doctor/available-slots` | `get_current_doctor` | global | Generated slots for a date (doctor's own view) |

**Public slot endpoint** (for future patient use, also useful for the existing public slug page):

| Method | Path | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/public/tenants/{slug}/available-slots` | None | `30/minute` | Generated slots by slug + date |

> [!WARNING]
> The public slot endpoint is unauthenticated — without its own rate limit, it's vulnerable to scraping attacks that could enumerate doctor availability patterns. Apply `@limiter.limit("30/minute")` using the existing SlowAPI infrastructure from [`rate_limit.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/rate_limit.py).

All list endpoints (`GET /doctor/schedule`) must accept pagination query params:
```python
page: int = Query(1, ge=1)
page_size: int = Query(20, ge=1, le=100)
```

### 2.3 Route Registration

**Edit:** [`backend/app/main.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/main.py) — register `schedule_router` with prefix `/doctor` and public slot route under `/public`.

### Phase 2 Test Cases

**File:** `backend/tests/test_schedule.py` + `backend/tests/test_slot_generation.py`

#### Schedule CRUD Tests

| # | Test Case | Input / Action | Expected Result |
|:---|:---|:---|:---|
| 2.1 | Create single AVAILABLE entry | `POST /doctor/schedule` with `{date: "2026-10-12", start_time: "09:00", end_time: "13:00", type: "AVAILABLE"}` | `HTTP 201`. Response contains `id` (UUID), all submitted fields echoed back, `created_at` populated |
| 2.2 | Create bulk schedule entries | `POST /doctor/schedule` with array of 3 AVAILABLE entries for Mon/Tue/Wed | `HTTP 201`. All 3 entries created with distinct UUIDs |
| 2.3 | Reject invalid time range | `POST /doctor/schedule` with `start_time: "13:00", end_time: "09:00"` | `HTTP 422` or `400`. Error: `end_time must be after start_time` |
| 2.4 | Reject invalid schedule type | `POST /doctor/schedule` with `type: "VACATION"` | `HTTP 422`. Validation error — type must be `AVAILABLE\|LEAVE\|HOLIDAY\|BLOCKED` |
| 2.5 | Create LEAVE entry | `POST /doctor/schedule` with `{type: "LEAVE", date: "2026-10-15", start_time: "10:00", end_time: "12:00"}` | `HTTP 201`. Entry created with `type: "LEAVE"` |
| 2.6 | Create HOLIDAY (full day) | `POST /doctor/schedule` with `{type: "HOLIDAY", date: "2026-10-20", start_time: "00:00", end_time: "23:59", reason: "Eid"}` | `HTTP 201`. Full-day holiday with reason |
| 2.7 | Create BLOCKED entry | `POST /doctor/schedule` with `{type: "BLOCKED", reason: "Clinic meeting"}` | `HTTP 201`. Blocked period with reason stored |
| 2.8 | List schedule in date range | `GET /doctor/schedule?from=2026-10-12&to=2026-10-14` | `HTTP 200`. Returns only entries within the date range. Pagination: `page`, `page_size`, `total` in response |
| 2.9 | List schedule — empty range | `GET /doctor/schedule?from=2099-01-01&to=2099-01-31` | `HTTP 200`. Empty array `[]`, `total: 0` |
| 2.10 | Delete schedule entry | `DELETE /doctor/schedule/{id}` with valid schedule ID | `HTTP 204` or `200`. Entry no longer appears in `GET /doctor/schedule` |
| 2.11 | Delete — wrong doctor | Doctor B tries `DELETE /doctor/schedule/{doctor_a_schedule_id}` | `HTTP 404`. Ownership check prevents deletion of another doctor's schedule |
| 2.12 | Delete — nonexistent ID | `DELETE /doctor/schedule/{random-uuid}` | `HTTP 404` |
| 2.13 | Unauthenticated schedule access | `POST /doctor/schedule` without Bearer token | `HTTP 401` or `403` |
| 2.14 | Rate limit — schedule creation | Submit 31 `POST /doctor/schedule` within 1 minute | First 30 succeed. 31st returns `HTTP 429` with rate limit headers |

#### Slot Generation Tests

| # | Test Case | Setup | Input | Expected Result |
|:---|:---|:---|:---|:---|
| 2.15 | Basic 30-min slots (4 hours) | AVAILABLE 09:00–13:00 | `GET /doctor/available-slots?date=2026-10-12` | 8 slots: `[09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00, 11:00-11:30, 11:30-12:00, 12:00-12:30, 12:30-13:00]` |
| 2.16 | Multiple AVAILABLE windows | AVAILABLE 09:00–13:00 + AVAILABLE 16:00–20:00 | Same query | 16 slots total: 8 morning + 8 afternoon |
| 2.17 | LEAVE subtracts from AVAILABLE | AVAILABLE 09:00–13:00 + LEAVE 10:00–12:00 | Same query | 4 slots: `[09:00-09:30, 09:30-10:00, 12:00-12:30, 12:30-13:00]` |
| 2.18 | HOLIDAY produces zero slots | AVAILABLE 09:00–13:00 + HOLIDAY full day | Same query | 0 slots: empty `[]` |
| 2.19 | BLOCKED subtracts from AVAILABLE | AVAILABLE 09:00–13:00 + BLOCKED 11:00–12:00 (reason: "Personal") | Same query | 6 slots (11:00–11:30 and 11:30–12:00 removed) |
| 2.20 | Booked appointment removes slot | AVAILABLE 09:00–13:00 + BOOKED appointment at 10:00–10:30 | Same query | 7 slots (10:00–10:30 removed from 8) |
| 2.21 | Cancelled appointment frees slot | AVAILABLE 09:00–13:00 + CANCELLED appointment at 10:00–10:30 | Same query | 8 slots — cancelled appointment does NOT block |
| 2.22 | Completed appointment blocks slot | AVAILABLE 09:00–13:00 + COMPLETED appointment at 10:00–10:30 | Same query | 7 slots — completed still occupies historical slot |
| 2.23 | No AVAILABLE = no slots | No schedule entries for date | Same query | 0 slots: empty `[]` |
| 2.24 | Non-aligned window edge | AVAILABLE 09:00–10:15 | Same query | 2 slots: `[09:00-09:30, 09:30-10:00]` — partial 15-min remainder discarded |
| 2.25 | Public slot endpoint | AVAILABLE 09:00–13:00 for Dr. Ahmed (slug: `dr-ahmed`) | `GET /public/tenants/dr-ahmed/available-slots?date=2026-10-12` | `HTTP 200`. Same 8 slots. No auth required |
| 2.26 | Public slot — invalid slug | None | `GET /public/tenants/nonexistent/available-slots?date=2026-10-12` | `HTTP 404`. Error: tenant not found |
| 2.27 | Public slot — rate limit | 31 requests in 1 minute | Same endpoint | 31st returns `HTTP 429` |

---

## Phase 3: Appointment Lifecycle (Backend)

**Goal:** Doctor can create, cancel, reschedule, and complete appointments with atomic concurrency protection.

### 3.1 Appointment Service

**New file:** `backend/app/services/appointment_service.py`

1. **`create_appointment(doctor_id, payload)`**:
   - Verify slot falls within an `AVAILABLE` schedule window for that date.
   - Verify no `LEAVE`, `HOLIDAY`, or `BLOCKED` overlap.
   - Verify no existing `BOOKED` appointment at same `(doctor_id, date, start_time)`.
   - Insert with `status = BOOKED`.
   - Catch `IntegrityError` from unique constraint → return 409.

2. **`cancel_appointment(doctor_id, appointment_id)`**:
   - Verify ownership and `status == BOOKED`.
   - Transition to `CANCELLED`.

3. **`complete_appointment(doctor_id, appointment_id)`**:
   - Verify ownership and `status == BOOKED`.
   - Transition to `COMPLETED`.

4. **`reschedule_appointment(doctor_id, appointment_id, new_date, new_start, new_end)`**:
   - Run same availability validation as create for the new slot.
   - Update appointment date/time fields.
   - Status remains `BOOKED`.

5. **`list_appointments(doctor_id, status_filter?, from_date?, to_date?)`**:
   - Filtered query with pagination.

### 3.2 Appointment Routes

**New file:** `backend/app/api/routes/appointment.py`

| Method | Path | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/doctor/appointments` | `get_current_doctor` | `20/minute` | Create appointment |
| `GET` | `/doctor/appointments` | `get_current_doctor` | global | List (query: `status`, `from`, `to`, `page`, `page_size`) |
| `GET` | `/doctor/appointments/{id}` | `get_current_doctor` | global | Get single appointment |
| `POST` | `/doctor/appointments/{id}/cancel` | `get_current_doctor` | `20/minute` | Cancel |
| `POST` | `/doctor/appointments/{id}/complete` | `get_current_doctor` | `20/minute` | Complete |
| `PATCH` | `/doctor/appointments/{id}` | `get_current_doctor` | `20/minute` | Reschedule (new date/time) |

All list endpoints must support pagination:
```python
page: int = Query(1, ge=1)
page_size: int = Query(20, ge=1, le=100)
```

### 3.3 Deprecate Old Stub Booking Route

**Edit:** [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py) — **remove** the existing fake `POST /tenants/{slug}/appointments` endpoint (lines 63–101) that returns a stub `APT-XXXX` booking response. This conflicts with the new real appointment system.

> [!IMPORTANT]
> Keep the medicine order (`POST /tenants/{slug}/medicine-orders`) and report upload (`POST /tenants/{slug}/reports`) stubs untouched — they are separate features. Only the appointment stub is replaced.

**Edit:** [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts) — remove or deprecate `bookPublicAppointment()` function (replaced by `getPublicAvailableSlots()` in Phase 5).

### 3.4 Route Registration

**Edit:** [`backend/app/api/routes/__init__.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/__init__.py) and [`router.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/router.py) — register `appointment_router`.

### Phase 3 Test Cases

**File:** `backend/tests/test_appointment_lifecycle.py`

#### Appointment Creation Tests

| # | Test Case | Setup | Input / Action | Expected Result |
|:---|:---|:---|:---|:---|
| 3.1 | Create appointment in valid slot | AVAILABLE 09:00–13:00 on 2026-10-12 | `POST /doctor/appointments` with `{patient_name: "Patient A", date: "2026-10-12", start_time: "10:00", end_time: "10:30"}` | `HTTP 201`. Response: `status: "BOOKED"`, `id` (UUID), `patient_name: "Patient A"`, `created_at` populated |
| 3.2 | Create with optional fields | Same setup | Include `patient_contact: "9876543210"`, `reason: "General checkup"`, `notes: "First visit"` | `HTTP 201`. All optional fields stored and returned |
| 3.3 | Create outside AVAILABLE window | AVAILABLE 09:00–13:00 | `start_time: "14:00", end_time: "14:30"` | `HTTP 400`. Error: slot does not fall within any AVAILABLE schedule window |
| 3.4 | Create during LEAVE period | AVAILABLE 09:00–13:00 + LEAVE 10:00–12:00 | `start_time: "10:30", end_time: "11:00"` | `HTTP 400`. Error: slot overlaps with LEAVE period |
| 3.5 | Create during HOLIDAY | AVAILABLE 09:00–13:00 + HOLIDAY full day | `start_time: "09:00", end_time: "09:30"` | `HTTP 400`. Error: slot overlaps with HOLIDAY |
| 3.6 | Create during BLOCKED period | AVAILABLE 09:00–13:00 + BLOCKED 11:00–12:00 | `start_time: "11:00", end_time: "11:30"` | `HTTP 400`. Error: slot overlaps with BLOCKED period |
| 3.7 | Create with no schedule | No schedule entries for date | Any slot on that date | `HTTP 400`. Error: no AVAILABLE schedule window for this date |
| 3.8 | Missing patient_name | Same setup | Omit `patient_name` | `HTTP 422`. Validation error: `patient_name` is required |

#### Concurrency & Double-Booking Tests

| # | Test Case | Setup | Input / Action | Expected Result |
|:---|:---|:---|:---|:---|
| 3.9 | Duplicate slot — same doctor | AVAILABLE 09:00–13:00 + existing BOOKED at 10:00–10:30 | `POST /doctor/appointments` with same `(date, start_time)` | `HTTP 409`. Error: slot already booked. `UniqueConstraint` prevents duplicate |
| 3.10 | Same slot, different doctor | Doctor A has BOOKED at 10:00. Doctor B has AVAILABLE 09:00–13:00 | Doctor B creates appointment at 10:00–10:30 | `HTTP 201`. Succeeds — constraint is per-doctor, not global |
| 3.11 | Slot freed after cancellation | BOOKED at 10:00 → Cancel it → Create new appointment at 10:00 | New `POST /doctor/appointments` at same slot | `HTTP 201`. Slot is available again after cancellation |

#### State Transition Tests

| # | Test Case | Setup | Input / Action | Expected Result |
|:---|:---|:---|:---|:---|
| 3.12 | Cancel BOOKED appointment | BOOKED appointment (id: `apt-1`) | `POST /doctor/appointments/apt-1/cancel` | `HTTP 200`. `status` transitions to `CANCELLED`. Slot freed for available-slots query |
| 3.13 | Cancel already CANCELLED | CANCELLED appointment | `POST .../cancel` | `HTTP 400`. Error: only BOOKED appointments can be cancelled |
| 3.14 | Cancel COMPLETED appointment | COMPLETED appointment | `POST .../cancel` | `HTTP 400`. Error: completed appointments cannot be cancelled |
| 3.15 | Complete BOOKED appointment | BOOKED appointment | `POST /doctor/appointments/apt-1/complete` | `HTTP 200`. `status` transitions to `COMPLETED` |
| 3.16 | Complete already COMPLETED | COMPLETED appointment | `POST .../complete` | `HTTP 400`. Error: appointment already completed |
| 3.17 | Complete CANCELLED appointment | CANCELLED appointment | `POST .../complete` | `HTTP 400`. Error: cancelled appointments cannot be completed |

#### Reschedule Tests

| # | Test Case | Setup | Input / Action | Expected Result |
|:---|:---|:---|:---|:---|
| 3.18 | Reschedule to valid new slot | BOOKED at 10:00. AVAILABLE 09:00–13:00 | `PATCH /doctor/appointments/apt-1` with `{date: "2026-10-12", start_time: "11:00", end_time: "11:30"}` | `HTTP 200`. Appointment moved to 11:00–11:30. Status remains `BOOKED`. Old slot (10:00) freed |
| 3.19 | Reschedule to occupied slot | BOOKED at 10:00 + another BOOKED at 11:00 | `PATCH .../apt-1` with `start_time: "11:00"` | `HTTP 409`. Error: target slot already occupied |
| 3.20 | Reschedule to different date | BOOKED on Oct 12. AVAILABLE on Oct 14 09:00–13:00 | `PATCH .../apt-1` with `{date: "2026-10-14", start_time: "09:00", end_time: "09:30"}` | `HTTP 200`. Date updated. Oct 12 slot freed, Oct 14 slot occupied |
| 3.21 | Reschedule CANCELLED appointment | CANCELLED appointment | `PATCH .../cancel_apt` | `HTTP 400`. Error: only BOOKED appointments can be rescheduled |
| 3.22 | Reschedule to LEAVE period | BOOKED at 10:00 + LEAVE 14:00–16:00 | `PATCH` to `start_time: "14:30"` | `HTTP 400`. Error: target slot overlaps LEAVE |

#### Listing & Pagination Tests

| # | Test Case | Setup | Input / Action | Expected Result |
|:---|:---|:---|:---|:---|
| 3.23 | List all appointments | 5 appointments (2 BOOKED, 2 COMPLETED, 1 CANCELLED) | `GET /doctor/appointments` | `HTTP 200`. Returns all 5. Response includes `page: 1, page_size: 20, total: 5` |
| 3.24 | Filter by status | Same 5 appointments | `GET /doctor/appointments?status=BOOKED` | `HTTP 200`. Returns only 2 BOOKED. `total: 2` |
| 3.25 | Filter by date range | Appointments on Oct 12, 14, 18 | `GET /doctor/appointments?from=2026-10-13&to=2026-10-15` | `HTTP 200`. Returns only Oct 14 appointment |
| 3.26 | Pagination — page 2 | 25 appointments | `GET /doctor/appointments?page=2&page_size=10` | `HTTP 200`. Returns 10 items, `page: 2, total: 25` |
| 3.27 | Get single appointment | Existing appointment `apt-1` | `GET /doctor/appointments/apt-1` | `HTTP 200`. Full appointment object returned |
| 3.28 | Get nonexistent appointment | None | `GET /doctor/appointments/{random-uuid}` | `HTTP 404` |
| 3.29 | Get another doctor's appointment | Doctor A's appointment | Doctor B calls `GET /doctor/appointments/{doctor_a_apt_id}` | `HTTP 404`. Ownership isolation enforced |

#### Stub Cleanup Tests

| # | Test Case | Input / Action | Expected Result |
|:---|:---|:---|:---|
| 3.30 | Old stub endpoint removed | `POST /api/v1/public/tenants/dr-ahmed/appointments` with old payload format | `HTTP 404` or `405`. Endpoint no longer exists |
| 3.31 | Medicine order stub intact | `POST /api/v1/public/tenants/dr-ahmed/medicine-orders` | `HTTP 201`. Still returns mock response — unchanged |
| 3.32 | Report upload stub intact | `POST /api/v1/public/tenants/dr-ahmed/reports` | `HTTP 201`. Still returns mock response — unchanged |

---

## Phase 4: Doctor Calendar Aggregator (Backend)

**Goal:** Single endpoint that composes schedules + appointments into a unified calendar view.

### 4.1 Calendar Service

**New file:** `backend/app/services/calendar_service.py`

**`get_doctor_calendar(doctor_id, from_date, to_date)`**:
- Query schedules in range → group by date.
- Query appointments in range → group by date.
- For each date, generate time-ordered event list:

```json
{
  "dates": [
    {
      "date": "2026-10-12",
      "events": [
        { "type": "AVAILABLE", "start": "09:00", "end": "09:30" },
        { "type": "APPOINTMENT", "start": "09:30", "end": "10:00", "patient_name": "Patient A", "status": "BOOKED", "appointment_id": "..." },
        { "type": "BLOCKED", "start": "11:00", "end": "12:00", "reason": "Personal work" },
        { "type": "LEAVE", "start": "12:00", "end": "13:00" }
      ]
    }
  ]
}
```

### 4.2 Calendar Route

Add to `backend/app/api/routes/schedule.py` (or separate `calendar.py`):

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/doctor/calendar` | `get_current_doctor` | Query: `from`, `to` (max 31 days) |

### Phase 4 Test Cases

**File:** `backend/tests/test_calendar.py`

| # | Test Case | Setup | Input / Action | Expected Result |
|:---|:---|:---|:---|:---|
| 4.1 | Calendar with mixed event types | Oct 12: AVAILABLE 09:00–13:00, BOOKED 09:30–10:00 (Patient A), BLOCKED 11:00–12:00, LEAVE 12:00–13:00 | `GET /doctor/calendar?from=2026-10-12&to=2026-10-12` | `HTTP 200`. Single date entry with 4+ events: `AVAILABLE` gaps (09:00–09:30, 10:00–10:30, 10:30–11:00), `APPOINTMENT` (09:30–10:00, Patient A, BOOKED), `BLOCKED` (11:00–12:00), `LEAVE` (12:00–13:00). Events **sorted by start time** |
| 4.2 | Calendar — multiple days | Oct 12: AVAILABLE + 1 appointment. Oct 13: AVAILABLE only. Oct 14: HOLIDAY | `GET /doctor/calendar?from=2026-10-12&to=2026-10-14` | `HTTP 200`. `dates` array has 3 entries. Oct 12: AVAILABLE + APPOINTMENT events. Oct 13: AVAILABLE only. Oct 14: single HOLIDAY event |
| 4.3 | CANCELLED appointment in calendar | BOOKED then CANCELLED at 10:00 | Same query | Calendar does NOT show cancelled appointment as blocking the slot. The 10:00–10:30 slot appears as AVAILABLE |
| 4.4 | COMPLETED appointment in calendar | COMPLETED appointment at 10:00 | Same query | Calendar shows event `{type: "APPOINTMENT", status: "COMPLETED", ...}` — visible in history but slot is occupied |
| 4.5 | Empty date range | No schedule or appointments exist for Jan 2099 | `GET /doctor/calendar?from=2099-01-01&to=2099-01-31` | `HTTP 200`. `dates: []` empty array |
| 4.6 | Max 31-day range | | `GET /doctor/calendar?from=2026-10-01&to=2026-11-15` | `HTTP 400`. Error: date range exceeds 31 days |
| 4.7 | Invalid date format | | `GET /doctor/calendar?from=October&to=November` | `HTTP 422`. Validation error on date format |
| 4.8 | Calendar event ordering | AVAILABLE 09:00–13:00 + BOOKED 10:00 + BLOCKED 11:00–12:00 + BOOKED 09:30 | Same query | Events sorted by `start` time: AVAILABLE 09:00, APPOINTMENT 09:30, APPOINTMENT 10:00, AVAILABLE 10:30, BLOCKED 11:00, AVAILABLE 12:00, AVAILABLE 12:30 |
| 4.9 | Multiple availability windows | AVAILABLE 09:00–13:00 + AVAILABLE 16:00–20:00 + BOOKED 16:30 | Same query | Morning and afternoon blocks both appear. 16:30 slot shows as APPOINTMENT, surrounding slots as AVAILABLE |
| 4.10 | Cross-doctor isolation | Doctor A has appointments. Doctor B queries calendar | Doctor B's `GET /doctor/calendar` | Returns only Doctor B's data. Doctor A's appointments/schedule not visible |
| 4.11 | Unauthenticated calendar | No Bearer token | `GET /doctor/calendar?from=...&to=...` | `HTTP 401` |

---

## Phase 5: Frontend API Layer (`lib/api.ts`)

**Goal:** Add typed interfaces and client functions for schedule, appointment, and calendar.

### 5.1 Type Definitions

Add to [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts):

```typescript
// Schedule types
export type ScheduleType = "AVAILABLE" | "LEAVE" | "HOLIDAY" | "BLOCKED";

export interface ScheduleEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: ScheduleType;
  reason?: string;
}

export interface ScheduleCreatePayload {
  date: string;
  start_time: string;
  end_time: string;
  type: ScheduleType;
  reason?: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
}

// Appointment types
export type AppointmentStatus = "BOOKED" | "COMPLETED" | "CANCELLED";

export interface AppointmentEntry {
  id: string;
  patient_name: string;
  patient_contact?: string;
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
  notes?: string;
  status: AppointmentStatus;
  created_at: string;
}

export interface AppointmentCreatePayload {
  patient_name: string;
  patient_contact?: string;
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
  notes?: string;
}

export interface AppointmentReschedulePayload {
  date: string;
  start_time: string;
  end_time: string;
}

// Calendar types
export interface CalendarEvent {
  type: ScheduleType | "APPOINTMENT";
  start: string;
  end: string;
  reason?: string;
  patient_name?: string;
  status?: AppointmentStatus;
  appointment_id?: string;
}

export interface CalendarDay {
  date: string;
  events: CalendarEvent[];
}

export interface DoctorCalendarResponse {
  dates: CalendarDay[];
}
```

### 5.2 Client Functions

```text
createDoctorSchedule(entries)     → POST /doctor/schedule
getDoctorSchedule(from, to)       → GET  /doctor/schedule
deleteDoctorSchedule(id)          → DELETE /doctor/schedule/{id}
getDoctorAvailableSlots(date)     → GET  /doctor/available-slots
getPublicAvailableSlots(slug, d)  → GET  /public/tenants/{slug}/available-slots

createAppointment(payload)        → POST /doctor/appointments
getDoctorAppointments(filters)    → GET  /doctor/appointments
getAppointment(id)                → GET  /doctor/appointments/{id}
cancelAppointment(id)             → POST /doctor/appointments/{id}/cancel
completeAppointment(id)           → POST /doctor/appointments/{id}/complete
rescheduleAppointment(id, payload)→ PATCH /doctor/appointments/{id}

getDoctorCalendar(from, to)       → GET  /doctor/calendar
```

---

## Phase 6: Doctor Dashboard UI Expansion

**Goal:** Transform [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dashboard/page.tsx) from a monolithic profile editor into a tabbed workspace.

### 6.1 Dashboard Navigation Structure

```text
Doctor Dashboard
├── Overview         (daily stats, today's appointments, pending count)
├── Calendar         (day/week view — composite schedule + appointments)
├── Schedule         (manage working hours, mark leave/holiday/block)
├── Appointments     (list view with Cancel/Complete/Reschedule actions)
├── Profile          (existing profile editor — move from current dashboard)
└── Android App      (existing APK builder — move from current dashboard)
```

### 6.2 Component Breakdown

| Component | File | Description |
| :--- | :--- | :--- |
| `DashboardShell` | `components/dashboard/DashboardShell.tsx` | Sidebar/tab nav + content area |
| `OverviewTab` | `components/dashboard/OverviewTab.tsx` | Today's summary cards |
| `CalendarTab` | `components/dashboard/CalendarTab.tsx` | Day view with time grid, color-coded events |
| `ScheduleTab` | `components/dashboard/ScheduleTab.tsx` | Add working hours, mark leave/holiday/block |
| `AppointmentsTab` | `components/dashboard/AppointmentsTab.tsx` | Filterable appointment table with action buttons |
| `ProfileTab` | `components/dashboard/ProfileTab.tsx` | Extract existing profile form from dashboard |
| `AndroidAppTab` | `components/dashboard/AndroidAppTab.tsx` | Extract existing APK builder from dashboard |

### 6.3 Calendar Day View Spec

```text
┌─────────────────────────────────────────┐
│  ◀ Mon 12 Oct 2026 ▶       [Week View] │
├─────────────────────────────────────────┤
│ 09:00  ░░░ Available                    │
│ 09:30  ██ Patient A — Booked            │
│ 10:00  ██ Patient B — Booked            │
│ 10:30  ░░░ Available                    │
│ 11:00  ▓▓▓ BLOCKED: Personal Work       │
│ 11:30  ░░░ Available                    │
│ 12:00  ▒▒▒ LEAVE                        │
│ 12:30  ▒▒▒ LEAVE                        │
│ ─── Break ───                           │
│ 16:00  ░░░ Available                    │
│ 16:30  ██ Patient C — Booked            │
│ 17:00  ░░░ Available                    │
│ ...                                     │
└─────────────────────────────────────────┘
```

### 6.4 Schedule Management UI

```text
┌────────────────────────────────────────┐
│ Working Hours                          │
│                                        │
│ Monday    09:00 - 13:00  [Edit] [Del]  │
│           16:00 - 20:00  [Edit] [Del]  │
│ Tuesday   09:00 - 13:00  [Edit] [Del]  │
│ ...                                    │
│                                        │
│ [+ Add Working Hours]                  │
├────────────────────────────────────────┤
│ Leave / Holidays / Blocks              │
│                                        │
│ [Mark Leave]  [Add Holiday]  [Block]   │
│                                        │
│ 15 Oct  Full Day  HOLIDAY: Eid         │
│ 18 Oct  10:00-12:00  LEAVE             │
└────────────────────────────────────────┘
```

### 6.5 Appointment Creation Flow (Doctor-initiated)

```text
[+ New Appointment] button
        ↓
Modal / Slide-out:
  - Patient Name (text input)
  - Patient Contact (optional)
  - Date (date picker)
  - Available Slots (auto-loaded from GET /doctor/available-slots)
  - Reason (text area)
  - Notes (text area, private)
        ↓
[Create Appointment]
        ↓
POST /doctor/appointments
```

### 6.6 Public Slug Page Update

**Edit:** [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx):
- Replace hardcoded `TIME_SLOTS` array with dynamic date picker + call to `getPublicAvailableSlots(slug, date)`.
- Show real available slots from the doctor's schedule.
- Keep the existing stub appointment submission for now (no patient auth required yet).

### Phase 5 & 6 Test Cases

**Frontend Types & API Tests (`lib/api.ts`)**

| # | Test Case | Setup / Action | Expected Result |
|:---|:---|:---|:---|
| 5.1 | TypeScript Compilation | Run `npx tsc --noEmit` | Exit code 0. No type errors in newly added `ScheduleEntry`, `AppointmentEntry`, or `CalendarEvent` types |
| 5.2 | Auth Token Injection | Trigger `getDoctorSchedule()` in client | Browser network tab shows request to `/api/v1/doctor/schedule` with `Authorization: Bearer <token>` header |
| 5.3 | API Parsing | Call `getDoctorAvailableSlots(date)` | Returns strongly typed `AvailableSlot[]` array matching the backend JSON |

**Dashboard UI Tests**

| # | Test Case | Setup / Action | Expected Result |
|:---|:---|:---|:---|
| 6.1 | Tab Navigation | Click "Calendar", then "Schedule", then "Profile" | Views swap instantly without full page reload. Active tab is highlighted |
| 6.2 | Calendar Rendering | Doctor has mixed events on Oct 12 | Calendar tab displays Oct 12 with gaps for AVAILABLE, solid blocks for APPOINTMENT, grey blocks for LEAVE |
| 6.3 | Schedule Form Validation | Try to submit working hours 18:00 to 09:00 | Client-side validation blocks submission: "End time must be after start time" |
| 6.4 | Appointment Creation UI | Open "New Appointment" modal, pick a date | Modal triggers `getDoctorAvailableSlots` and populates the time dropdown with real slots |
| 6.5 | Appointment Status Action | Click "Complete" on a BOOKED appointment | API call fires. Upon success, UI optimistically updates row status to COMPLETED without a page refresh |
| 6.6 | Public Page Slots | Visit `/dr/test-slug`. Pick a date in the widget | Replaces hardcoded time slots with real slots fetched from `/public/tenants/test-slug/available-slots` |

---

## Phase 7: Verification & Hardening

### 7.1 Test Execution

All backend test cases defined in Phases 1–4 are executed via Pytest.
Frontend test cases defined in Phases 5–6 are executed via TypeScript compiler and browser testing.

> [!IMPORTANT]
> **CI runs on SQLite** ([`ci.yml`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/.github/workflows/ci.yml) uses `DATABASE_URL: "sqlite:///./ci_test.db"`). When writing the Pytest implementation for the backend test cases:
> - Test **service-level validation** (checking for existing appointment before insert), not database-level race conditions
> - SQLite serializes writes — so the concurrency `IntegrityError` path should be tested by **explicitly inserting a conflicting row first**, then attempting the duplicate via the service function
> - `Date` and `Time` columns work in SQLite as text — use explicit string comparisons in assertions, not SQL operator comparisons
> - The `UniqueConstraint` fires correctly in both SQLite and PostgreSQL

### 7.2 Frontend Validation

- `npx tsc --noEmit` — zero TypeScript errors
- All new components use `brand-*` Tailwind colors
- `"use client"` only on stateful components

### 7.3 Migration Verification (Local)

```bash
cd backend && alembic upgrade head    # clean migration
cd backend && alembic downgrade -1    # rollback works
cd backend && alembic upgrade head    # re-apply clean
```

---

## Phase 8: Production Deployment Runbook

> [!CAUTION]
> **Migration must run BEFORE the Railway backend deploy.** If the new code starts before migration 006 runs, all schedule/appointment endpoints will return `500 Internal Server Error` with `ProgrammingError: relation "schedules" does not exist`.

### 8.1 Deployment Sequence (Strict Order)

```bash
# ── Step 1: Run migration against Neon production database ──
# Execute from local machine with Neon connection string
DATABASE_URL="postgresql+psycopg://neondb_owner:...@ep-cool-dream-b433f1sa.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require" \
  python3 -m alembic upgrade head

# ── Step 2: Verify migration landed ──
# Via Neon console SQL editor or neonctl:
# SELECT version_num FROM alembic_version;
# Expected: '006_appointment_system_foundation'
#
# Also verify tables exist:
# SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('schedules','appointments');

# ── Step 3: Deploy backend to Railway ──
railway up ./backend --path-as-root --service backend --detach

# ── Step 4: Smoke test backend ──
curl -s https://backend-production-b26c.up.railway.app/api/v1/health
# Expected: {"status":"healthy",...}

# ── Step 5: Deploy frontend to Vercel ──
vercel --prod --archive=tgz --yes

# ── Step 6: Smoke test frontend ──
# Open https://doctors-platform-eight.vercel.app/dashboard
# Verify new tabs load without errors
```

### 8.2 Rollback Plan

If the deployment fails:

```bash
# Rollback migration (BEFORE reverting backend code)
DATABASE_URL="<neon-url>" python3 -m alembic downgrade -1

# Redeploy previous backend version
railway up ./backend --path-as-root --service backend --detach

# Frontend: Vercel auto-rolls back via dashboard instant rollback
```

### 8.3 Environment Variables

**No new environment variables required.** The appointment slot duration (30 minutes) is a service-level constant, not a runtime config. All existing Railway and Vercel variables remain unchanged per [`deployment.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/deployment.md).

---

## Future Patient Extension Points

When the Patient system is built later, the exact changes will be:

| Step | Change |
| :--- | :--- |
| 1 | Create `backend/app/models/patient.py` (UUID PK, TimestampMixin, email, password, profile fields) |
| 2 | Create `backend/app/models/appointment_request.py` (PENDING → CONVERTED/REJECTED lifecycle) |
| 3 | Add `patient_id` FK constraint on `appointments.patient_id` (currently nullable UUID column) |
| 4 | Add `request_id` FK constraint on `appointments.request_id` |
| 5 | Add `role` claim to JWT tokens, update `get_current_doctor` to verify role |
| 6 | Create `get_current_patient` dependency in `deps.py` |
| 7 | Create patient auth routes (`/auth/patient/register`, `/auth/patient/login`) |
| 8 | Create patient routes (`/patient/appointments`, `/patient/calendar`, `/patient/requests`) |
| 9 | Add patient UI pages (`/patient/dashboard`, `/patient/login`, `/patient/register`) |
| 10 | Convert doctor booking flow from direct-create to request-review-book pipeline |

> [!NOTE]
> The `appointments` table already has `patient_id` (nullable UUID) and `request_id` (nullable UUID) columns ready for FK constraints. No destructive schema change needed.

---

## Execution Order Summary

```mermaid
flowchart LR
    P1["Phase 1<br/>DB Models, Migration<br/>& Pool Hardening"] --> P2["Phase 2<br/>Schedule Engine<br/>& Slot Gen"]
    P2 --> P3["Phase 3<br/>Appointment Lifecycle<br/>& Stub Cleanup"]
    P3 --> P4["Phase 4<br/>Calendar<br/>Aggregator"]
    P4 --> P5["Phase 5<br/>Frontend<br/>API Layer"]
    P5 --> P6["Phase 6<br/>Dashboard<br/>UI Expansion"]
    P6 --> P7["Phase 7<br/>Verification<br/>& Hardening"]
    P7 --> P8["Phase 8<br/>Production<br/>Deployment"]
```

**Estimated file changes:**
- **New files:** ~12 (2 models, 2 schemas, 3 services, 2 routes, ~6 UI components, 4 test files)
- **Edited files:** ~6 (`models/__init__.py`, `database.py`, `router.py`, `public.py`, `lib/api.ts`, `app/[slug]/page.tsx`)
- **New migration:** 1 (`006_appointment_system_foundation.py`)
- **No new env vars** — zero Railway/Vercel config changes

---

## Production Readiness Checklist

All items from the [production audit](file:///Users/mdaffanahmed/.gemini/antigravity/brain/a6cb075b-c309-4c0d-9132-2e0223d20eb5/production_readiness_audit.md) are addressed in this plan:

| # | Audit Issue | Severity | Resolved In |
|:---|:---|:---|:---|
| 1 | Neon connection pool limits | 🟡 | Phase 1 → Step 1.5 |
| 2 | Migration-before-deploy ordering | 🔴 | Phase 8 → Step 8.1 |
| 3 | CI tests use SQLite (dialect-agnostic) | 🟡 | Phase 7 → Step 7.1 |
| 4 | Rate limits on mutation endpoints | 🟢 | Phase 2 → 2.2, Phase 3 → 3.2 |
| 5 | Migration filename < 128 chars | 🟢 | Phase 1 → Step 1.4 |
| 6 | Rate limit on public slot endpoint | 🟡 | Phase 2 → 2.2 |
| 7 | Railway deploy runbook with sequence | 🔴 | Phase 8 → Steps 8.1–8.3 |
| 8 | Pagination on list endpoints | 🟡 | Phase 2 → 2.2, Phase 3 → 3.2 |
| 9 | Old stub booking route cleanup | 🟡 | Phase 3 → Step 3.3 |

