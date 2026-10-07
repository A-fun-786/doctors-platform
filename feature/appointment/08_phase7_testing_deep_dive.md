# Phase 7 Testing — Methodology, Decisions & Justifications

[← Back to Index](index.md)

---

## Methodology, Decisions & Justifications

This section is the dedicated testing record for Phase 7. It documents every testing decision made, why each approach was chosen over alternatives, what each test scenario proved, what errors were found, how they were fixed, and what tradeoffs were accepted. It supplements Section 10's verification table with the reasoning layer that explains *why* each result matters.

---

### 11.1 Guiding Philosophy

Phase 7 ("Verify & Harden") had one rule: **no test should rely only on the component under test to validate itself.** Specifically:

- Static type checks (`tsc`) must pass independently of linting (`eslint`) — they catch different classes of bug.
- Unit tests (Pytest) must pass from multiple working directories — catches CI vs local path fragility.
- Live HTTP tests must exercise the real Uvicorn/ASGI/middleware stack — `TestClient` stubs bypass rate limiting, CORS, and JWT processing.
- Migration reversibility must be tested independently of `pytest` — Alembic is infrastructure, not application code.

The test suite was designed to fail loudly on the *first* deviation from expected contract, not to just "get to green".

---

### 11.2 Step 7.1 — Static Analysis & Lint Hardening

#### What Was Done
Ran `ruff check backend/` and resolved all 11 reported violations across 6 files.

#### Why Ruff, Not Flake8 or Pylint
The project's `pyproject.toml` already specified Ruff as the linter. Using any other tool would create a discrepancy between local dev and CI. Ruff is also ~100× faster than Pylint and enforces a superset of Flake8 rules, so one tool covers both correctness and style.

#### The 11 Violations — What They Were and Why They Were Fixed (Not Suppressed)

| File | Violation | Fix Applied | Why Not `# noqa`? |
|---|---|---|---|
| `calendar.py` | `F401` unused `uuid` import | Removed | Was genuinely unused; suppressing hides dead imports |
| `schedule_service.py` | `F401` unused `Any` import | Removed | Same — `Any` was removed when type annotation was cleaned up |
| `test_appointment_phase1.py` | `F401` unused `timedelta` | Removed | Test no longer uses it after slot logic moved to service |
| `test_appointment_phase1.py` | `F401` unused `ScheduleResponse` | Removed | Response model changed; import was stale |
| `test_appointment_phase1.py` | `F401` unused `AppointmentResponse` | Removed | Same — stale from earlier phase |
| `test_appointment_phase1.py` | `F401` missing `Path` import | Added `from pathlib import Path` | Required by Alembic path fix (Step 7.2) |
| `test_calendar.py` | `F401` unused `uuid` | Removed | Calendar tests generate IDs server-side; client doesn't need `uuid` |
| `test_calendar.py` | `F541` f-string no placeholders | Removed `f` prefix | Bug: `f"..."` without `{...}` is a no-op string, not a format |
| `test_schedule.py` | `F401` unused `time` | Removed | Time values passed as strings; `time` object not needed |
| `test_schedule.py` | `F401` unused `Schedule` | Removed | ORM model was imported but tests use response schemas only |
| `test_schedule.py` | `F401` unused `Tenant` | Removed | Same as above |
| `test_slot_generation.py` | `F401` unused `uuid` | Removed | Slot tests use string IDs directly |

**Tradeoff acknowledged:** Removing imports can break code if the import was silently relied upon via a side effect. Each removal was verified by re-running the affected test file individually before and after. All 119 tests passed post-fix, confirming no silent dependency existed.

#### Justification
Leaving lint violations in place would cause CI to fail on the `ruff check` step in the GitHub Actions workflow. Suppression via `# noqa` is appropriate only when the violation is intentional (e.g., a wildcard import for re-export). None of these 11 were intentional — they were all genuine dead code.

---

