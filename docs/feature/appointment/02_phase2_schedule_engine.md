# Phase 2 — Schedule Engine & Slot Generation

[← Back to Index](index.md)

---

## Architecture & Implementation Reasoning

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
