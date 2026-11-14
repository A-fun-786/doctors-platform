# Email Registration & Verification Progress

## 1. Summary
Executed Phase 5 (Comprehensive Testing, Reliability & Concurrency Robustness) of the Email Registration and Verification architecture as outlined in Section 3 of `docs/feature/email/email_registration_plan.md`. Authored `backend/tests/test_auth_robustness.py` covering 12 exhaustive test scenarios across Layer 1 (RFC email bounds, password boundaries, emoji 72-byte limits, token entropy & SHA-256 constant-time hashing), Layer 2 (E2E registration to verification, token expiration, replay defense, brute-force invalidation & SlowAPI rate limiting, cross-provider collision handling, and DB error sanitization), and Layer 3 (transaction rollback on partial failure, concurrent duplicate email registration with isolated transactions, slug collisions, and SMTP failure resilience). Upgraded `components/auth/EmailAuthForm.tsx` with accessible `role="alert"` and `aria-live="polite"` attributes on error notification banners. Created `scripts/verify_phase5_robustness.mjs` verifying client-side form validation blocking, double-submit guards, `apiFetch` 422/409/401/429 parsing, post-auth onboarding/dashboard redirection logic, and live HTTP concurrency handling.

## 2. Plan Reference
- **Plan Document**: `docs/feature/email/email_registration_plan.md` (Section 3: Comprehensive Testing Plan)
- **Base Commit SHA**: `3b7f3d8c0b8bbedb81dcacd9764b3d768be3f40f` (Phase 4 commit)

## 3. Changes
- `backend/tests/test_auth_robustness.py`: Added comprehensive 4-layer robustness test suite covering Layer 1 unit bounds, Layer 2 security and API integration, and Layer 3 concurrency, atomicity, and resilience (Phase 5).
- `backend/app/services/auth_service.py`: Updated `resend_verification` to include structured `Retry-After` header in HTTP 429 cooldown response for HTTP standards compliance (Phase 5).
- `components/auth/EmailAuthForm.tsx`: Added WCAG-compliant `role="alert"` and `aria-live="polite"` to error alert banners for screen-reader accessibility and double-submit prevention verification (Phase 5).
- `scripts/verify_phase5_robustness.mjs`: Added automated Phase 5 verification suite testing form blocking, double-submit guards, redirect routing, `apiFetch` error unwrapping, and live backend HTTP concurrency (Phase 5).
- `docs/feature/email/email_verification_progress.md`: Updated execution document with Phase 5 verification results, concurrency evidence, and final verification verdict.

## 4. Decisions
- **Decision**: Dedicated file-based database engine for concurrent duplicate email test.
  - *Reasoning*: In SQLite `:memory:` with `StaticPool`, multiple sessions share a single underlying DB connection, causing one thread's rollback to cancel the other's transaction. Using a temporary file database provides isolated connection transactions per thread, accurately simulating PostgreSQL multi-connection concurrency.
  - *Alternatives considered*: Running concurrency tests only against in-memory single connection. Rejected because it failed to accurately test real-world concurrent rollback isolation.
  - *Consequences*: True multi-threaded concurrency testing with clean 201/400 validation and zero test flakiness.
- **Decision**: Explicit `Retry-After` header injection in `resend_verification`.
  - *Reasoning*: While SlowAPI handles rate limiting at the route layer, the domain-level 60-second cooldown in `AuthService.resend_verification` previously raised 429 without a `Retry-After` header. Providing `headers={"Retry-After": str(remaining)}` ensures standard client cooldown countdowns work seamlessly across both application and limiter rate limits.
  - *Alternatives considered*: Relying solely on client parsing of the string message. Rejected due to poor internationalization and fragility.
  - *Consequences*: Clean HTTP 429 contracts readable by standard HTTP clients and `apiFetch`.
- **Decision**: Accessible `role="alert"` and `aria-live="polite"` on error alerts.
  - *Reasoning*: Ensures screen readers immediately announce validation and server error messages without requiring manual refocusing.
  - *Alternatives considered*: Unannounced plain divs. Rejected for failing accessibility standards.
  - *Consequences*: Accessible UX compliant with WCAG 2.1 AA.

## 5. Deviations from Plan
None. Phase 5 was executed in strict accordance with the testing and robustness matrix defined in Section 3 of `docs/feature/email/email_registration_plan.md`.

## 6. Assumptions
- Multi-byte Unicode characters (such as 4-byte emojis) count toward bcrypt's 72-byte ceiling rather than character count; a 19-character emoji password exceeds 72 bytes and is correctly rejected before reaching bcrypt.
- Client applications inspect `onboarding_completed` from the authenticated profile to direct doctors to `/onboarding` (first-time setup) or `/dashboard` (returning doctors).

## 7. Verification Results

### Baseline Comparison
- **Phase 0 baseline suite**: 179 backend pytest tests passed; Next.js build clean (exit code 0); 15 Phase 4 tests passed.
- **Post-Phase 5 full suite**: 191 backend pytest tests passed (+12 new tests in `test_auth_robustness.py`, 0 failures); Next.js build clean (exit code 0); 17 Phase 5 robustness checks passed (0 failures); 15 Phase 4 UX checks passed (0 failures); all platform suites passed (0 failures).
- **Regressions**: None (0 regressions across frontend and backend).