### 11.3 Step 7.2 — Alembic Test Harness Path Portability

#### The Problem
`test_appointment_phase1.py` initialized the Alembic config as:
```python
alembic_cfg = Config("alembic.ini")
```
This is a **relative path**, so it resolves against the process's current working directory (CWD). When running:
- `cd backend && pytest tests/` → CWD is `backend/`, path resolves correctly ✅
- `backend/.venv/bin/pytest backend/tests/` from project root → CWD is project root, path resolves to `./alembic.ini` which does not exist ❌

The error was a `FileNotFoundError` that looked superficially like a missing file, not a path bug.

#### The Fix
```python
from pathlib import Path

ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
alembic_cfg = Config(str(ini_path))
alembic_cfg.set_main_option("script_location", str(ini_path.parent / "alembic"))
```

`Path(__file__).resolve()` gives the absolute path of the test file itself. `.parent.parent` walks up to `backend/`, where `alembic.ini` lives. This is CWD-independent.

#### Why `set_main_option("script_location", ...)` Was Also Needed
After fixing `ini_path`, a second error appeared: Alembic found the `.ini` file but couldn't locate the `alembic/` migrations folder because `script_location = alembic` inside the `.ini` file is a **relative path** — relative to the directory where the `.ini` file lives. When Alembic is initialized from Python (not from the `alembic` CLI), it does not automatically resolve this relative path against the `.ini` file's directory. It resolves it against the process CWD instead. Setting `script_location` explicitly to the absolute path of the `backend/alembic/` folder closes this gap.

#### Why Not `os.chdir(ini_path.parent)`?
Changing CWD is a global side effect. If any other test or fixture runs in the same process and assumes a particular CWD, `os.chdir()` would silently corrupt it. `Path(__file__).resolve()` is local to the setup function and has zero global side effects.

#### Why Not a `conftest.py` Fixture?
A `conftest.py` fixture that changes CWD would still have the global side effect problem. It would also make the test setup harder to understand for a new developer — the test file would silently depend on a fixture to be runnable, which is surprising. The inline path resolution is self-contained and explicit.

#### Tradeoff
The setup block is slightly more verbose (3 lines instead of 1). This is a deliberate tradeoff: verbosity in setup beats mysterious failures in CI. The 3-line block is also self-documenting.

#### Verification
After the fix, `backend/.venv/bin/pytest backend/tests/test_appointment_phase1.py -v` was run from the project root (`/Users/mdaffanahmed/VS Code/Full stack/Doctors Platform`). All migration tests passed. Then the same suite was run from inside `backend/`. Same result. The fix is confirmed portable.

---

### 11.4 Step 7.2 — Full Backend Pytest Suite (119 Tests)

#### What Was Run
```bash
backend/.venv/bin/pytest backend/tests/ -v --tb=short
```

#### Why Run From Both Directories
Two invocation patterns represent two real-world execution contexts:
1. **From project root** — matches how VS Code's test runner, `pytest` extensions, and most CI systems invoke it.
2. **From `backend/`** — matches the developer pattern of `cd backend && pytest`.

Both must produce identical results. Running from only one direction gives false confidence.

#### Results
```
119 passed in 4.2s
```

No tests were skipped or xfailed. All test files contributed passing results.

#### What Each Test File Covered
| File | Scenarios Covered |
|---|---|
| `test_appointment_phase1.py` | Alembic migration upgrade/downgrade, schema correctness via SQLAlchemy reflection |
| `test_calendar.py` | Calendar aggregator sorting, date range validation, event type mixing |
| `test_schedule.py` | Schedule CRUD, overlap detection, leave management, active/inactive toggling |
| `test_slot_generation.py` | Slot slicing algorithm: normal, leave-excluded, sub-30-min-remainder discard, boundary conditions |
| `test_appointments.py` | Booking flow, double-booking prevention (409), reschedule, cancel, complete state machine |
| `test_public.py` | Public endpoint schema validation, PII exclusion, nonexistent-slug 404 |

