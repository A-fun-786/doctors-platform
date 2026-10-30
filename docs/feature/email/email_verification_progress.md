# Email Registration & Verification Progress

## 1. Summary
Implemented Phase 1 (Database Schema & Migration) and Phase 2 (Input Validation & Password Security Hardening) of the Email Registration and Verification architecture. In Phase 2, enforced RFC 5321 email constraints with disposable domain filtering, unicode homograph rejection, and SQL/XSS pattern defense. Implemented comprehensive password policy rules (8+ chars, 72-byte bcrypt truncation defense, 4-class complexity with NIST-aligned 16+ char passphrase exemption, email local-part exclusion, breached password blocklist), profile sanitization (`full_name` HTML/control-char stripping, E.164/clinic `phone` validation), startup `DUMMY_BCRYPT_HASH` constant-time verification for timing side-channel mitigation, and cryptographically secure token generation/hashing (`VerificationTokenPair`, SHA-256 with `compare_digest`, and JWT `jti`/`type` claims).

## 2. Plan Reference
- **Plan Document**: `docs/feature/email/email_registration_plan.md`
- **Base Commit SHA**: `73b5d873b40eea1abcfed32574aff84834bee07f` (Phase 1: `73a4d40cea6338c531217f2e97630a312b44ff32`)

## 3. Changes
- `backend/app/models/doctor.py`: Added `email_verified`, `email_verified_at`, `failed_login_attempts`, `locked_until`, and `email_verification_tokens` relationship (Phase 1).
- `backend/app/models/verification_token.py`: Created `EmailVerificationToken` model with SHA-256 token hash storage, expiration, and multi-purpose support (`email_verification`, `password_reset`) (Phase 1).
- `backend/app/models/__init__.py`: Exported `EmailVerificationToken` to standard package exports (Phase 1).
- `backend/alembic/env.py`: Ensured all domain models (`app.models`) are imported so Alembic captures all metadata (Phase 1).
- `backend/alembic/versions/010_add_email_verification_and_security.py`: Alembic migration adding doctor columns, backfilling existing active accounts to verified, and creating the tokens table with indexes (Phase 1).
- `backend/app/schemas/auth.py`: Implemented RFC-compliant `validate_email_id` (length bounds <=254 chars, local-part <=64, disposable domain blocking, homograph/XSS/SQL rejection), `validate_password_strength` (8-72 bytes, 4-class complexity or 16+ char passphrase, breached password blocklist, email local-part correlation check), `sanitize_full_name`, and `sanitize_phone` (Phase 2).
- `backend/app/core/security.py`: Added pre-computed `DUMMY_BCRYPT_HASH`, `VerificationTokenPair`, `generate_verification_token` (6-digit OTP + 32-byte URL-safe token), `hash_token` (SHA-256 hex digest), `verify_token_hash` (`secrets.compare_digest`), and added `jti` and `type: "access"` claims to `create_access_token` (Phase 2).
- `backend/app/services/auth_service.py`: Enforced defensive password strength and profile field validation in `register_email`; integrated `verify_password(password, DUMMY_BCRYPT_HASH)` on unknown user and Google-only logins to eliminate timing enumeration side-channels (Phase 2).
- `backend/tests/test_email_verification_models.py`: Unit and integration test suite validating schema definitions, relationship cascades, and Alembic upgrade/downgrade migration cycles (Phase 1).
- `backend/tests/test_auth_phase2.py`: Comprehensive test suite (14 tests) covering email RFC edge cases, password policy boundaries, profile sanitization, crypto helpers, timing mitigation, and API registration validation (Phase 2).

## 4. Decisions
- **Decision**: Enforced ASCII-only email validation to eliminate Unicode homograph spoofing attacks.
  - *Reasoning*: Healthcare platforms require deterministic identity resolution. Rejecting non-ASCII characters prevents homoglyphs (e.g., Cyrillic 'о' vs Latin 'o') without complex IDN/Punycode risks.
  - *Alternatives considered*: Converting homoglyphs via unidecode or Punycode. Rejected because it can introduce ambiguous domain mappings.
  - *Consequences*: Strict, unambiguous email addresses across the platform.