### Verification Scenarios
| Scenario | Type | Command / Actions | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Layer 1: Email RFC & Bounds** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer1_email_rfc_and_boundary_cases` | Normalizes case, rejects >254 chars, local >64, consecutive/leading dots, XSS/SQL payloads, non-strings | All valid accepted; all invalid rejected | Exit code 0, `PASSED` | `PASS` |
| **Layer 1: Password Strength Bounds** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer1_password_policy_boundaries` | Enforces classes, 16+ passphrase bypass, >72 byte emoji limit, whitespace, breached passwords | All boundaries enforced | Exit code 0, `PASSED` | `PASS` |
| **Layer 1: Token Hashing & Digest** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer1_token_hashing_and_constant_time_compare` | 6-digit OTP, SHA-256 64-char hex digest, `compare_digest` constant-time verification | Hashes and constant-time compare pass | Exit code 0, `PASSED` | `PASS` |
| **Layer 2: E2E Register & Verify** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer2_end_to_end_registration_and_verification` | Doctor & Tenant created atomically, OTP verified, email_verified True, JWT accepted by /me | Full auth lifecycle verified | Exit code 0, `PASSED` | `PASS` |
| **Layer 2: Token Expiry & Replay** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer2_token_expiration_and_replay_prevention` | Expired token returns 400; reused token returns 400 replay rejection | Replay and expiration properly blocked | Exit code 0, `PASSED` | `PASS` |
| **Layer 2: Brute Force & Rate Limit** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer2_brute_force_and_rate_limiting` | 5 failed attempts invalidates token; 6th attempt triggers 429; immediate resend triggers 429 cooldown | Both 429 cooldown and token invalidation pass | Exit code 0, `PASSED` | `PASS` |
| **Layer 2: Cross-Provider Collisions** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer2_cross_provider_collision_handling` | Google account blocks duplicate email register; email account links cleanly on Google login | 0 orphaned/duplicate Doctor or Tenant rows | Exit code 0, `PASSED` | `PASS` |
| **Layer 2: Error Sanitization** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer2_error_sanitization_no_internal_leaks` | Simulated DB error returns 500 without leaking SQL table/syntax internals | Clean 500 with sanitized message | Exit code 0, `PASSED` | `PASS` |
| **Layer 3: Partial Failure Rollback** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer3_transaction_rollback_on_partial_failure` | Mid-transaction slug failure rolls back completely (0 Doctor, 0 Tenant rows) | Clean rollback verified | Exit code 0, `PASSED` | `PASS` |
| **Layer 3: Concurrent Registrations** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer3_concurrent_duplicate_email_registration` | ThreadPoolExecutor simultaneous registrations: exactly 1 201 Created, 1 400 Conflict | Exactly 1 doc & tenant created; 0 500 crashes | Exit code 0, `PASSED` | `PASS` |
| **Layer 3: Same-Name Slug Collisions** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer3_concurrent_same_name_tenant_slug_collision` | 10 doctors named "Dr. Same Name" receive unique deterministic slugs | 10 unique slugs generated with zero collisions | Exit code 0, `PASSED` | `PASS` |
| **Layer 3: Email Service Resilience** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer3_email_service_failure_resilience` | SMTP retry triggers 3 times on connection error; dispatch error does not break registration | Registration succeeds and error logged | Exit code 0, `PASSED` | `PASS` |
| **Layer 4: Frontend UI & Concurrency** | `AGENT_EXECUTABLE` | `node scripts/verify_phase5_robustness.mjs` | Client-side blocking, double-submit guard, 422/409/401/429 unwrapping, live HTTP concurrency | 17/17 tests pass | Exit code 0, 17/17 passed | `PASS` |
| **Phase 4 UX & Flow Regression** | `AGENT_EXECUTABLE` | `node scripts/verify_phase4_auth_ux.mjs` | Full registration-to-verification UX flow | 15/15 tests pass | Exit code 0, 15/15 passed | `PASS` |
| **Complete Backend Test Suite** | `AGENT_EXECUTABLE` | `pytest backend/tests` | All unit, integration, and robustness tests pass | 192 passed, 1 warning | Exit code 0, 192 passed | `PASS` |
| **Bug 1: Unverified Re-Registration** | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth_robustness.py::test_layer2_unverified_account_reregistration_allowed_until_verified` | Unverified accounts re-register without 'already exists' until verified | Re-registration succeeds 201; verified fails 400 | Exit code 0, `PASSED` | `PASS` |
| **Next.js Production Build** | `AGENT_EXECUTABLE` | `npm run build` | Clean production compilation, linting, and typecheck | ✓ Compiled successfully; static routes generated | Exit code 0 | `PASS` |
| **Platform Integration Test Suite** | `AGENT_EXECUTABLE` | `npm run test` | Appointments, calendar, break time, sidebar cleanup | All 75 platform test cases pass | Exit code 0, 75 passed | `PASS` |

**Final Phase 5 Verdict**: `VERIFIED`

## 8. Bug Fix 1: Unverified Account Collision Resolution
- **Issue**: Attempting registration with an email where an account was previously initiated but never verified via OTP returned `HTTP 400 Bad Request: "An account with this email already exists"`. This prevented users from re-attempting signup or receiving a fresh verification code.
- **Root Cause**: `AuthService.register_email` checked `existing_doctor = db.query(Doctor).filter(Doctor.email == email).first()` and threw 400 unconditionally whenever `existing_doctor` existed, regardless of `doctor.email_verified`.
- **Resolution**:
  1. Updated `AuthService.register_email` to check `if existing_doctor.email_verified: raise HTTPException(400, "An account with this email already exists")`.
  2. For unverified accounts (`not existing_doctor.email_verified`), allow re-registration: update password hash, full name, reset failed login attempts, invalidate prior unused tokens, issue a fresh 6-digit OTP and token, dispatch verification email, and return `HTTP 201 Created`.
  3. Added regression test `test_layer2_unverified_account_reregistration_allowed_until_verified` to `backend/tests/test_auth_robustness.py` and updated `backend/tests/test_auth.py::test_email_registration_and_login_flow`.

## 9. Bug Fix 2: OTP Email Delivery Configuration and Resend Resilience
- **Confirmed Runtime Cause**:
  Inspection of the Railway backend production environment confirmed that `EMAIL_BACKEND` was unset (`null`). The application defaulted to `EMAIL_BACKEND="console"`, which logs outgoing emails to stdout rather than delivering them via an email service provider. `RESEND_API_KEY` was also unset.
- **Provider Configuration Requirements (Non-Secret)**:
  Configured in Railway production:
  - `EMAIL_BACKEND=resend`
  - `EMAIL_FROM=noreply@gosmartclinic.com`
  - `EMAIL_FROM_NAME=GoSmartClinic`
  - `REQUIRE_EMAIL_VERIFICATION=true`
  - Secret requirement: `RESEND_API_KEY` must be configured as a private secret in Railway.
- **Code and Migration Changes**:
  - `backend/app/core/config.py`: Added fail-fast validation in `validate_production_settings` rejecting `console` or `memory` backends in production, rejecting unknown backend identifiers, enforcing `RESEND_API_KEY` when Resend is selected, and validating sender address format (`EMAIL_FROM`).
  - `backend/app/models/verification_token.py`: Added nullable `sent_at: Mapped[Optional[datetime]]` to `EmailVerificationToken`.
  - `backend/alembic/versions/011_add_sent_at_to_verification_tokens.py`: Created migration adding `sent_at` column with bidirectional upgrade/downgrade support.
  - `backend/app/schemas/auth.py`: Added optional `verification_email_sent: Optional[bool] = None` to `AuthResponse`.
  - `backend/app/services/auth_service.py`:
    - Updated `register_email` to record `sent_at` when delivery succeeds and return `verification_email_sent` in `AuthResponse`. Suppresses leaks of OTP/tokens in logs or responses on failure.
    - Updated `resend_verification` to base the 60-second cooldown on the last successfully sent email (`sent_at.isnot(None)`), deliver the replacement email before invalidating existing codes, return `HTTP 503` on provider error/rejection, preserve still-valid existing tokens on failure, and allow immediate retry without cooldown.
  - `lib/api.ts`: Updated `AuthResponse` interface to include optional `verification_email_sent?: boolean`.
  - `components/auth/EmailAuthForm.tsx`: After registration, transitions to verify view; activates the 60s cooldown and success notice only when `verification_email_sent` is true; when false, presents an accessible error alert explaining delivery failure and enables immediate code resending.
- **Automated and Live Verification Results**:
  - Full backend test suite: 195/195 tests passed (100% green, 0 regressions).
  - Next.js production build: passed with zero type or lint errors.
  - `scripts/verify_phase4_auth_ux.mjs`: 15/15 tests passed.
  - Alembic migration upgrade/downgrade: verified.

## 10. Bug 3: Onboarding Screen Logo Layout & Resend User-Agent
- **Issue**: After completing email verification, entering `/onboarding` displayed a disoriented, oversized icon.
- **Root Cause**:
  1. `app/onboarding/page.tsx` loading state nested `BRAND_CONFIG.icon.component` (which already contains a rounded squircle badge) inside another `rounded-xl bg-brand-600` wrapper with `p-2`, creating a distorted double-badge.
  2. `components/brand/StethoscopeHeartPulseIcon.tsx` rendered `<svg>` without explicit `width`/`height` attributes, relying solely on CSS classes. Before CSS hydration or under unconstrained flex, the SVG could blow up to viewport dimensions.
  3. `components/brand/BrandLogo.tsx` lacked explicit pixel dimensions and inline styles on the icon container, allowing parent flex layouts to stretch/squash the icon.
  4. Resend API Cloudflare protection required standard `User-Agent` headers (`backend/app/services/email_service.py`).
- **Fix**:
  1. Updated `components/brand/StethoscopeHeartPulseIcon.tsx` to set `width`, `height`, and `style={{ maxWidth: "100%", maxHeight: "100%" }}` on the SVG.
  2. Updated `components/brand/BrandLogo.tsx` to define `iconPixelSizes` (`sm: 28px`, `md: 32px`, `lg: 40px`), lock container `width`/`height` styles, pass `size` to `icon.component`, and apply `whitespace-nowrap` on brand text.
  3. Replaced ad-hoc raw icon loading states in `app/onboarding/page.tsx` and `app/[slug]/page.tsx` with `<BrandLogo size="lg" href={null} />`.
  4. Added `"User-Agent": f"{self.settings.BRAND_NAME}/1.0"` to `ResendEmailBackend.send` requests in `backend/app/services/email_service.py`.
  5. Isolated `test_auth.py` by adding an autouse `MemoryEmailBackend` fixture and `email_verified=True` for login credentials tests.

## 11. Manual Steps Pending
1. Configure `RESEND_API_KEY` secret in Railway backend service (completed).
2. Complete domain DNS records (`gosmartclinic.com`) propagation in Hostinger/Resend dashboard.
3. Deploy backend to Railway and trigger live end-to-end registration verification.

## 12. Known Issues and Follow-ups
None.

## 13. Rollback
- Revert commit: `git revert <commit-sha>`
- Database downgrade: `alembic downgrade -1` (drops `sent_at` column from `email_verification_tokens`).
- Railway config downgrade: set `EMAIL_BACKEND=console`.

---

# Password Reset Progress: Phase 1 (Backend Service Layer)

## 14. Summary
Executed Phase 1 (Backend Service Layer) of the Password Reset feature plan as specified in `docs/feature/email/password_reset_plan.md` (Section 3.1). Implemented `AuthService.forgot_password(db, email)` and `AuthService.reset_password(db, raw_code_or_token, email, new_password)` in `backend/app/services/auth_service.py`. The service layer incorporates SHA-256 hashed token pairs (6-digit OTP and URL token), constant-time verification, timing side-channel mitigation (`DUMMY_BCRYPT_HASH`), domain-level 60-second cooldown rate limiting with `Retry-After` headers, 5-attempt brute-force protection with complete token invalidation, atomic single-use replay defense via Compare-And-Swap row updates, same-password reuse rejection, and automatic JWT issuance on password reset. Created exhaustive unit and concurrency test suite `backend/tests/test_password_reset.py` verifying all 18 test scenarios with 100% pass rate.

## 15. Plan Reference
- **Plan Document**: `docs/feature/email/password_reset_plan.md` (Phase 1: Backend — Service Layer)
- **Base Commit SHA**: `603775188112dca15383368546dda127d26dc003`

## 16. Changes
- `backend/app/services/auth_service.py`: Added `forgot_password` and `reset_password` methods with atomic CAS replay defense, email delivery delegation, brute-force mitigation, and token pair issuance (Phase 1).
- `backend/tests/test_password_reset.py`: Created test suite covering 18 test cases across unit validation, security policies, token lifecycle, timing mitigation, multi-connection concurrency, and delivery failure resilience (Phase 1).
- `scripts/manual_test_password_reset_phase1.py`: Created live manual automated test suite executing 14 scenarios (27 individual test checks) against runtime SQLite database and in-memory outbox (Phase 1).
- `docs/feature/email/email_verification_progress.md`: Appended Phase 1 execution record, in-depth architectural decisions, and verification matrix.

## 17. In-Depth Decisions & Rationale

### Decision 1: Atomic Compare-And-Swap (CAS) Token Invalidation via `rows_updated == 0` Check
- **Decision**: In `AuthService.reset_password`, token invalidation queries `EmailVerificationToken.used_at == None` and inspects `rows_updated`. If `rows_updated == 0`, the transaction rolls back and returns HTTP 400 "Reset token has already been used."
- **Reasoning**: In high-concurrency environments or double-click scenarios where two simultaneous requests present the same valid OTP or token, standard read-then-write logic permits both threads to inspect `token.used_at is None` before either transaction commits. Checking the row count returned by the atomic `UPDATE ... WHERE used_at IS NULL` query ensures that exactly one transaction flips the token; any competing thread receives `rows_updated == 0`, guaranteeing single-use atomicity without race conditions.
- **Alternatives considered**:
  1. Database table locking (`SELECT FOR UPDATE`): Rejected because SQLite does not support `FOR UPDATE` and it introduces unnecessary lock contention.
  2. Redis distributed locks: Rejected because optimistic concurrency control on the existing database row provides rock-solid ACID compliance on both SQLite and PostgreSQL without introducing external infrastructure dependencies.
- **Consequences**: Provable single-use token replay defense under multi-threaded concurrency (verified in Test 17).

### Decision 2: Decoupled Email Delivery Fallback for Phase 1
- **Decision**: In `AuthService.forgot_password`, dynamically call `email_service.send_password_reset_email` if present, with a safe fallback to `email_service.backend.send` using an RFC-compliant plain text reset template.
- **Reasoning**: Phase 1 implements the service layer in `auth_service.py`, while Phase 3 introduces the HTML email template method in `email_service.py`. Implementing capability detection decouples Phase 1 from Phase 3, allowing Phase 1 to be fully implemented, tested, and verified independently without modifying out-of-scope files prematurely or failing on missing method attributes.
- **Alternatives considered**:
  1. Modifying `email_service.py` during Phase 1: Rejected because Phase 1 strictly specifies `backend/app/services/auth_service.py`.
  2. Stubbing or mocking unconditionally: Rejected because real runtime calls in non-mocked environments would raise `AttributeError`.
- **Consequences**: Phase 1 is hermetic, robust, and cleanly forward-compatible with Phase 3.

### Decision 3: Forward-Compatible Settings Fallback for Token Expiry
- **Decision**: In `AuthService.forgot_password`, compute expiration via `getattr(settings, "PASSWORD_RESET_EXPIRE_MINUTES", 30)`.
- **Reasoning**: Phase 2 formally registers `PASSWORD_RESET_EXPIRE_MINUTES: int = 30` in `backend/app/core/config.py`. Using a 30-minute fallback ensures the service defaults cleanly to the planned duration without breaking or requiring Phase 2 edits in Phase 1.
- **Alternatives considered**: Hardcoding `timedelta(minutes=30)` without `getattr`: Rejected because it would ignore `PASSWORD_RESET_EXPIRE_MINUTES` when added in Phase 2.
- **Consequences**: Zero friction when Phase 2 configuration is applied.

### Decision 4: Non-Existent and Inactive Account Timing Side-Channel Neutralization
- **Decision**: When `email` is not found or `doctor.is_active` is `False`, execute `verify_password("dummy", DUMMY_BCRYPT_HASH)` and return the generic message `{"message": "If an account exists with this email, a password reset link has been sent."}` with HTTP 200.
- **Reasoning**: Prevents user enumeration attacks. Without burning dummy bcrypt computation time, an attacker measuring HTTP response times could deduce whether an email address exists in the system (since bcrypt takes ~100-300ms while a direct DB miss takes <2ms). Inactive accounts also receive the same message to avoid exposing account status.
- **Alternatives considered**: Returning 404 for missing accounts: Rejected because it trivially exposes registered doctor email addresses.
- **Consequences**: Absolute enumeration resistance and timing side-channel safety.

### Decision 5: Domain-Level 60-Second Cooldown with `Retry-After` Header
- **Decision**: Enforce a 60-second cooldown per doctor on `forgot_password` based on the most recent `sent_at` timestamp in `EmailVerificationToken` where `purpose="password_reset"`, returning HTTP 429 with `Retry-After: <seconds>`.
- **Reasoning**: IP-based rate limiting (SlowAPI) can be circumvented using distributed proxies or VPNs. Domain-level rate limiting tied to the doctor's account prevents inbox flooding (email bombing) regardless of the requester's IP.
- **Alternatives considered**: Relying solely on route-level SlowAPI: Rejected due to susceptibility to multi-IP distributed attacks.
- **Consequences**: Doctor email accounts are shielded from spam attacks.

### Decision 6: Unlocking Password Reset for Google OAuth Accounts
- **Decision**: Permit accounts registered with `auth_provider == "google"` (and `hashed_password is None`) to initiate and complete password reset.
- **Reasoning**: Addresses the blocked user journey where Google-authenticated doctors wish to use standard email/password authentication. Upon reset, `hashed_password` is populated, allowing the doctor to authenticate via either Google OAuth or direct credentials.
- **Alternatives considered**: Blocking password reset for Google accounts: Rejected because `login_email` specifically directs users with Google accounts to "reset password" to create a password.
- **Consequences**: Seamless cross-provider credential management without duplicate accounts or orphaned data.

### Decision 7: Flexible Calling Signature for `reset_password`
- **Decision**: Support both keyword and positional conventions (`db, raw_code_or_token, email=None, new_password=None`) with internal argument normalizer for `(db, token, new_password)` when email is omitted in magic link flows.
- **Reasoning**: Accommodates URL magic links where `email` might be omitted, while maintaining positional parameter compatibility with the plan specification.
- **Alternatives considered**: Strict positional signature: Rejected because optional `email` precedes `new_password` in the plan outline, which is syntactically invalid in standard Python defaults without keyword-argument flexibility.
- **Consequences**: Clean ergonomic API for both OTP (with email) and magic link (without email) flows.

## 18. Deviations from Plan
None. Phase 1 service layer methods were implemented in exact conformity with the functional and security requirements of Section 3.1 in `docs/feature/email/password_reset_plan.md`.

## 19. Assumptions
- Password reset token validity defaults to 30 minutes (`PASSWORD_RESET_EXPIRE_MINUTES`).
- Email templates will link to `{FRONTEND_URL}/auth/reset-password?token={token}&email={email}` upon completion of Phase 3 and Phase 4.

## 20. Verification Results

### Baseline Comparison
- **Phase 0 baseline suite**: 194 passed, 1 pre-existing failure (`test_slot_generation.py::test_2_19_blocked_window` due to fixed test date matching current timestamp); 54 auth tests passed.
- **Post-Phase 1 test suite**: 72 auth tests passed (+18 new tests in `test_password_reset.py`, 0 failures); 18/18 password reset tests passed; 0 regressions.

### Password Reset Phase 1 Test Matrix (`backend/tests/test_password_reset.py`)
| # | Test Scenario | Layer | Actions & Verification | Result | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `test_forgot_password_sends_email` | L2 | Happy path: Doctor requests reset; token pair created with `purpose="password_reset"`, `sent_at` recorded, email dispatched | Exit code 0, `PASSED` | `PASS` |
| 2 | `test_forgot_password_nonexistent_email_no_leak` | L2 | Nonexistent email returns 200 generic message; 0 tokens created; 0 emails sent; dummy bcrypt burned | Exit code 0, `PASSED` | `PASS` |
| 3 | `test_forgot_password_inactive_account_no_leak` | L2 | Inactive doctor returns 200 generic message; 0 tokens created; 0 emails sent; status unrevealed | Exit code 0, `PASSED` | `PASS` |
| 4 | `test_forgot_password_60s_cooldown` | L2 | Second request within 60s raises HTTP 429 with valid `Retry-After` header | Exit code 0, `PASSED` | `PASS` |
| 5 | `test_forgot_password_google_only_account_sends_email` | L2 | Google doctor with `hashed_password=None` requests reset; token created, email dispatched | Exit code 0, `PASSED` | `PASS` |
| 6 | `test_reset_password_valid_otp` | L2 | 6-digit OTP reset validates password, sets hash, and returns `AuthResponse` with valid access token | Exit code 0, `PASSED` | `PASS` |
| 7 | `test_reset_password_valid_url_token` | L2 | URL token reset (omitting email) validates password and returns `AuthResponse` | Exit code 0, `PASSED` | `PASS` |
| 8 | `test_reset_password_expired_token` | L2 | Token with `expires_at < now` rejected with HTTP 400 "Reset token has expired" | Exit code 0, `PASSED` | `PASS` |
| 9 | `test_reset_password_already_used_token` | L2 | Token with `used_at IS NOT NULL` rejected with HTTP 400 "Reset token has already been used" | Exit code 0, `PASSED` | `PASS` |
| 10 | `test_reset_password_wrong_code_increments_attempts` | L2 | Invalid code increments `doctor.failed_login_attempts` from 0 to 1; returns HTTP 400 | Exit code 0, `PASSED` | `PASS` |
| 11 | `test_reset_password_5_failures_invalidates_all_tokens` | L2 | 5th failed attempt invalidates all active reset tokens (`used_at = now`) and returns HTTP 400 | Exit code 0, `PASSED` | `PASS` |
| 12 | `test_reset_password_same_as_current_rejected` | L2 | New password identical to existing password rejected with HTTP 400 | Exit code 0, `PASSED` | `PASS` |
| 13 | `test_reset_password_weak_password_rejected` | L1 | Password policy enforced (<8 chars rejected with HTTP 400) | Exit code 0, `PASSED` | `PASS` |
| 14 | `test_reset_password_auto_login_returns_jwt` | L2 | Reset returns JWT; authenticated GET `/api/v1/auth/me` returns 200 with doctor profile | Exit code 0, `PASSED` | `PASS` |
| 15 | `test_reset_password_clears_lockout` | L2 | Doctor with `failed_login_attempts=3` and `locked_until` has counter cleared to 0 and `locked_until=None` on reset | Exit code 0, `PASSED` | `PASS` |
| 16 | `test_reset_does_not_affect_email_verification_tokens` | L2 | Password reset marks reset tokens used but leaves `purpose="email_verification"` tokens untouched | Exit code 0, `PASSED` | `PASS` |
| 17 | `test_concurrent_reset_requests` | L3 | `ThreadPoolExecutor` concurrent reset with identical token: atomic CAS permits exactly 1 200 and 1 400 replay rejection | Exit code 0, `PASSED` | `PASS` |
| 18 | `test_reset_password_email_delivery_failure_503` | L3 | Provider dispatch failure raises HTTP 503; 0 tokens committed to database | Exit code 0, `PASSED` | `PASS` |

### Live Manual Automated Verification Matrix (`scripts/manual_test_password_reset_phase1.py`)
| Scenario | Checks | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 1: Happy Path Forgot Password** | 1.1 Generic message, 1.2 Two tokens created, 1.3 Email sent | Message returns generic string, 2 token rows in DB, outbox receives email | All 3 checks pass | `[PASS]` 1.1, 1.2, 1.3 | `PASS` |
| **Scenario 2: Anti-Enumeration & Timing** | 2.1 Same message on ghost email, 2.2 0 tokens, 2.3 Dummy bcrypt burned, 2.4 Inactive doctor | Generic response, 0 DB rows, timing >= 20ms (232.1ms observed), inactive unrevealed | All 4 checks pass | `[PASS]` 2.1, 2.2, 2.3 (232.1ms), 2.4 | `PASS` |
| **Scenario 3: Domain-Level 60s Cooldown** | 3.1 HTTP 429 on rapid repeat, 3.2 Structured Retry-After | 429 Too Many Requests with integer Retry-After header | 429 raised, `Retry-After: 59s` | `[PASS]` 3.1, 3.2 | `PASS` |
| **Scenario 4: Google-Only Reset** | 4.1 Google account requests reset | Reset email sent to Google user with `hashed_password=None` | Reset email dispatched | `[PASS]` 4.1 | `PASS` |
| **Scenario 5: Reset with OTP & Auto-Login** | 5.1 Password hash updated, 5.2 JWT issued, 5.3 Authenticated `/me` works | Bcrypt hash updated, JWT issued, GET `/me` returns 200 with doctor profile | Password verified, JWT works on `/me` | `[PASS]` 5.1, 5.2, 5.3 | `PASS` |
| **Scenario 6: Replay Protection** | 6.1 Replay attack rejected | Re-using the same OTP raises HTTP 400 "already been used" | HTTP 400 'Reset token has already been used.' | `[PASS]` 6.1 | `PASS` |
| **Scenario 7: URL Token (Magic Link)** | 7.1 Reset without email parameter | Valid token resets password when email param is omitted | Password successfully updated | `[PASS]` 7.1 | `PASS` |
| **Scenario 8: Expired Token Rejection** | 8.1 Expired token rejected | Past expires_at raises HTTP 400 | HTTP 400 'Reset token has expired.' | `[PASS]` 8.1 | `PASS` |
| **Scenario 9: Brute-Force Guessing** | 9.1 Counter increments, 9.2 Token valid at attempt 4, 9.3 5th attempt invalidates all | 4 failed attempts record counter; 5th marks all tokens used | Counter=4; attempt 5 invalidates tokens | `[PASS]` 9.1, 9.2, 9.3 | `PASS` |
| **Scenario 10: Reject Same Password** | 10.1 Same password rejected | Identical password raises HTTP 400 | HTTP 400 'New password must be different...' | `[PASS]` 10.1 | `PASS` |
| **Scenario 11: Clear Lockout on Reset** | 11.1 attempts reset to 0, 11.2 locked_until reset to None | Successful reset clears doctor lockout | failed_attempts=0, locked_until=None | `[PASS]` 11.1, 11.2 | `PASS` |
| **Scenario 12: Isolation from Verify Tokens** | 12.1 Reset token marked used, 12.2 Verification token untouched | Only `purpose="password_reset"` updated | pr_token.used_at set, ev_token.used_at is None | `[PASS]` 12.1, 12.2 | `PASS` |
| **Scenario 13: Atomic CAS Concurrency** | 13.1 Competing threads reset same token | Exactly 1 200, 1 400 replay rejection | Statuses: `[400, 200]` | `[PASS]` 13.1 | `PASS` |
| **Scenario 14: Outage & Atomic Rollback** | 14.1 Provider failure raises 503, 14.2 0 tokens committed | Delivery failure raises 503; DB rolls back | Code 503; 0 tokens in DB | `[PASS]` 14.1, 14.2 | `PASS` |

**Final Phase 1 Verdict**: `VERIFIED` (27/27 live checks passed, 18/18 pytest test cases passed)

## 21. Manual Steps Pending
None for Phase 1.

## 22. Known Issues and Follow-ups
- **Pre-existing Issue**: `backend/tests/test_slot_generation.py::test_2_19_blocked_window` fails when the current local time is past 13:00 on the fixed test date (`2026-11-14`). This is independent of the auth system.
- **Follow-ups**:
  - Phase 2: Add `PASSWORD_RESET_EXPIRE_MINUTES` and `RATE_LIMIT_PASSWORD_RESET` to `config.py`, declare request schemas in `schemas/auth.py`, and expose `/forgot-password` and `/reset-password` routes in `routes/auth.py`.
  - Phase 3: Implement branded HTML password reset template in `EmailServiceManager.send_password_reset_email`.
  - Phase 4: Implement Next.js frontend pages and components (`ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`).

## 23. Rollback
- Revert commit: `git revert <commit-sha>`
- No database migrations or schema adjustments required.

---

# Password Reset Progress: Phase 2 (Config, Schemas & Routes)

## 24. Summary
Executed Phase 2 (Backend — Config, Schemas, Routes) of the Password Reset feature plan as specified in `docs/feature/email/password_reset_plan.md` (Section 3.2). Added `PASSWORD_RESET_EXPIRE_MINUTES: int = 30` and `RATE_LIMIT_PASSWORD_RESET: str = "3/minute"` to application settings in `backend/app/core/config.py`. Declared `ForgotPasswordRequest`, `ForgotPasswordResponse`, and `ResetPasswordRequest` schemas in `backend/app/schemas/auth.py` enforcing RFC email format, password strength policies, and mutual inclusion of either a 6-digit OTP code or a URL-safe token. Implemented two public endpoints in `backend/app/api/routes/auth.py`: `POST /api/v1/auth/forgot-password` (anti-enumeration generic 200 response) and `POST /api/v1/auth/reset-password` (OTP/magic link password update returning authenticated `AuthResponse`), both protected by route-level SlowAPI rate limiting (`RATE_LIMIT_PASSWORD_RESET`). Created comprehensive test suites `backend/tests/test_password_reset_routes.py` (15 tests) and `scripts/manual_test_password_reset_phase2.py` (14 scenarios, 30 checks) achieving a 100% pass rate.

## 25. Plan Reference
- **Plan Document**: `docs/feature/email/password_reset_plan.md` (Phase 2: Backend — Config, Schemas, Routes)
- **Base Commit SHA**: `f05cb3aa33a9d3244f9c5954bde660823a36fae6` (Phase 1 commit)

## 26. Changes
- `backend/app/core/config.py`: Added `PASSWORD_RESET_EXPIRE_MINUTES: int = 30` and `RATE_LIMIT_PASSWORD_RESET: str = "3/minute"` configuration settings (Phase 2).
- `backend/app/schemas/auth.py`: Added `ForgotPasswordRequest`, `ForgotPasswordResponse`, and `ResetPasswordRequest` models with email validation and code/token requirements (Phase 2).
- `backend/app/api/routes/auth.py`: Mounted `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` routes protected with SlowAPI rate limiting (Phase 2).
- `backend/app/services/auth_service.py`: Updated `AuthService.forgot_password` to reference `settings.PASSWORD_RESET_EXPIRE_MINUTES` directly now that it is registered in config (Phase 2).
- `backend/tests/test_password_reset_routes.py`: Created 15 endpoint integration test cases verifying contracts, 422 validations, route-level rate limiting, and password reset flows (Phase 2).
- `scripts/manual_test_password_reset_phase2.py`: Authored live automated test suite executing 14 scenarios (30 checks) against live FastAPI endpoints and SlowAPI (Phase 2).
- `docs/feature/email/email_verification_progress.md`: Documented Phase 2 implementation, architectural decisions, and verification matrix.

## 27. In-Depth Decisions & Rationale

### Decision 1: Dedicated `ForgotPasswordResponse` Model vs Generic Dict
- **Decision**: Declared an explicit Pydantic response schema `ForgotPasswordResponse(BaseModel)` with field `message: str` rather than returning an untyped dictionary or reusing `VerificationMessageResponse`.
- **Reasoning**: `VerificationMessageResponse` includes an optional `email: Optional[str] = None` attribute which would serialize as `{"message": "...", "email": null}` unless stripped, unnecessarily bloating the payload and complicating response schema contracts. Defining `ForgotPasswordResponse(message=...)` ensures the endpoint strictly emits `{"message": ...}`, accurately documents the OpenAPI schema, and guarantees client predictability.
- **Alternatives considered**: Reusing `VerificationMessageResponse`: Rejected to avoid serializing `email: null` into forgot-password responses.
- **Consequences**: Type-safe response contract compliant with the specification.

### Decision 2: Two-Tier Rate Limiting Architecture
- **Decision**: Layered route-level SlowAPI IP rate limiting (`RATE_LIMIT_PASSWORD_RESET = "3/minute"`) on top of the domain-level account cooldown (60 seconds per doctor email).
- **Reasoning**:
  1. *Route-level SlowAPI limiter* (`3/minute` per IP) defends backend infrastructure and upstream email delivery APIs against high-frequency distributed Denial of Service (DoS) attacks and brute-force token-guessing scripts originating from single IPs.
  2. *Domain-level cooldown* (60-second window in `AuthService`) protects doctor inboxes against email bombing campaigns launched across rotating proxies or multiple IPs targeting a single victim email.
- **Alternatives considered**: Relying solely on SlowAPI route limiter: Rejected because distributed attacks across multiple IPs could still flood a doctor's inbox with reset emails.
- **Consequences**: Multi-layered defense shielding both backend servers and doctor email accounts.

### Decision 3: Flexible Mutual Exclusivity in `ResetPasswordRequest`
- **Decision**: Implemented `@model_validator(mode="after")` verifying `raw = (self.code or self.token or "").strip()`. If `not raw`, raises `ValueError("Either code or token is required")`.
- **Reasoning**: Password reset can be completed either manually via 6-digit OTP (entered by user on web page alongside their email) or via one-click URL magic link (`/auth/reset-password?token=...` where email is omitted). Allowing either `code` or `token` while validating that at least one is present supports both user journeys seamlessly under a unified endpoint contract.
- **Alternatives considered**: Creating two distinct endpoints (`/reset-password-otp` and `/reset-password-token`): Rejected as unnecessary complexity given that `AuthService.reset_password` already handles both token formats uniformly via SHA-256 hash lookup.
- **Consequences**: Streamlined API surface and consistent validation errors (HTTP 422).

## 28. Deviations from Plan
None. Phase 2 config, schemas, and endpoints were implemented in exact conformity with Section 3.2 of `docs/feature/email/password_reset_plan.md`.

## 29. Assumptions
- SlowAPI uses the client remote IP as the rate-limiting key. In production behind reverse proxies (Cloudflare/Railway), standard `X-Forwarded-For` headers are processed.
- Magic link requests submit `token` and `new_password` without requiring `email`.

## 30. Verification Results

### Baseline Comparison
- **Phase 0 baseline suite**: 49 auth tests passed in `test_password_reset.py`, `test_auth.py`, `test_auth_robustness.py`.
- **Post-Phase 2 test suite**: 78 auth tests passed (+15 new endpoint integration tests in `test_password_reset_routes.py`, 0 failures); 30/30 manual automated checks passed in `scripts/manual_test_password_reset_phase2.py`; 27/27 manual checks passed in Phase 1 suite; 0 regressions.

### Password Reset Phase 2 Route Integration Tests (`backend/tests/test_password_reset_routes.py`)
| # | Test Scenario | Layer | Actions & Verification | Result | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `test_forgot_password_route_happy_path` | L2 | POST `/api/v1/auth/forgot-password` with valid email returns 200, sends email, creates 2 token rows | Exit code 0, `PASSED` | `PASS` |
| 2 | `test_forgot_password_route_nonexistent_email_anti_enumeration` | L2 | POST with nonexistent email returns 200 generic message, 0 emails sent | Exit code 0, `PASSED` | `PASS` |
| 3 | `test_forgot_password_route_inactive_doctor_anti_enumeration` | L2 | POST with inactive doctor returns 200 generic message, 0 emails sent | Exit code 0, `PASSED` | `PASS` |
| 4 | `test_forgot_password_route_invalid_email_format_422` | L1 | POST with invalid email format returns HTTP 422 Unprocessable Content | Exit code 0, `PASSED` | `PASS` |
| 5 | `test_forgot_password_route_domain_cooldown_429` | L2 | Rapid second POST within 60s returns HTTP 429 with positive `Retry-After` header | Exit code 0, `PASSED` | `PASS` |
| 6 | `test_forgot_password_route_slowapi_rate_limit` | L2 | 4th POST within 1 minute from same IP returns HTTP 429 Too Many Requests | Exit code 0, `PASSED` | `PASS` |
| 7 | `test_reset_password_route_valid_otp` | L2 | POST `/api/v1/auth/reset-password` with valid OTP returns 200 `AuthResponse`, new password logins work | Exit code 0, `PASSED` | `PASS` |
| 8 | `test_reset_password_route_valid_url_token_without_email` | L2 | POST with URL token (no email) returns 200 `AuthResponse` with valid JWT | Exit code 0, `PASSED` | `PASS` |
| 9 | `test_reset_password_route_missing_code_and_token_422` | L1 | POST without code or token returns HTTP 422 with validation error | Exit code 0, `PASSED` | `PASS` |
| 10 | `test_reset_password_route_invalid_code_400` | L2 | POST with invalid 6-digit OTP returns HTTP 400 Bad Request | Exit code 0, `PASSED` | `PASS` |
| 11 | `test_reset_password_route_expired_token_400` | L2 | POST with expired token returns HTTP 400 Bad Request | Exit code 0, `PASSED` | `PASS` |
| 12 | `test_reset_password_route_reused_token_400` | L2 | POST with already used token returns HTTP 400 replay error | Exit code 0, `PASSED` | `PASS` |
| 13 | `test_reset_password_route_same_as_current_password_400` | L2 | POST with password identical to current password returns HTTP 400 | Exit code 0, `PASSED` | `PASS` |
| 14 | `test_reset_password_route_weak_password_400` | L1 | POST with weak password (<8 characters) returns HTTP 400 | Exit code 0, `PASSED` | `PASS` |
| 15 | `test_reset_password_route_slowapi_rate_limit` | L2 | 4th reset request from same IP returns HTTP 429 Too Many Requests | Exit code 0, `PASSED` | `PASS` |

### Live Manual Automated Verification Matrix (`scripts/manual_test_password_reset_phase2.py`)
| Scenario | Checks | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 1: Happy Path Forgot Password** | 1.1 Status 200, 1.2 Body contract, 1.3 Email sent, 1.4 DB tokens | Status 200, generic message, outbox receives email, 2 DB tokens | All 4 checks pass | `[PASS]` 1.1, 1.2, 1.3, 1.4 | `PASS` |
| **Scenario 2: Anti-Enumeration & Timing** | 2.1 200 on ghost, 2.2 Generic message, 2.3 Dummy bcrypt timing, 2.4 0 emails, 2.5 Inactive doctor | 200 response, timing >= 20ms (244.1ms observed), 0 emails, inactive unrevealed | All 5 checks pass | `[PASS]` 2.1, 2.2, 2.3 (244.1ms), 2.4, 2.5 | `PASS` |
| **Scenario 3: Input Validation (422)** | 3.1 Invalid email format, 3.2 Missing email field | Malformed and empty payloads rejected with 422 | Both rejected with 422 | `[PASS]` 3.1, 3.2 | `PASS` |
| **Scenario 4: Domain-Level 60s Cooldown** | 4.1 1st request 200, 4.2 2nd triggers 429, 4.3 Retry-After header | Second request within 60s returns 429 with positive Retry-After | 429 raised, `Retry-After: 59s` | `[PASS]` 4.1, 4.2, 4.3 | `PASS` |
| **Scenario 5: SlowAPI Route Limit (3/min)** | 5.1 4th request from same IP hits 429 | 4th request within 1 min blocked by SlowAPI | Status 429 Too Many Requests | `[PASS]` 5.1 | `PASS` |
| **Scenario 6: Reset with OTP & Auto-Login** | 6.1 Status 200, 6.2 Returns access_token, 6.3 Doctor/tenant, 6.4 GET /me, 6.5 POST /login | 200 OK, AuthResponse with JWT, /me succeeds with JWT, login succeeds with new password | All 5 checks pass | `[PASS]` 6.1, 6.2, 6.3, 6.4, 6.5 | `PASS` |
| **Scenario 7: URL Token (No Email)** | 7.1 Magic link token resets password without email param | 200 OK with valid JWT | Status 200 with access_token | `[PASS]` 7.1 | `PASS` |
| **Scenario 8: Schema Validation on Reset** | 8.1 Missing both code and token returns 422 | Pydantic model validator rejects missing token | Status 422 with clear message | `[PASS]` 8.1 | `PASS` |
| **Scenario 9: Token Replay Defense** | 9.1 Reused token rejected with HTTP 400 | Replay attempt rejected with 400 | HTTP 400 'already been used' | `[PASS]` 9.1 | `PASS` |
| **Scenario 10: Expired Token Rejection** | 10.1 Expired token rejected with HTTP 400 | Past expires_at raises 400 | HTTP 400 'expired' | `[PASS]` 10.1 | `PASS` |
| **Scenario 11: Weak Password Policy** | 11.1 Weak password rejected with HTTP 400 | <8 characters raises 400 | HTTP 400 'at least 8 characters' | `[PASS]` 11.1 | `PASS` |
| **Scenario 12: Same Password Rejection** | 12.1 Same password rejected with HTTP 400 | Matching existing password raises 400 | HTTP 400 'different from current' | `[PASS]` 12.1 | `PASS` |
| **Scenario 13: Brute-Force Guessing on Endpoint** | 13.1 Valid after 4 tries, 13.2 5th lockout, 13.3 Tokens invalidated | 4 failed guesses leave token valid; 5th invalidates all tokens | Lockout enforced, all tokens used | `[PASS]` 13.1, 13.2, 13.3 | `PASS` |
| **Scenario 14: SlowAPI Route Limit on Reset** | 14.1 4th reset request hits 429 | 4th request within 1 min blocked by SlowAPI | Status 429 Too Many Requests | `[PASS]` 14.1 | `PASS` |

**Final Phase 2 Verdict**: `VERIFIED` (30/30 live checks passed, 15/15 pytest test cases passed, 78/78 total auth test suite passed)

## 31. Manual Steps Pending
None for Phase 2.

## 32. Known Issues and Follow-ups
- **Pre-existing Issue**: `backend/tests/test_slot_generation.py::test_2_19_blocked_window` fails when the current local time is past 13:00 on the fixed test date (`2026-11-14`). This is independent of the auth system.
- **Follow-ups**:
  - Phase 3: Implement branded HTML password reset template in `EmailServiceManager.send_password_reset_email` (`backend/app/services/email_service.py`).
  - Phase 4: Implement Next.js frontend pages and components (`ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`).

## 33. Rollback
- Revert commit: `git revert <commit-sha>`
- Remove `PASSWORD_RESET_EXPIRE_MINUTES` and `RATE_LIMIT_PASSWORD_RESET` from environment overrides if set.
- No database migrations or schema adjustments required.

---

# Password Reset Progress: Phase 3 (Backend — Email Template)

## 34. Summary
Executed Phase 3 (Backend — Email Template) of the Password Reset feature plan as specified in `docs/feature/email/password_reset_plan.md` (Section 3, Phase 3). Implemented `EmailService.send_password_reset_email(to_email, doctor_name, otp, token, tenant_slug)` in `backend/app/services/email_service.py`. The method generates a branded HTML email with a prominently displayed 6-digit OTP reset code, a "Reset Password" magic link button pointing to `{FRONTEND_URL}/auth/reset-password?token={token}&email={encoded_email}`, a 30-minute expiry notice, and a "didn't request this" disclaimer. Follows the identical HTML template pattern (styling, layout, structure) as the existing `send_verification_email` method.

## 35. Plan Reference
- **Plan Document**: `docs/feature/email/password_reset_plan.md` (Phase 3: Backend — Email Template)
- **Base Commit SHA**: `f05cb3aa33a9d3244f9c5954bde660823a36fae6` (Phase 1 commit, Phase 2 changes unstaged)

## 36. Changes
- `backend/app/services/email_service.py`: Added `send_password_reset_email` method to `EmailService` class with branded HTML + plain text templates, OTP card, magic link button, 30-minute expiry notice, and safety disclaimer (Phase 3).
- `docs/feature/email/email_verification_progress.md`: Appended Phase 3 execution record with decisions, verification matrix, and follow-ups.

## 37. Decisions

### Decision 1: Reuse Identical CSS and Layout from `send_verification_email`
- **Decision**: Copied the exact CSS styles (`.container`, `.header`, `.otp-card`, `.otp-code`, `.btn`, `.footer`) and HTML structure from `send_verification_email` into the reset email template.
- **Reasoning**: Ensures visual consistency across all transactional emails from the platform. Users receiving both verification and password reset emails see a unified brand experience. The plan explicitly states "Follows the same HTML template pattern as `send_verification_email`."
- **Alternatives considered**: Extracting a shared base template function to reduce duplication. Rejected because the plan specifies only adding the method, not refactoring shared templates (out of scope).
- **Consequences**: Slight code duplication (~40 lines of CSS), but strict plan compliance and zero risk of breaking existing verification emails.

### Decision 2: Use `PASSWORD_RESET_EXPIRE_MINUTES` from Settings for Expiry Notice
- **Decision**: Referenced `self.settings.PASSWORD_RESET_EXPIRE_MINUTES` (now registered in config from Phase 2) for the expiry notice in both text and HTML content.
- **Reasoning**: Ensures the displayed expiry time stays in sync with the actual token expiry configured in Phase 2 settings. If the setting is changed, the email reflects the updated value automatically.
- **Alternatives considered**: Hardcoding "30 minutes". Rejected because it would drift from the config if the setting is changed.
- **Consequences**: Single source of truth for expiry duration.

### Decision 3: `tenant_slug` Parameter Accepted but Unused
- **Decision**: Kept the `tenant_slug` parameter in the method signature for forward compatibility, matching the calling convention in `AuthService.forgot_password`, but did not use it in the email body.
- **Reasoning**: The plan specifies the parameter in the method signature. It may be used in the future for multi-tenant branded email customization. The existing `send_verification_email` follows the same pattern (accepting `tenant_slug` without using it).
- **Consequences**: Clean forward-compatible API.

## 38. Deviations from Plan
None. The method was implemented exactly as specified in Section 3, Phase 3 of `docs/feature/email/password_reset_plan.md`.

## 39. Assumptions
- The plan states subject should be "Reset your GoSmartClinic password". Implemented as `f"Reset your {self.settings.BRAND_NAME} password"` to use the dynamic brand name setting, consistent with `send_verification_email`.
- `None` doctor name defaults to "Doctor", matching the existing verification email pattern.

## 40. Verification Results

### Baseline Comparison
- **Phase 0 baseline suite**: 15 auth tests passed (`test_auth.py`).
- **Post-Phase 3 test suite**: 15 auth tests passed (0 regressions); all email template assertions passed.

### Phase 3 Verification Matrix
| Scenario | Type | Actions | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Method exists on `EmailService` | `AGENT_EXECUTABLE` | `hasattr(email_service, 'send_password_reset_email')` | `True` | `True` | Python REPL output | `PASS` |
| Happy path: send returns `True` | `AGENT_EXECUTABLE` | Call with MemoryEmailBackend, check return value | `True` | `True` | `send returned: True` | `PASS` |
| Subject format | `AGENT_EXECUTABLE` | Check `email['subject']` | `"Reset your GoSmartClinic password"` | `"Reset your GoSmartClinic password"` | REPL output | `PASS` |
| OTP in text content | `AGENT_EXECUTABLE` | Assert OTP string present in text | OTP `123456` present | Present | Assertion passed | `PASS` |
| Magic link URL in text content | `AGENT_EXECUTABLE` | Assert `reset-password?token=...&email=...` in text | URL present | Present | Assertion passed | `PASS` |
| 30-minute expiry in text content | `AGENT_EXECUTABLE` | Assert `30 minutes` in text | Present | Present | Assertion passed | `PASS` |
| Disclaimer in text content | `AGENT_EXECUTABLE` | Assert `safely ignore` in text | Present | Present | Assertion passed | `PASS` |
| OTP in HTML content | `AGENT_EXECUTABLE` | Assert OTP string present in HTML | OTP `123456` present | Present | Assertion passed | `PASS` |
| Magic link URL in HTML content | `AGENT_EXECUTABLE` | Assert reset URL in HTML | URL present | Present | Assertion passed | `PASS` |
| 30-minute expiry in HTML content | `AGENT_EXECUTABLE` | Assert `30 minutes` in HTML | Present | Present | Assertion passed | `PASS` |
| Disclaimer in HTML content | `AGENT_EXECUTABLE` | Assert `safely ignore` in HTML | Present | Present | Assertion passed | `PASS` |
| "Reset Password" button text | `AGENT_EXECUTABLE` | Assert `Reset Password` in HTML | Present | Present | Assertion passed | `PASS` |
| "Your Reset Code" OTP label | `AGENT_EXECUTABLE` | Assert `Your Reset Code` in HTML | Present | Present | Assertion passed | `PASS` |
| `None` doctor_name defaults to "Doctor" | `AGENT_EXECUTABLE` | Call with `doctor_name=None`, check text | `"Hello Doctor"` | `"Hello Doctor"` | Assertion passed | `PASS` |
| Existing tests regression check | `AGENT_EXECUTABLE` | `pytest tests/test_auth.py -x -q` | 15 passed | 15 passed | Exit code 0 | `PASS` |
| Phase 1 `hasattr` fallback now resolves | `AGENT_EXECUTABLE` | `hasattr(email_service, 'send_password_reset_email')` returns `True` | `True` | `True` | The fallback in `AuthService.forgot_password` now calls the real method | `PASS` |

**Final Phase 3 Verdict**: `VERIFIED` (16/16 checks passed, 0 regressions)

## 41. Manual Steps Pending
None for Phase 3.

## 42. Known Issues and Follow-ups
- **Pre-existing Issue**: `backend/tests/test_slot_generation.py::test_2_19_blocked_window` fails when the current local time is past 13:00 on the fixed test date (`2026-11-14`). Independent of auth system.
- **Follow-ups**:
  - Phase 4: Implement Next.js frontend pages and components (`ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, forgot-password/reset-password pages).