#### Why 119 and Not More/Fewer
The suite was written to cover the contract of each endpoint and the service layer below it. It does not aim for 100% line coverage (which incentivizes trivial tests). It aims for **behavior coverage**: every meaningful branch in the business logic has at least one test that exercises it and one that exercises the negative path.

---

### 11.5 Step 7.3 — Migration Reversibility

#### What Was Run
```bash
# From backend/
alembic upgrade head
alembic downgrade -2
alembic upgrade head
```

#### Why Test Migration Reversibility
Irreversible migrations are a production hotfix liability. If a deployment fails after `upgrade head`, the rollback procedure is `downgrade -1`. If that migration's `downgrade()` function is wrong or missing, the rollback fails and the system is stuck in a half-migrated state. Testing downgrade in CI prevents this class of incident.

#### Why `downgrade -2` and Not `-1`
Two new migrations were added in Phase 6-7:
- `006_add_appointment_table.py`
- `007_add_calendar_events.py`

Testing `-1` only validates `007`. Testing `-2` validates both in sequence and also validates that `006`'s downgrade doesn't break the schema that `007`'s downgrade left behind. The full round-trip (`upgrade → downgrade -2 → upgrade`) is the most complete correctness proof.

#### Why SQLite Instead of PostgreSQL
The local development environment does not have a PostgreSQL instance. The Neon cloud PostgreSQL is a production database; running destructive migration tests against it would risk production data. SQLite was chosen because:
1. It is the test database used by the Pytest suite (no new tooling required).
2. Alembic migrations use only ANSI SQL features (no PostgreSQL-specific DDL), so SQLite compatibility is a valid proxy.
3. The CI environment also uses SQLite for the same reasons.

**Tradeoff acknowledged:** SQLite does not enforce foreign key constraints by default, and its DDL support is more limited than PostgreSQL (e.g., `DROP COLUMN` is not supported in older SQLite versions). This means a migration using PostgreSQL-specific DDL could pass here and fail in production. This risk is mitigated by the fact that all migrations use Alembic's standard `op.create_table()` / `op.drop_table()` with no `op.execute()` raw SQL or PostgreSQL-specific types.

#### Results
```
INFO  [alembic.runtime.migration] Running upgrade ... -> 006, add appointment table
INFO  [alembic.runtime.migration] Running upgrade 006 -> 007, add calendar events
INFO  [alembic.runtime.migration] Running downgrade 007 -> 006, ...
INFO  [alembic.runtime.migration] Running downgrade 006 -> 005, ...
INFO  [alembic.runtime.migration] Running upgrade ... -> 006, add appointment table
INFO  [alembic.runtime.migration] Running upgrade 006 -> 007, add calendar events
Exit code: 0
```

Both migrations are confirmed reversible.

---

### 11.6 Steps 7.4–7.6 — Frontend Static Verification

#### 11.6.1 TypeScript Compilation (`tsc --noEmit`)
**Command:** `npx tsc --noEmit`
**Result:** 0 errors

**Why run separately from lint?** TypeScript type errors (`tsc`) and ESLint style errors (`eslint`) are orthogonal. A file can be type-safe and still violate style rules, or vice versa. Running `tsc` separately ensures type safety is verified independently, without the possibility of ESLint passing masking a type error.

**Why `--noEmit`?** We're not building here — we're validating. `--noEmit` runs the type checker without writing any `.js` output files, which is faster and does not pollute the working tree.

#### 11.6.2 ESLint (`npm run lint`)
**Command:** `npm run lint`
**Result:** 0 warnings, 0 errors

All new React components (appointment booking, reschedule, cancel modals; calendar view) passed ESLint rules including `react-hooks/exhaustive-deps` and `no-unused-vars`.

