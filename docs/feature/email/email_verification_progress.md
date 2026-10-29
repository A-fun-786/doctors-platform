# Email Registration & Verification Progress

## 1. Summary
Implemented Phase 1 (Database Schema & Migration) of the Email Registration and Verification architecture. Extended the `Doctor` model with verification status (`email_verified`, `email_verified_at`) and lockout defense fields (`failed_login_attempts`, `locked_until`). Created the `EmailVerificationToken` entity and generated Alembic migration `010_add_email_verification_and_security` with backwards-compatible data backfilling and reversible downgrade logic.

## 2. Plan Reference
- **Plan Document**: `docs/feature/email/email_registration_plan.md`
- **Base Commit SHA**: `73b5d873b40eea1abcfed32574aff84834bee07f`

## 3. Changes
- `backend/app/models/doctor.py`: Added `email_verified`, `email_verified_at`, `failed_login_attempts`, `locked_until`, and `email_verification_tokens` relationship.
- `backend/app/models/verification_token.py`: Created `EmailVerificationToken` model with SHA-256 token hash storage, expiration, and multi-purpose support (`email_verification`, `password_reset`).
- `backend/app/models/__init__.py`: Exported `EmailVerificationToken` to standard package exports.
- `backend/alembic/env.py`: Ensured all domain models (`app.models`) are imported so Alembic captures all metadata.
- `backend/alembic/versions/010_add_email_verification_and_security.py`: Alembic migration adding doctor columns, backfilling existing active accounts to verified, and creating the tokens table with indexes.
- `backend/tests/test_email_verification_models.py`: Unit and integration test suite validating schema definitions, relationship cascades, and Alembic upgrade/downgrade migration cycles.

## 4. Decisions
- **Decision**: Used `String(255)` for `token_hash` instead of fixing to 64 chars.
  - *Reasoning*: Allows future adaptability (e.g., argon2id / salt prefixes) while safely containing SHA-256 hex digests (64 hex characters).
  - *Alternatives considered*: `CHAR(64)` / `String(64)`. Rejected to maintain forward-compatibility if hashing format changes.
  - *Consequences*: Negligible storage overhead; high flexibility.
- **Decision**: Added batch mode support via `op.batch_alter_table` in Alembic migration.
  - *Reasoning*: The platform supports PostgreSQL in production and SQLite in local/test environments; SQLite requires batch mode for table alteration.
  - *Alternatives considered*: Raw `ALTER TABLE` statements. Rejected because it fails on SQLite.
  - *Consequences*: Migration runs seamlessly across both PostgreSQL and SQLite.
- **Decision**: Backfill existing active doctors to `email_verified=True` and `email_verified_at=CURRENT_TIMESTAMP`.
  - *Reasoning*: Prevents locking out existing registered doctors when email verification is enforced in later phases.
  - *Alternatives considered*: Leave existing doctors unverified. Rejected as it would break production access for existing users.
  - *Consequences*: Existing active doctors remain unblocked.

## 5. Deviations from Plan
None. Phase 1 was executed exactly according to specifications in `docs/feature/email/email_registration_plan.md`.

## 6. Assumptions
- Existing active doctors (`is_active == True`) are considered pre-verified since they previously authenticated via Google OAuth or initial setup.
- Lockout protection will be managed in application auth logic using `failed_login_attempts` and `locked_until` in Phases 2 and 3.

## 7. Verification Results

### Baseline Comparison
- **Pre-implementation baseline suite**: 153 tests passed, 0 failures (`pytest`, exit code 0).
- **Post-implementation full suite**: 156 tests passed, 0 failures (`pytest`, exit code 0).
- **Regressions**: None.