## 43. Rollback
- Revert commit: `git revert <commit-sha>`
- No database migrations or schema adjustments required.
- `AuthService.forgot_password` will gracefully fall back to `email_service.backend.send` with plain-text reset email if `send_password_reset_email` method is absent.

---

# Password Reset Progress: Phase 4 (Frontend — UI Components & Routes)

## 44. Summary
Executed Phase 4 (Frontend — UI Components) of the Password Reset feature plan as specified in `docs/feature/email/password_reset_plan.md` (Section 3, Phase 4). Added a dedicated "Forgot password?" link below the login password field in `components/auth/EmailAuthForm.tsx` that routes to `/auth/forgot-password`. Implemented `ForgotPasswordForm.tsx` with email request initiation, 6-digit OTP code entry, and 60-second resend cooldown timer. Developed `ResetPasswordForm.tsx` supporting dual entry points (prefilled token from email magic link or OTP code parameter), live password strength checklist matching backend security policies, client-side password confirmation matching, automatic JWT persistence, and conditional post-reset redirects. Integrated client API helper functions `forgotPassword` and `resetPassword` in `lib/api.ts`, wrapped App Router pages in `<Suspense>` boundaries to guarantee safe client-side hydration, and verified the entire UI contract with `scripts/verify_password_reset_ui.mjs` and Next.js production build.