#### 11.6.3 Production Build (`npm run build`)
**Command:** `npm run build`
**Result:** 8/8 routes compiled, 0 errors

The build serves as the final integration test for the frontend. If any import is wrong, any dynamic route segment is malformed, or any Server Component boundary is violated, Next.js build fails. The fact that all 8 routes compiled proves the entire component tree is import-consistent and Next.js compatible.

The 8 routes verified:
```
/                           (landing)
/login                      (auth)
/register                   (auth)
/dashboard                  (protected)
/dashboard/schedule         (appointment feature)
/dashboard/appointments     (appointment feature)
/dashboard/calendar         (appointment feature)
/book/[slug]                (public booking)
```

---

### 11.7 Step 7.7 — Live HTTP Test Suite: Design Decisions

#### 11.7.1 Why a Live HTTP Suite at All

The Pytest suite uses `TestClient` from `httpx`, which bypasses several layers:
- Uvicorn's ASGI event loop
- SlowAPI rate-limiting middleware (which hooks into the ASGI lifecycle)
- JWT verification middleware (which reads HTTP headers, not injected dependencies)
- Pydantic's JSON serialization of HTTP responses (TestClient returns deserialized Python objects)

A bug in any of these layers would pass the Pytest suite but fail in a real browser or API client. The live suite sends real HTTP requests to a real running server, exercising the full stack end-to-end.

#### 11.7.2 Why Node.js (`verify_phase7_live.mjs`) Instead of `curl` or Python

| Tool | Pros | Cons |
|---|---|---|
| `curl` | Simple, universally available | Hard to chain requests (auth token extraction requires `jq`); poor error messages; no structured test reporting |
| Python `requests` | Familiar, same language as backend | Would require a separate venv; adds dependency |
| Node.js fetch (native) | Native to the frontend ecosystem; same JSON handling as the browser; top-level `await` in `.mjs` files | Requires Node.js 18+ |

Node.js was chosen because the project already has a Node.js frontend with `node_modules/`. No new tooling was installed. The `.mjs` extension enables ES module `import` and top-level `await` syntax, making the test script readable as a sequential narrative.

#### 11.7.3 Why an Isolated Test Database (`live_test.db`)

If the live suite ran against the development database (`dev.db`), two problems arise:
1. **Pollution:** Seeded test users and appointments would appear in the development UI.
2. **Flakiness:** If `dev.db` already has a user with the test email, the registration step fails with 409. Re-runs would be non-deterministic.

The server is started with `DATABASE_URL=sqlite:///./live_test.db`, scoping all test data to a throwaway database. The database is deleted at the end of the suite, leaving no trace.

#### 11.7.4 Why Randomized Email Suffixes Per Run

Even with an isolated database, if the suite is run multiple times without deleting the database (e.g., during debugging), the `POST /auth/register` step would fail on the second run because the email is already registered. Using `Date.now()` as a suffix (`testdoctor_${Date.now()}@example.com`) makes each run globally unique, eliminating this failure mode.

#### 11.7.5 Why Auto-Provision and Auto-Destroy

The suite is designed to run in CI without any manual database seeding. It creates its own doctor, schedule, leave, and appointments; runs all tests; and tears down. This makes the suite:
- **Hermetic:** no external state dependency
- **Idempotent:** running it twice leaves no side effects
- **CI-ready:** no `before_all` seed script needed in the pipeline

---

### 11.8 Step 7.7 — Live HTTP Edge Cases: What Each Scenario Proved

This subsection explains the *reasoning* behind each test scenario and what it would catch if it failed.

#### LIVE-1.x — Auth & Profile
| Scenario | What It Proved | What Failure Would Mean |
|---|---|---|
| LIVE-1.0 Register | Server accepts valid registration, returns 201 | Auth route broken or validation too strict |
| LIVE-1.1 Login | JWT issued on valid credentials | Login handler broken |
| LIVE-1.2 Profile Update | `PUT /doctor/profile` accepts service flags | Profile endpoint broken; subsequent stub tests would 422 |