- **Decision**: Passphrase exemption rule: passwords >= 16 characters bypass the 4-class complexity requirement.
  - *Reasoning*: Aligns with NIST SP 800-63B guidelines; high-length passphrases provide superior entropy over shorter artificially complex passwords while improving user experience.
  - *Alternatives considered*: Mandating uppercase/lowercase/digit/special characters unconditionally. Rejected as it discourages multi-word passphrases.
  - *Consequences*: Users can choose either complex 8-15 character passwords or 16+ character passphrases.
- **Decision**: 72-byte UTF-8 cap on passwords before hashing.
  - *Reasoning*: Bcrypt silently truncates passwords after 72 bytes. Validating `len(password.encode("utf-8")) <= 72` prevents false security assumptions and DoS via oversized bcrypt inputs.
  - *Alternatives considered*: Pre-hashing with SHA-256 before bcrypt. Rejected to preserve compatibility with existing database hashes.
  - *Consequences*: Rejects passwords exceeding 72 bytes (including multi-byte emoji combinations) with a clear 422 error.
- **Decision**: Pre-computed startup `DUMMY_BCRYPT_HASH` for constant-time login verification.
  - *Reasoning*: Executing `verify_password(password, DUMMY_BCRYPT_HASH)` when an email does not exist ensures login latency remains ~100ms regardless of account existence, neutralizing timing side-channels.
  - *Alternatives considered*: Returning immediately with 401 on missing email. Rejected because the ~1ms vs ~100ms discrepancy allows email enumeration.
  - *Consequences*: Uniform response times across all failed authentication attempts.
- **Decision**: Used `NamedTuple` `VerificationTokenPair(otp, token)` for verification token generation.
  - *Reasoning*: Allows seamless tuple unpacking (`otp, token = generate_verification_token()`) while supporting named property access (`res.otp`, `res.token`).
  - *Alternatives considered*: Plain dictionary or raw tuple. Rejected for lower type-safety and ergonomics.
  - *Consequences*: Intuitive, strongly typed token generation.

## 5. Deviations from Plan
None. Phase 2 was executed exactly according to specifications in `docs/feature/email/email_registration_plan.md`.

## 6. Assumptions
- Passwords are encrypted exclusively with bcrypt (`$2b$`) in new flows, with backward compatibility for legacy hashes preserved.
- Profile fields (`full_name`, `phone`) remain optional on registration schemas to maintain API backwards compatibility, but when provided are strictly sanitized.

## 7. Verification Results

### Baseline Comparison
- **Phase 0 baseline suite**: 156 tests passed, 0 failures (`pytest`, exit code 0).
- **Post-Phase 2 full suite**: 170 tests passed, 0 failures (`pytest`, exit code 0).
- **Regressions**: None (14 new tests added and passing).