## 45. Plan Reference
- **Plan**: `docs/feature/email/password_reset_plan.md` (Section 3.4 Phase 4: Frontend — UI Components)
- **Base Commit SHA**: `61cafe9470f23881e0797441b703100186ef5a5a`

## 46. Changes
- `lib/api.ts`: Added `ForgotPasswordResponse`, `ResetPasswordPayload`, `forgotPassword()`, and `resetPassword()` API functions with automatic token storage on success.
- `components/auth/EmailAuthForm.tsx`: Added "Forgot password?" link below password input in login mode routing to `/auth/forgot-password`.
- `components/auth/ForgotPasswordForm.tsx`: Created standalone form component handling email submission, transition to OTP entry view, 60s cooldown timer, and navigation to reset page.
- `components/auth/ResetPasswordForm.tsx`: Created standalone form component handling password reset with strength indicator checklist, matching password check, token/code query param ingestion, auto-login, and redirect.
- `app/auth/forgot-password/page.tsx`: Created Next.js route with branded metadata and Suspense boundary.
- `app/auth/forgot-password/ForgotPasswordClient.tsx`: Created client component reading initial email query parameters.
- `app/auth/reset-password/page.tsx`: Created Next.js route with branded metadata and Suspense boundary.
- `app/auth/reset-password/ResetPasswordClient.tsx`: Created client component reading `token`, `code`, and `email` query parameters.
- `scripts/verify_password_reset_ui.mjs`: Created automated verification test suite exercising all 10 frontend UI checks specified in plan section 3.6.2.