**Tradeoff noted:** LIVE-1.2 originally used `PATCH` (HTTP method for partial update). The actual endpoint is `PUT`. This was caught because the test explicitly checked for HTTP 200 and received 405. **Decision:** Fixed to `PUT`. This also validates that the route registration in `app/api/routes/doctor.py` maps to the correct HTTP verb — a category of error that Pytest TestClient does not catch (TestClient calls the handler directly without routing).

#### LIVE-2.x — Schedule Management
| Scenario | What It Proved |
|---|---|
| LIVE-2.1 Inverted Times Rejected | `model_validator` in `ScheduleCreateRequest` runs server-side; frontend validation alone is not sufficient |
| LIVE-2.2 Schedule Created | Normal schedule creation works end-to-end |
| LIVE-2.3 Duplicate Day Rejected | Service-layer overlap check fires correctly |
| LIVE-2.4 Leave Added | Leave creation persists and returns correct date |

**Why LIVE-2.1 matters:** If the `model_validator` only ran client-side (as a React hook), a malicious client could bypass it and create a schedule with `end_time < start_time`. This scenario sends a raw HTTP request with inverted times and confirms the server returns 422 — proving the validation is not purely frontend.

#### LIVE-3.x — Slot Generation
| Scenario | What It Proved |
|---|---|
| LIVE-3.1 Slot Generation with Leave | Slot slicer correctly excludes leave windows and discards sub-30-min remainders |

**Detail:** The test schedule runs 09:00–18:00 with a leave block from 13:00 to 14:00. The expected slots are 09:00–13:00 (8 slots) and 14:00–18:00 (8 slots) = 16 total. The result confirmed 16 slots. This validates that:
1. Leave windows are correctly subtracted from working hours.
2. The slot count is deterministic given a known schedule.

If the service returned 17 or 15 slots, it would indicate either a boundary condition bug (off-by-one on slot edges) or a leave exclusion failure.

#### LIVE-4.x — Appointment Booking
| Scenario | What It Proved |
|---|---|
| LIVE-4.1 Booking Created | Patient data + slot time correctly persists to appointment table |
| LIVE-4.2 Double-Booking Rejected (409) | Unique constraint or service-layer check prevents two appointments at same slot |
| LIVE-4.3 Slot Occupancy | `available-slots` endpoint correctly removes booked slot from results |

**Why LIVE-4.2 is critical:** The booking API must be idempotent under concurrent requests. Testing 409 proves the server enforces the invariant. The unit test for this (in `test_appointments.py`) inserts a conflicting row directly; LIVE-4.2 sends an actual HTTP request to the same slot, exercising the full conflict detection path including any HTTP-layer retries that might bypass the service check.

#### LIVE-5.x — Reschedule
| Scenario | What It Proved |
|---|---|
| LIVE-5.1 Reschedule Accepted | `PATCH /appointments/{id}` moves appointment to new slot |
| LIVE-5.2 Slot Reversal Correct | Original slot freed; new slot now occupied |

**Why LIVE-5.2 is its own scenario:** LIVE-5.1 only proves the HTTP response is correct. LIVE-5.2 proves the *side effect* — that the slot availability state was mutated correctly. A bug where the old slot was not freed (ghost slot) would cause the available-slots count to be permanently depleted. This scenario would catch that.

#### LIVE-6.x — Cancellation
| Scenario | What It Proved |
|---|---|
| LIVE-6.1 Cancellation Accepted | `POST /appointments/{id}/cancel` transitions to CANCELLED |
| LIVE-6.2 Cancelled Slot Restored | Slot returns to available pool after cancellation |

**Reasoning identical to LIVE-5.2:** The slot restoration side effect must be verified independently of the cancellation response.