### Verification Scenarios
| Scenario | Type | Command / Actions | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Doctor Schema & Lockout Fields** | `AGENT_EXECUTABLE` | `pytest tests/test_email_verification_models.py::test_doctor_email_verification_and_lockout_fields` | Defaults: `email_verified=False`, `failed_login_attempts=0`, `locked_until=None`; updates persist cleanly | Fields initialize with defaults and persist timestamps and counts on update | Exit code 0, `PASSED` | `PASS` |
| **Verification Token Lifecycle & Cascade** | `AGENT_EXECUTABLE` | `pytest tests/test_email_verification_models.py::test_email_verification_token_lifecycle_and_cascade` | Token created with foreign key to doctor; deleting doctor cascades and removes token | Token created, bidirectional relationships navigable, token deleted upon doctor deletion | Exit code 0, `PASSED` | `PASS` |
| **Alembic 010 Migration & Backfill** | `AGENT_EXECUTABLE` | `pytest tests/test_email_verification_models.py::test_alembic_migration_010_upgrade_and_downgrade` | Upgrade 009 -> 010 adds columns, backfills active doctors to verified, downgrade 010 -> 009 drops table and columns | Backfill correctly set active doc `email_verified=1`, tokens table created, downgrade cleanly restored revision 009 schema | Exit code 0, `PASSED` | `PASS` |
| **Alembic Local DB Upgrade** | `AGENT_EXECUTABLE` | `cd backend && alembic upgrade head && alembic current` | Applies migration 010 cleanly to local database | Output: `Running upgrade 009_add_working_hours_to_doctor -> 010_add_email_verification_and_security`, `010_add_email_verification_and_security (head)` | Exit code 0, head confirmed | `PASS` |
| **Full Regression Test Suite** | `AGENT_EXECUTABLE` | `cd backend && pytest` | All 156 tests pass without error or regression | 156 passed, 1 warning (pre-existing starlette testclient warning) in 34.17s | Exit code 0, 156 passed | `PASS` |
| **Live Server Startup & Health** | `AGENT_EXECUTABLE` | `./scripts/start-servers.sh --background && curl http://localhost:8000/health` | Fastapi backend and Next.js frontend boot cleanly; `/health` returns 200 `{"status":"healthy"}` | HTTP 200 OK, requestId & security headers present | Exit code 0, healthy status | `PASS` |
| **Live API Registration & DB Schema Check** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/register` + SQLite inspection | Doctor registered (201 Created); DB record has `email_verified=0`, `failed_login_attempts=0`, `locked_until=None` | Doctor record `('manual_test_doc@example.com', 0, None, 0, None)` confirmed in DB | Exit code 0, 201 Created & DB verified | `PASS` |
| **Tokens Table & Index Verification** | `AGENT_EXECUTABLE` | Python sqlite3 PRAGMA check on `doctor_platform.db` | Table `email_verification_tokens` and indexes on `token_hash` & `(doctor_id, purpose)` exist | Indexes `ix_email_verification_tokens_token_hash` and `ix_email_verification_tokens_doctor_purpose` present | Exit code 0, indexes verified | `PASS` |
| **Live Frontend Route Verification** | `AGENT_EXECUTABLE` | `curl -I http://localhost:3000/login && curl -I http://localhost:3000/register` | Frontend auth pages respond with HTTP 200 | HTTP/1.1 200 OK on both `/login` and `/register` | Exit code 0, 200 OK | `PASS` |

**Final Phase 1 Verdict**: `VERIFIED`

## 8. Manual Steps Pending
None.

## 9. Known Issues and Follow-ups
- Phase 2: Schema input validation and password strength enforcement (`EmailRegisterRequest`).
- Phase 3: Transactional registration and token dispatch service (`AuthService.register_email`, `EmailService`).

## 10. Rollback
- Revert commit: `git revert <commit-sha>`
- Alembic downgrade: `cd backend && alembic downgrade 009_add_working_hours_to_doctor`
- Data implications: Dropping `email_verification_tokens` table deletes active tokens. Dropping columns on `doctors` removes verification timestamps and lockout counters without deleting doctor profiles.