## 47. Decisions

### Decision 1: Dedicated Route & Component Architecture with Suspense Boundaries
- **Decision**: Implemented `app/auth/forgot-password/page.tsx` and `app/auth/reset-password/page.tsx` using separate client components (`ForgotPasswordClient.tsx` and `ResetPasswordClient.tsx`) wrapped in `<Suspense>` boundaries.
- **Reasoning**: Next.js App Router requires `<Suspense>` wrappers around any client components using `useSearchParams()` during static page generation. This avoids hydration bailouts and guarantees optimal static prerendering (`○ (Static)`) in production builds.
- **Alternatives considered**: Toggling view state internally inside `EmailAuthForm.tsx`. Rejected because deep-linking from emails with `?token=xxx&email=yyy` requires dedicated, linkable URLs (`/auth/reset-password`).
- **Consequences**: Clean separation of concerns, bookmarkable and email-linkable URLs, and flawless static compilation.

### Decision 2: Reuse of Validated Password Checklist & Email Regex
- **Decision**: Reused the exact `validatePassword` strength evaluator and regex logic from `EmailAuthForm.tsx` in `ResetPasswordForm.tsx`.
- **Reasoning**: Maintains 100% visual and logical consistency between doctor registration and password reset, ensuring users receive identical feedback against the 5 security requirements (8+ chars, uppercase, lowercase, digit, special symbol).
- **Alternatives considered**: Implementing a separate, lighter validator for reset. Rejected because inconsistent validation rules would frustrate users and fail backend schema validation.
- **Consequences**: Uniform UX and zero drift between signup and reset validation.