#### LIVE-7.x — Completion
| Scenario | What It Proved |
|---|---|
| LIVE-7.1 Completion Accepted | `POST /appointments/{id}/complete` transitions to COMPLETED |

Simple terminal state verification. No slot-state side effect expected (COMPLETED appointments don't free slots, they are historical records).

#### LIVE-8.x — Calendar Aggregator
| Scenario | What It Proved |
|---|---|
| LIVE-8.1 Calendar Sorted | Aggregated events (schedules + leaves + appointments) are sorted chronologically |
| LIVE-8.2 >31-Day Range Rejected | Range guard fires; server returns 400, not 500 |

**Why LIVE-8.1 checks count (16 events) not just HTTP 200:** An HTTP 200 with an empty list would be a false positive. Checking that 16 events are returned proves the aggregator actually queried and merged all three event types.

**Why LIVE-8.2 tests the guard:** Without this guard, a large date range request would generate O(n) slot computations and potentially timeout or OOM the server. The guard is a safety valve. Testing it confirms it works before a real user triggers it.

#### LIVE-9.x — Public Endpoint
| Scenario | What It Proved |
|---|---|
| LIVE-9.1 Public Slots Return No PII | Response fields are only `start` and `end`; no `patient_name`, `doctor_id`, `notes` |
| LIVE-9.2 Nonexistent Slug 404 | Slug lookup fails gracefully; no 500 internal error |

**Why PII-checking matters:** The public endpoint is unauthenticated. If it returned appointment details (patient names, contact info, notes), it would be a privacy violation. The test inspects each slot object's keys and asserts no PII fields exist. This cannot be caught by unit tests that mock the response schema — only a live call with schema inspection proves it.

**Schema note discovered during testing:** The live response used `start` and `end` (not `start_time` and `end_time`). The initial live script used `s.start_time`, which caused a `TypeError` (undefined property). **Decision:** Updated to `s.start` and `s.end`. This also updated the `AvailableSlotResponse` schema documentation to match the actual Pydantic model field names.

#### LIVE-10.x — Multi-Doctor Isolation
| Scenario | What It Proved |
|---|---|
| LIVE-10.1 Cross-Doctor Access Returns 404 | A second doctor cannot read, reschedule, or cancel the first doctor's appointments |

**Why 404 and not 403?** 403 (Forbidden) would reveal that the resource *exists* but access is denied. 404 (Not Found) reveals nothing — the resource simply doesn't appear to exist for this requester. This is the correct behavior: a doctor should not be able to enumerate other doctors' appointments even to confirm they exist. The 404 pattern prevents enumeration attacks.

#### LIVE-11.x — Dead Stub Cleanup
| Scenario | What It Proved |
|---|---|
| LIVE-11.1 Dead Booking Stub Returns 404 | Phase 3's public booking stub was removed; medicine/report stubs still functional |

**Context:** Phase 3 added a stub endpoint `POST /public/tenants/{slug}/appointments` for development scaffolding. Phase 5 implemented the real booking logic, and the stub was intentionally removed. This test confirms the stub is gone (404) and that its removal did not accidentally break the adjacent medicine and report stubs (which returned 201).

**Error encountered:** The medicine and report stub calls initially returned 422 because the request body was minimal (just `{}`). The stubs require `patient_name`, `patient_phone`, and `medicine_items` / `report_types`. After inspecting the Pydantic model, the payloads were updated with valid required fields. **Decision:** The stubs are not dead code — they are functional scaffolding for Phase 8's medicine inventory and lab report features. The full valid payload also serves as documentation of the expected schema.

---

### 11.9 Errors Found, Root Causes, and Fixes Summary

| # | Error | Root Cause | Fix Applied | Lesson |
|---|---|---|---|---|
| 1 | 11 Ruff lint violations | Dead imports from refactoring across phases | Removed each import; verified suite still passes | Lint should be run at end of every phase, not just Phase 7 |
| 2 | `FileNotFoundError: alembic.ini` when running pytest from project root | Relative path in `Config("alembic.ini")` resolves against CWD | Absolute path via `Path(__file__).resolve().parent.parent / "alembic.ini"` | Never use relative paths in test setup code |
| 3 | `script_location` error after (2) was fixed | `script_location = alembic` in `.ini` is relative; Alembic doesn't auto-resolve it against the `.ini` directory | `alembic_cfg.set_main_option("script_location", ...)` with absolute path | Always set both `ini_path` and `script_location` when loading Alembic from Python |
| 4 | `TypeError: s.start_time.startsWith is not a function` in live test | Response schema uses `start`/`end`, not `start_time`/`end_time` | Updated live script to use `s.start` and `s.end` | Always verify schema field names against actual Pydantic model, not assumed conventions |
| 5 | LIVE-1.2 returning HTTP 405 | Live script used `PATCH /doctor/profile`; actual route is `PUT` | Changed to `PUT` | Test the HTTP method as part of contract testing |
| 6 | LIVE-11.1 returning HTTP 422 for medicine/report stubs | Minimal `{}` payload missing required fields | Added valid `patient_name`, `patient_phone`, etc. | Stub endpoints have schema validation just like real endpoints |
| 7 | Port 8000 conflict at start of Step 7.7 | A previously started dev server was still running | Added `./scripts/stop-servers.sh` call at top of test runner | Live test suites must ensure the port is free before starting the test server |

---

### 11.10 Tradeoffs Summary

| Decision | Chosen Approach | Alternative Considered | Why Chosen Approach Won |
|---|---|---|---|
| Lint violations | Fix all 11 | Suppress with `# noqa` | No violation was intentional; suppression hides real dead code |
| Alembic path | `Path(__file__).resolve()` | `os.chdir()` / `conftest.py` fixture | No global side effects; self-contained in the test function |
| Test database | Isolated `live_test.db` | Use `dev.db` | Prevents pollution, ensures idempotency across re-runs |
| Live test tooling | Node.js `.mjs` | Python `requests` / `curl` | Reuses existing Node.js toolchain; top-level await makes script readable |
| PII validation | Inspect actual response keys | Trust Pydantic `exclude` config | Only a live call proves runtime serialization behavior |
| Migration test depth | `downgrade -2` (both migrations) | `downgrade -1` (only latest) | Validates full rollback of both Phase 6 migrations |
| Cross-doctor error code | Expect 404 | Expect 403 | 404 prevents resource enumeration; 403 reveals resource existence |
| Slot schema field names | `start`/`end` | `start_time`/`end_time` | Actual Pydantic model field names — confirmed by live test failure and fix |

---

### 11.11 Coverage Assessment: What Was NOT Tested

Being explicit about coverage gaps is as important as listing what was tested.

| Area | Not Tested | Reason / Mitigation |
|---|---|---|
| Concurrent booking race | True concurrent HTTP requests at same millisecond | SQLite's WAL mode serializes writes; true concurrency needs PostgreSQL + `asyncpg`. The 409 test covers the application-layer check. |
| Rate limiting enforcement | SlowAPI limit being actually hit (e.g., 60 requests/minute) | Would require a loop of 60+ requests; acceptable for Phase 8 load testing |
| CORS preflight | `OPTIONS` requests from browser | CORS is configured in `main.py`; a browser integration test would be needed |
| JWT expiry | Requests with expired tokens | Would require a short-lived token or manual clock manipulation |
| Password hashing correctness | Bcrypt rounds, timing attacks | Out of scope for integration testing; covered by `passlib` library's own test suite |
| Mobile UI responsiveness | Layout on <768px width | Requires Playwright/Selenium with viewport simulation |
| PostgreSQL-specific SQL | DDL in migrations compatible with Postgres | SQLite proxy used; risk mitigated by using only Alembic standard ops |

These gaps are documented for Phase 8 planning, not as defects.

---
