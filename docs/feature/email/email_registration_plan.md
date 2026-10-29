# Complete & Secure Email Registration: Implementation & Testing Plan

---

## 1. Analysis of Recent Commit (`73b5d873b40eea1abcfed32574aff84834bee07f`)

Commit **`73b5d873b40eea1abcfed32574aff84834bee07f`** (`feat(auth): add email format validation, error unwrapping, and cleanup imports`) laid the initial groundwork for email validation across the stack:

1. **Backend Schema & Service Validation (`backend/app/schemas/auth.py`, `backend/app/services/auth_service.py`)**:
   - Added `EMAIL_REGEX` and `validate_email_id()` to strip whitespace, lowercase, and validate RFC-style email format.
   - Attached `@field_validator("email")` on `EmailRegisterRequest` and `EmailLoginRequest`.
   - Added defensive `validate_email_id()` checks inside `AuthService.register_email()` and `AuthService.login_email()`.
2. **Frontend Validation & Error Unwrapping (`components/auth/EmailAuthForm.tsx`, `lib/api.ts`)**:
   - Added `isValidEmail()` in `EmailAuthForm.tsx`, disabled native browser tooltip validation (`noValidate`) in favor of controlled state validation, and normalized email before calling `registerWithEmail` / `loginWithEmail`.
   - Updated `apiFetch` in `lib/api.ts` to unwrap FastAPI/Pydantic `422 Unprocessable Entity` array error details (`detail[0].msg.replace(/^Value error,\s*/i, "")`) into human-readable messages.
3. **Test Suite Updates (`backend/tests/test_auth.py`)**:
   - Added `reset_limiter` autouse fixture to prevent SlowAPI rate-limit state bleed across tests.
   - Added unit and endpoint tests for `validate_email_id`, invalid email rejection (`422`), and case/whitespace normalization.

### Current Gaps Identified Beyond `73b5d87`

While `73b5d87` validates syntax and normalizes email strings, a **complete and secure email registration flow** still lacks:

- **Email Ownership Verification**: Anyone can register any valid-syntax email address (`doctor@hospital.org`) and immediately receive a full-access JWT (`201 Created` -> `access_token`) without proving ownership of the inbox.
- **Weak Password Policy & Bcrypt Truncation Vulnerability**: Currently only checks `len(password) >= 6` with no complexity or maximum length bounds (bcrypt silently truncates or errors at >72 bytes).
- **Registration Form Completeness**: `EmailRegisterRequest` accepts `full_name` and `phone`, and `registerWithEmail()` in `lib/api.ts` accepts `fullName`, but `EmailAuthForm.tsx` only renders `email` and `password` fields without password confirmation, visibility toggle, or strength meter.
- **Concurrency & Race Conditions**: `register_email` and `generate_unique_tenant_slug` use check-then-insert queries without handling `IntegrityError` on concurrent duplicate email or slug collisions, resulting in unhandled `500 Internal Server Error` and leaking raw exception strings (`detail=f"Failed to register doctor account: {str(exc)}"`).
- **Account Enumeration & Cross-Provider Collisions**: Registering an existing email returns `400 An account with this email already exists`, and logging into a Google-created account reveals provider metadata.
- **Timing Side-Channel on Login/Registration**: When an email does not exist, `login_email` returns immediately without running bcrypt, creating a measurable timing difference (~1ms vs ~100ms).

---

## 2. Architecture & Phased Implementation Plan

### Phase 1: Database Schema & Migration (`backend/app/models/`, `backend/alembic/`)

1. **Update `Doctor` Model (`backend/app/models/doctor.py`)**:
   - Add `email_verified: Mapped[bool]` (`default=False`, `nullable=False`). Google OAuth users with `email_verified=True` from Google will have this set to `True` automatically.
   - Add `email_verified_at: Mapped[Optional[datetime]]` (`nullable=True`).
   - Add `failed_login_attempts: Mapped[int]` (`default=0`, `nullable=False`) and `locked_until: Mapped[Optional[datetime]]` (`nullable=True`) for brute-force lockout protection.
2. **Create `EmailVerificationToken` Model (`backend/app/models/verification_token.py`)**:
   - Fields: `id` (UUID PK), `doctor_id` (UUID FK -> `doctors.id`, cascade delete), `token_hash` (SHA-256 hex digest of the raw token/OTP; never store plaintext tokens in the DB), `purpose` (`"email_verification"` | `"password_reset"`), `expires_at` (timezone-aware DateTime), `used_at` (Optional DateTime), `created_at` (TimestampMixin).
   - Indexes on `(doctor_id, purpose)` and `token_hash`.
3. **Alembic Migration (`backend/alembic/versions/010_add_email_verification_and_security.py`)**:
   - Add new columns to `doctors` (backfilling existing active doctors as `email_verified=True` so existing accounts are not broken) and create the `email_verification_tokens` table.