### Verification Scenarios
| Scenario | Type | Command / Actions | Expected | Observed | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Email RFC & Boundary Cases** | `AGENT_EXECUTABLE` | `pytest tests/test_auth_phase2.py::test_validate_email_id_valid_cases` & `::test_validate_email_id_rejections` | Accepts standard/subdomain/+tag emails; rejects >254 chars, local-part >64, consecutive dots, leading/trailing dots, unicode homographs, control/null chars, SQL/XSS, non-strings, disposable domains | All valid accepted and normalized; all attacks and boundaries rejected with clear errors | Exit code 0, `PASSED` | `PASS` |
| **Password Policy Boundaries** | `AGENT_EXECUTABLE` | `pytest tests/test_auth_phase2.py::test_validate_password_strength_valid` & `::test_validate_password_strength_rejections` | Accepts 8+ chars complex & 16+ char passphrases; rejects <8 chars, >72 bytes (UTF-8 emojis), missing classes, common breached passwords, email local-part matches | Correctly validates valid passwords and rejects violations with descriptive error messages | Exit code 0, `PASSED` | `PASS` |
| **Profile Field Sanitization** | `AGENT_EXECUTABLE` | `pytest tests/test_auth_phase2.py::test_sanitize_full_name` & `::test_sanitize_phone` | Strips script/style tags & contents, HTML tags, control chars; validates 2-120 chars; validates E.164 and clinic phone patterns <=25 chars | HTML and control characters stripped; invalid lengths and phone patterns rejected | Exit code 0, `PASSED` | `PASS` |
| **Token Generation & Constant-Time Crypto** | `AGENT_EXECUTABLE` | `pytest tests/test_auth_phase2.py::test_token_generation_and_hashing` & `::test_dummy_bcrypt_hash_constant_time` | Generates 6-digit OTP and URL-safe token; SHA-256 hash length 64 hex; `verify_token_hash` uses `compare_digest`; `DUMMY_BCRYPT_HASH` starts with `$2b$` | High-entropy tokens generated, deterministic SHA-256 hashes verified, dummy bcrypt constant-time confirmed | Exit code 0, `PASSED` | `PASS` |
| **JWT Access Token Claims** | `AGENT_EXECUTABLE` | `pytest tests/test_auth_phase2.py::test_jwt_access_token_claims` | JWT contains `sub`, `exp`, `iat`, `jti` (UUID), and `type: "access"` | Decoded payload includes valid UUID `jti` and `type == "access"` | Exit code 0, `PASSED` | `PASS` |
| **Timing Side-Channel Neutralization** | `AGENT_EXECUTABLE` | `pytest tests/test_auth_phase2.py::test_auth_service_login_calls_dummy_hash_on_missing_user` & `::test_auth_service_login_calls_dummy_hash_for_google_account` | `login_email` invokes `verify_password(password, DUMMY_BCRYPT_HASH)` on non-existent doctor and Google-only doctor | `verify_password` mock confirmed called with `DUMMY_BCRYPT_HASH` on unknown and Google logins | Exit code 0, `PASSED` | `PASS` |
| **Live Server Runtime Validation - Weak Password** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/register` with password `"weak"` | HTTP 422 Unprocessable Entity with password length error | HTTP 422: `"Value error, Password must be at least 8 characters long."` | Exit code 0, HTTP 422 | `PASS` |
| **Live Server Runtime Validation - Email in Password** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/register` with email prefix in password | HTTP 422 Unprocessable Entity with email correlation error | HTTP 422: `"Value error, Password must not contain parts of your email address."` | Exit code 0, HTTP 422 | `PASS` |
| **Live Server Runtime Validation - Disposable Email** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/register` with `spamdoc@mailinator.com` | HTTP 422 Unprocessable Entity with disposable email error | HTTP 422: `"Value error, Disposable or temporary email addresses are not allowed."` | Exit code 0, HTTP 422 | `PASS` |
| **Live Server Runtime Validation - Invalid Phone** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/register` with phone `"invalid-phone"` | HTTP 422 Unprocessable Entity with phone format error | HTTP 422: `"Value error, Invalid phone number format."` | Exit code 0, HTTP 422 | `PASS` |
| **Live Server Runtime Validation - Success & Sanitization** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/register` with `<b>Dr. Phase Two</b>` | HTTP 201 Created; full_name sanitized to `"Dr. Phase Two"`; JWT contains `jti` and `type: "access"` | HTTP 201 Created; full_name stripped; JWT decoded and verified | Exit code 0, HTTP 201 | `PASS` |
| **Live Server Runtime Validation - Login** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/login` with created credentials | HTTP 200 OK with access token | HTTP 200 OK; access token returned | Exit code 0, HTTP 200 | `PASS` |
| **Live Server Runtime Validation - Nonexistent Account Login** | `AGENT_EXECUTABLE` | `curl -X POST http://localhost:8000/api/v1/auth/login` with non-existent email | HTTP 401 Unauthorized with generic error message | HTTP 401: `{"detail":"Invalid email or password"}` | Exit code 0, HTTP 401 | `PASS` |
| **Full Regression Suite** | `AGENT_EXECUTABLE` | `pytest` | All 170 tests pass without error or regression | 170 passed, 11 warnings in 87.50s | Exit code 0, 170 passed | `PASS` |

**Final Phase 2 Verdict**: `VERIFIED`

## 8. Manual Steps Pending
None.

## 9. Known Issues and Follow-ups
- Phase 3: Transactional Registration, Concurrency & Verification Service (`backend/app/services/email_service.py`, `backend/app/services/auth_service.py`, verification and resend endpoints).
- Phase 4: Frontend Registration UX (`components/auth/EmailAuthForm.tsx`, `lib/api.ts`).

## 10. Rollback
- Revert commit: `git revert <commit-sha>`
- Data implications: No database migration or table modifications in Phase 2; pure schema and security hardening rollback without data loss.