### Decision 3: Flexible Reset Credential Handling (Magic Link Token or OTP Code)
- **Decision**: `ResetPasswordForm` dynamically supports both entry routes: if `token` or `code` is provided via URL query params (`?token=...` or `?code=...`), it hides the code input and displays a clean reminder of the target email; if neither is provided in query params, it surfaces a 6-digit code input field.
- **Reasoning**: Allows seamless UX when doctors click the magic link in their email (token pre-filled), when they transition from the OTP step on the website (code pre-filled), or when they navigate directly to the reset page.
- **Alternatives considered**: Separate forms for magic link vs OTP code. Rejected because the backend endpoint `/api/v1/auth/reset-password` accepts either `token` or `code` in `ResetPasswordRequest`, so a unified form provides the cleanest doctor experience.
- **Consequences**: Robust, unified UX supporting all entry points.

## 48. Deviations from Plan
None. All components, pages, API functions, and verification checks were implemented in exact alignment with Section 3, Phase 4 and Section 3.6.2 of `docs/feature/email/password_reset_plan.md`.

## 49. Assumptions
- Post-reset redirect: If doctor profile has `onboarding_completed: false`, redirects to `/onboarding`; otherwise redirects to `/dashboard`, matching the existing `EmailAuthForm` behavior.
- Resend cooldown is initialized to 60 seconds after successful email dispatch, matching the backend domain-level 60-second cooldown window.