---

### Phase 2: Input Validation & Password Security Hardening (`backend/app/schemas/auth.py`, `backend/app/core/security.py`)

1. **Strict Email Validation (`backend/app/schemas/auth.py`)**:
   - Enforce RFC 5321 length limits: total email length <= 254 chars, local part <= 64 chars.
   - Reject disposable/throwaway domains (configurable blocklist) and control/null characters.
2. **Password Policy Validator (`backend/app/schemas/auth.py`)**:
   - Create `validate_password_strength(password: str)` applied to `EmailRegisterRequest`:
     - Minimum **8 characters**, maximum **72 bytes** (`len(password.encode("utf-8")) <= 72` to prevent bcrypt truncation/DoS).
     - Require at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character (or passphrase length >= 16).
     - Reject passwords containing the user's email local-part or common breached passwords.
3. **Input Sanitization for Profile Fields (`EmailRegisterRequest`)**:
   - Validate `full_name` (strip HTML/control characters, 2-120 chars) and `phone` (E.164 or standard clinic phone pattern, max 25 chars).
4. **Constant-Time Verification & Token Hashing (`backend/app/core/security.py`)**:
   - Pre-compute a `DUMMY_BCRYPT_HASH` on startup and run `verify_password(password, DUMMY_BCRYPT_HASH)` when a user email is not found during login, neutralizing timing-based email enumeration.
   - Add helpers: `generate_verification_token()` (cryptographically secure 6-digit OTP plus a URL-safe token via `secrets.token_urlsafe(32)`), and `hash_token(raw_token)` using `hashlib.sha256` with `secrets.compare_digest` for comparison.
   - Include `jti` (unique token ID) and `type` (`"access"`) claims in `create_access_token`.

---

### Phase 3: Transactional Registration, Concurrency & Verification Service (`backend/app/services/`)