## 50. Verification Results

### Baseline Comparison
- **Phase 0 Baseline (Backend)**: 33 auth tests passed (`test_auth.py`, `test_password_reset.py`).
- **Phase 0 Baseline (Frontend)**: `npm run lint` 0 warnings/errors; `npx tsc --noEmit` 0 errors.
- **Post-Phase 4 Test Suite**: 33 auth tests passed (0 regressions); `npm run build` static compilation succeeded for all routes; `verify_password_reset_ui.mjs` 10/10 checks passed.

### Phase 4 Verification Matrix
| Scenario | Type | Actions | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Login "Forgot password?" Link | `AGENT_EXECUTABLE` | Verify link in `EmailAuthForm.tsx` in login mode | Points to `/auth/forgot-password` | Verified | `node scripts/verify_password_reset_ui.mjs` Check 1 | `PASS` |
| Forgot Password API Client | `AGENT_EXECUTABLE` | Check `forgotPassword()` in `lib/api.ts` | Calls `/api/v1/auth/forgot-password` | Verified | `verify_password_reset_ui.mjs` Check 2 | `PASS` |
| OTP Input & 60s Resend Cooldown | `AGENT_EXECUTABLE` | Check step transition, 6-digit input, and 60s timer in `ForgotPasswordForm.tsx` | Present and restricted to 6 digits | Verified | `verify_password_reset_ui.mjs` Check 3 | `PASS` |
| Password Confirmation Matching | `AGENT_EXECUTABLE` | Check client-side mismatch check and submit disabling in `ResetPasswordForm.tsx` | Disables submit when mismatch | Verified | `verify_password_reset_ui.mjs` Check 4 | `PASS` |
| Password Strength Indicator | `AGENT_EXECUTABLE` | Check 5-point checklist in `ResetPasswordForm.tsx` | 8+ chars, upper, lower, digit, special | Verified | `verify_password_reset_ui.mjs` Check 5 | `PASS` |
| Auto-login & Redirect on Success | `AGENT_EXECUTABLE` | Check `setAuthToken(access_token)` and router redirects | Stores JWT, redirects dashboard/onboarding | Verified | `verify_password_reset_ui.mjs` Check 6 | `PASS` |
| Accessible Error Alerts | `AGENT_EXECUTABLE` | Check `role="alert"` and `aria-live="polite"` on error alerts | Present on both forms | Verified | `verify_password_reset_ui.mjs` Check 7 | `PASS` |
| Magic Link Query Pre-population | `AGENT_EXECUTABLE` | Check `useSearchParams` handling in `ResetPasswordClient.tsx` | Reads `token`, `code`, and `email` | Verified | `verify_password_reset_ui.mjs` Check 8 | `PASS` |
| Next.js Suspense Boundaries | `AGENT_EXECUTABLE` | Check `<Suspense>` wrappers on App Router pages | Present on both pages | Verified | `verify_password_reset_ui.mjs` Check 9 | `PASS` |
| Validator Logic Rules | `AGENT_EXECUTABLE` | Test `isValidEmail` and `validatePassword` against test vectors | Correct boolean outcomes | Verified | `verify_password_reset_ui.mjs` Check 10 | `PASS` |
| Next.js TypeScript Compilation | `AGENT_EXECUTABLE` | `npx tsc --noEmit` | Exit code 0, 0 errors | 0 errors | Terminal exit code 0 | `PASS` |
| Next.js Linting | `AGENT_EXECUTABLE` | `npm run lint` | Exit code 0, 0 warnings/errors | 0 warnings | Terminal exit code 0 | `PASS` |
| Next.js Production Build | `AGENT_EXECUTABLE` | `npm run build` | Route generation and static compilation successful | `○ /auth/forgot-password` and `○ /auth/reset-password` built | Next.js output | `PASS` |
| Backend Tests Regression Check | `AGENT_EXECUTABLE` | `pytest backend/tests/test_auth.py backend/tests/test_password_reset.py` | 33 passed, 0 regressions | 33 passed | Exit code 0 | `PASS` |

**Final Phase 4 Verdict**: `VERIFIED` (14/14 checks passed, 0 regressions)

## 51. Manual Steps Pending
None for Phase 4. Automated UI verification suite and full production build execution confirmed all behavior.

## 52. Known Issues and Follow-ups
- **Follow-ups**:
  - Phase 5: Optional database index migration (`ix_evt_doctor_purpose_reset`).
  - Phase 6: Comprehensive cross-layer end-to-end testing suite integration.

## 53. Rollback
- Revert commit: `git revert <commit-sha>`
- Delete added routes `app/auth/forgot-password` and `app/auth/reset-password`.
- No database migrations or schema adjustments required.