1. **Email Delivery Service (`backend/app/services/email_service.py`)**:
   - Create a pluggable `EmailService` supporting SMTP / Resend / AWS SES in production and console/in-memory outbox capture in `development` / `test` environments.
   - Configure settings in `backend/app/core/config.py`: `EMAIL_BACKEND`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_VERIFICATION_EXPIRE_MINUTES` (default 15), and `REQUIRE_EMAIL_VERIFICATION` (boolean flag).
2. **Atomic Registration & Race-Condition Safety (`backend/app/services/auth_service.py`)**:
   - Wrap `Doctor` + `Tenant` + `EmailVerificationToken` creation in a single transaction.
   - Catch `sqlalchemy.exc.IntegrityError` specifically:
     - If the collision is on `doctors.email`: roll back and handle as a duplicate email (409 Conflict, or a generic verification response).
     - If the collision is on `tenants.slug`: retry slug generation with a savepoint (`db.begin_nested()`) or a deterministic suffix, up to 5 attempts.
   - Sanitize all `500 Internal Server Error` responses: log the full traceback via `structlog` (`logger.error(...)`) and return a safe message (`"Failed to register doctor account. Please try again later."`) instead of leaking `str(exc)`.
3. **Verification & Resend Flows (`backend/app/api/routes/auth.py`, `backend/app/services/auth_service.py`)**:
   - `POST /api/v1/auth/register`: Creates the doctor (`email_verified=False`), tenant, and verification token; dispatches the verification email/OTP.
   - `POST /api/v1/auth/verify-email`: Validates the token/OTP against `EmailVerificationToken`, checks expiration and single use (`used_at is None`), marks `doctor.email_verified = True` and `token.used_at = now()`, and returns `AuthResponse` with a JWT.
   - `POST /api/v1/auth/resend-verification`: Rate-limited (`3/minute` plus a 60s cooldown per doctor), invalidates prior unused tokens, and sends a fresh token.
   - **Cross-Provider Account Linking**: If a doctor registered with Google later registers/sets a password (or vice versa), require email verification before linking rather than exposing raw account state.

---

### Phase 4: Frontend Registration UX (`components/auth/EmailAuthForm.tsx`, `lib/api.ts`)

1. **Complete Registration Form (`components/auth/EmailAuthForm.tsx`)**:
   - In `mode === "register"`, add:
     - **Full Name** input (`Dr. Jane Doe`) so tenant slugs and profiles are accurate from the start rather than always guessing from the email prefix.
     - **Password Visibility Toggle** (eye/eye-off icon) and **Confirm Password** field (or a live **Password Strength Checklist**: 8+ chars, uppercase, number, special char).
2. **Email Verification Step UI**:
   - When registration requires email verification, transition `EmailAuthForm` to a **"Verify your email"** view with a 6-digit OTP / token input, a countdown timer for **"Resend code"**, and automatic redirect to `/onboarding` once verified.
3. **API Client Updates (`lib/api.ts`)**:
   - Update `registerWithEmail` payload typing and add `verifyEmail(email, code)` and `resendVerificationEmail(email)`.
   - Add `429 Too Many Requests` handling in `apiFetch` that reads the `Retry-After` header to display a clear cooldown message.

---

## 3. Comprehensive Testing Plan (Reliability & Robustness)

The test suite will be organized across **4 layers** in `backend/tests/test_auth.py`, a new `backend/tests/test_auth_robustness.py`, and frontend E2E verification scripts.

### Layer 1: Unit Tests (Validators, Crypto & Helpers)

| Test Case | Target | Expected Outcome |
| :--- | :--- | :--- |
| **Email RFC & Boundary Cases** | `validate_email_id()` | Accepts standard, subdomain, and `+` tag emails; normalizes case/whitespace; rejects emails > 254 chars, local parts > 64 chars, consecutive dots (`..`), leading/trailing dots, unicode homograph/control chars, SQL/XSS payloads (`"admin'--@example.com"`), and non-string types (`None`, `123`, `[]`). |
| **Password Policy Boundaries** | `validate_password_strength()` | Rejects < 8 chars, missing character classes, > 72-byte UTF-8 strings (including multi-byte emoji passwords that exceed 72 bytes at < 72 chars), whitespace-only passwords, and passwords matching the email prefix. |
| **Token Hashing & Constant-Time Compare** | `generate_verification_token()`, `hash_token()` | Raw token is high-entropy; the DB only stores the SHA-256 hex digest; verification uses `secrets.compare_digest`. |

### Layer 2: Integration & Security Tests (API Endpoints)

| Test Case | Target | Expected Outcome |
| :--- | :--- | :--- |
| **End-to-End Registration + Verification** | `POST /register` -> `POST /verify-email` -> `GET /me` | Doctor & Tenant created atomically; `email_verified` transitions `False` -> `True`; JWT issued and accepted by `/me`. |
| **Token Expiration & Replay Prevention** | `POST /verify-email` | Expired token returns `400`; reusing a consumed token (`used_at != None`) returns `400`; the older token is invalidated when `POST /resend-verification` is called. |
| **Brute-Force & Rate Limiting** | `POST /register`, `POST /login`, `POST /verify-email` | Exceeding `RATE_LIMIT_AUTH` (`5/minute`) returns `429 Too Many Requests` with `Retry-After` / rate-limit headers; repeated failed verification attempts invalidate the token. |
| **Cross-Provider Collision Handling** | `POST /register` & `POST /google` | Registering an email already linked to Google (or logging in via Google after email registration) handles provider state safely without duplicating `Doctor` or `Tenant` rows. |
| **Error Sanitization (No Internal Leaks)** | `AuthService.register_email` | A simulated DB failure rolls back cleanly (0 orphaned `Doctor` or `Tenant` rows) and returns a generic `500` message without exposing SQL/table names or stack traces in the JSON response. |

### Layer 3: Reliability, Atomicity & Concurrency Tests

| Test Case | Target | Expected Outcome |
| :--- | :--- | :--- |
| **Transaction Rollback on Partial Failure** | `AuthService.register_email` | Monkeypatch `Tenant` creation or token insertion to fail mid-transaction; verify `db.query(Doctor).count() == 0` and `db.query(Tenant).count() == 0` (no orphaned records). |
| **Concurrent Duplicate Email Registration** | `POST /api/v1/auth/register` | Fire simultaneous registration requests with the identical email; exactly 1 succeeds (`201`) and the others return a clean `400/409` (never a `500 IntegrityError`). |
| **Concurrent Same-Name Tenant Slug Collision** | `generate_unique_tenant_slug()` | Register 10 doctors named `"Dr. Same Name"` with distinct emails; each receives a unique deterministic slug (`dr-same-name`, `dr-same-name-2`, ..., `dr-same-name-10`) with zero collisions. |
| **Email Service Failure Resilience** | `EmailService.send_verification_email` | Simulate an SMTP timeout/connection error; verify either a graceful retry via `tenacity` or a clean error response, while allowing the user to trigger `/resend-verification`. |

### Layer 4: Frontend UI & E2E Flow Verification

- **Form Validation & UX States (`components/auth/EmailAuthForm.tsx`)**:
  - Verify client-side blocking of invalid emails, weak passwords, and mismatched confirmation passwords before any network request is dispatched.
  - Verify `apiFetch` unwrapping of `422` (Pydantic validation), `400/409` (duplicate account), `401` (bad credentials), and `429` (rate limit exceeded) into accessible error banners.
  - Verify double-submit prevention (`disabled={loading}` while a request is in flight).
  - Verify post-registration redirect to `/onboarding` for new doctors (`onboarding_completed: false`) and to `/dashboard` for onboarded doctors.
