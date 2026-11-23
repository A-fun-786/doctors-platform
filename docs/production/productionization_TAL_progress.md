# Productionization (TAL) — Progress & Detailed Engineering Log

## Objective

This document tracks the final production-readiness hardening of the **Doctors Platform (`GoSmartClinic`)** on `develop` prior to promoting the release to `main` across **Vercel (Frontend)**, **Railway (FastAPI Backend Container)**, **Neon (Serverless PostgreSQL 16)**, and **Cloudflare R2 (S3-Compatible Object Storage)**.

Each phase documents:
1. **What problem or production risk existed** (Symptom).
2. **Why the change was required** (Root Cause & Engineering Rationale).
3. **Exactly what was changed** across backend, schemas, frontend, and tests.
4. **How the change was verified**.

---

## Progress Tracker

| Phase | Focus Area | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Core Product Completeness & Safe Feature Boundaries | ✅ Completed | Real public patient appointment booking (`POST /api/v1/public/tenants/{slug}/appointments`), feature-flag gating for non-persistent clinical stubs (`ENABLE_EXPERIMENTAL_CLINICAL_SERVICES`), Android APK builder server lockdown (`ENABLE_ANDROID_APK_BUILDS`) & cross-tenant IDOR fix |
| **Phase 2** | Upload Security, Cloud Storage, Config & Frontend CVEs | ✅ Completed | Pillow image magic-byte validation & re-encoding (blocking SVG/HTML stored XSS & OOM DoS), path traversal `is_relative_to` fix, `FRONTEND_URL` & Postgres `alembic_version VARCHAR(128)` hardening, dynamic `$PORT`, Next.js `15.5.29` & PostCSS `8.5.23` CVE upgrade (`0` vulnerabilities) |
| **Phase 3** | Auth Lockout, JWT Revocation, DB Performance & Postgres CI | ✅ Completed | Password login brute-force lockout, `token_version` JWT revocation on password reset (Migration `013`), Google `email_verified` enforcement, `X-Forwarded-For` proxy-depth IP extraction (`TRUSTED_PROXY_COUNT`), removal of redundant per-request `SELECT 1`, health error scrubbing, Ruff cleanup (`0` errors) & real PostgreSQL CI testing |
| **Phase 4** | Observability, PHI Privacy, CSP Tightening & Cutover Runbook | ✅ Completed | Next.js `instrumentation.ts` Sentry registration & PII scrubbing (`beforeSend` + `logger.ts`), production CSP lockdown (`next.config.mjs`), clinic-timezone (`Asia/Kolkata`) & server-side `total` KPI counts in `OverviewTab.tsx`, secret redaction & updated production variables runbook in `docs/production/deployment.md` |

---

## Detailed Log of Completed Changes

### Phase 1: Core Product Completeness & Safe Feature Boundaries

#### 1. Real Persisted Public Patient Appointment Booking (`P0-1`)
- **Files:**
  - [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py)
  - [`backend/app/schemas/profile.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/profile.py)
  - [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts)
  - [`components/public-booking/AppointmentBookingForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/public-booking/AppointmentBookingForm.tsx)
- **Symptom / Problem:**
  - Patients visiting a doctor's public booking portal (`/{slug}` or `/dr/{slug}`) could view available 30-minute time slots (`GET /api/v1/public/tenants/{slug}/available-slots`) and fill out the appointment form, but clicking **Confirm Booking** always failed with `HTTP 404 Not Found`.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - During an earlier refactor of the appointment system, the legacy mock stub `POST /api/v1/public/tenants/{slug}/appointments` was deleted from the backend while the authenticated doctor endpoint `POST /api/v1/doctor/appointments` was introduced. However, the public patient booking form (`AppointmentBookingForm.tsx`) still called `bookPublicAppointment()` targeting `/api/v1/public/tenants/{slug}/appointments`.
  - Because public patients are unauthenticated visitors, they cannot call `/api/v1/doctor/appointments`. Without a dedicated public booking route wired to the real appointment engine, the primary patient-facing workflow of the platform was non-functional.
- **What Was Changed:**
  - **Backend Route (`backend/app/api/routes/public.py`):**
    - Implemented `POST /api/v1/public/tenants/{slug}/appointments` (`book_public_appointment`), rate-limited via `@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)` (`20/minute`).
    - Enforced tenant service toggle checks: verifies `tenant.service_video_consultation` when `appointment_type == "video_consultation"` and `tenant.service_appointment` for in-clinic bookings, returning `HTTP 400` if the service is disabled.
    - Added `_parse_slot_times()` helper that accepts structured 24-hour `start_time`/`end_time` (`HH:MM`) as well as 12-hour display labels (`10:00 AM`) or time ranges (`10:00 - 10:30`), defaulting to a 30-minute slot duration and validating `end_time > start_time`.
    - Added `Idempotency-Key` request header caching (`public_idempotency:{doctor_id}:{key}`) via `get_idempotency_result()` / `set_idempotency_result()` so accidental double-taps or network retries return the existing booking instead of throwing a conflict error.
    - Delegated persistence to `appointment_service.create_appointment()` so public bookings obey the exact same business rules as doctor-created bookings: recurring working hours, custom schedule overrides, leave/holiday/block exclusions, past-date and elapsed-time rejection, and PostgreSQL partial unique slot index protection (`HTTP 409 Conflict` if the slot is already booked).
    - Invalidated the doctor's public slot cache (`invalidate_slot_cache(tenant.doctor.id)`) immediately after booking so subsequent visitors no longer see the taken slot.
  - **Schema (`backend/app/schemas/profile.py`):**
    - Extended `AppointmentBookingRequest` with optional `patient_email`, `start_time`, `end_time`, and `staff_id` fields, and added `appointment_id` to `AppointmentBookingResponse`.
  - **Frontend (`lib/api.ts` & `components/public-booking/AppointmentBookingForm.tsx`):**
    - Removed the `@deprecated` notice on `bookPublicAppointment()`, added optional `idempotencyKey` header support (`Idempotency-Key`), and updated `AppointmentBookingForm.tsx` to resolve the selected `AvailableSlot`'s exact `start` and `end` times and pass a deterministic idempotency key (`{slug}:{date}:{start}:{phone}`).

---

#### 2. Feature-Flag Gating for Non-Persistent Clinical Stubs (`P0-2`)
- **Files:**
  - [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py)
  - [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py)
- **Symptom / Problem:**
  - `POST /api/v1/public/tenants/{slug}/reports` and `POST /api/v1/public/tenants/{slug}/medicine-orders` accepted patient lab report metadata and prescription delivery orders and returned `201 Created` with fabricated confirmation IDs (`REP-XXXXXXXX` and `MED-XXXXXXXX`), without saving anything to PostgreSQL or cloud storage.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - In a healthcare application, returning a fake confirmation ID when a patient submits a medical lab report or orders prescription medication causes **silent clinical data loss**: the patient believes their doctor or pharmacy received the submission, while the clinic has zero record of it.
  - Until full database persistence, file storage, and doctor dashboard review views are built for lab reports and pharmacy orders, these experimental endpoints must be safely gated off in production.
- **What Was Changed:**
  - Added `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES: bool = False` to `Settings` in [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py#L90).
  - Updated `GET /api/v1/public/tenants/{slug}` in [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py#L60-L81) so `services.medicine_inventory` and `services.lab_reports` evaluate to `False` on public patient portals unless both the tenant's toggle and `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES` are `True`. This automatically hides the unimplemented tabs on the public UI.
  - Guarded `POST /api/v1/public/tenants/{slug}/reports` and `POST /api/v1/public/tenants/{slug}/medicine-orders` so that if a tenant has the service enabled in the DB but `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES` is `False`, the API rejects the request with `HTTP 501 Not Implemented` instead of returning a fake confirmation ID.

---

#### 3. Android APK Builder Lockdown & Cross-Tenant IDOR Fix (`P0-6`)
- **Files:**
  - [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py)
  - [`backend/app/services/app_build_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/app_build_service.py)
  - [`backend/app/api/routes/app_build.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/app_build.py)
  - [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts)
  - [`components/dashboard/AndroidAppTab.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/dashboard/AndroidAppTab.tsx)
- **Symptom / Problem:**
  1. **Broken & Resource-Hazardous in Production Container:** `POST /api/v1/doctor/app/build` spawned an unbounded daemon thread running `./gradlew assembleRelease`. However, the production Docker image (`python:3.12-slim` built from `./backend`) does not contain a Java JDK, Android SDK, or the root `android-template/` folder, causing builds to fail or exhaust container memory if triggered.
  2. **Cross-Tenant IDOR (Insecure Direct Object Reference):** `GET /api/v1/doctor/app/build/{task_id}/status` and `GET /api/v1/doctor/app/build/{task_id}/logs` required authentication (`get_current_doctor`), but **never checked whether `task_id` belonged to `current_doctor`**. Any authenticated doctor could query another doctor's build status and full compilation logs.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - Multi-tenant healthcare SaaS platforms must enforce strict tenant isolation on every resource lookup, including background task statuses and logs.
  - Furthermore, heavy Android Gradle compilation does not belong inside a synchronous web API container and should be feature-flagged off (`ENABLE_ANDROID_APK_BUILDS=False`) until offloaded to a dedicated CI/build worker, while still allowing doctors to preview branding and upload custom app icons.
- **What Was Changed:**
  - Added `ENABLE_ANDROID_APK_BUILDS: bool = False` to `Settings` in [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py#L91).
  - Updated `trigger_app_build()` in [`backend/app/services/app_build_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/app_build_service.py#L301-L314) to record `"doctor_id": str(doctor.id)` inside `_BUILD_TASKS[build_id]`.
  - Added `_verify_task_ownership(task_id, current_doctor)` in [`backend/app/api/routes/app_build.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/app_build.py#L28-L52) and enforced it on both `GET /build/{task_id}/status` and `GET /build/{task_id}/logs`, returning `HTTP 404 Not Found` if another doctor attempts to inspect a task they do not own.
  - Guarded `POST /api/v1/doctor/app/build` with `@limiter.limit("3/hour")` and an `ENABLE_ANDROID_APK_BUILDS` check (returning `HTTP 503 Service Unavailable` when disabled), and exposed `builds_enabled` in `GET /api/v1/doctor/app/preview`.
  - Updated [`components/dashboard/AndroidAppTab.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/dashboard/AndroidAppTab.tsx#L340-L388) to disable the build button and show a clear informational notice when `builds_enabled === false`.

---

#### 4. Automated Test Suite Updates & Verification (Phase 1)
- **Files:**
  - [`backend/tests/profile/test_profile_and_public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/profile/test_profile_and_public.py)
  - [`backend/tests/appointments/test_appointment_lifecycle.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/appointments/test_appointment_lifecycle.py)
  - [`backend/tests/app_build/test_app_build.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/app_build/test_app_build.py)
- **Verification Executed:**
  - Verified public appointment creation (`201 Created`), database persistence in `appointments`, `Idempotency-Key` handling, and duplicate slot rejection (`409 Conflict`).
  - Verified `/reports` and `/medicine-orders` return `501 Not Implemented` by default and `201 Created` when `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES=True`.
  - Verified `/doctor/app/build` returns `503 Service Unavailable` by default and verified cross-tenant IDOR protection (`404 Not Found` when Doctor B queries Doctor A's `task_id` on `/status` or `/logs`).
  - Full backend test suite: `227 passed` (`0 failed`).
  - Ruff linter on all Phase 1 files: `All checks passed!`.
  - Frontend TypeScript (`npx tsc --noEmit`) & ESLint (`npm run lint`): `0 errors`.

---

### Phase 2: Upload Security, Cloud Storage, Config Hardening & Frontend CVE Remediation

#### 1. Hardening Image Uploads Against Stored XSS & OOM DoS (`P0-4`)
- **Files:**
  - [`backend/app/core/uploads.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/uploads.py) *(New)*
  - [`backend/requirements.txt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/requirements.txt)
  - [`backend/app/api/routes/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/doctor.py)
  - [`backend/app/api/routes/app_build.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/app_build.py)
  - [`backend/app/schemas/profile.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/profile.py)
- **Symptom / Problem:**
  1. **Stored Cross-Site Scripting (XSS) & Session Hijacking:** Both `POST /api/v1/doctor/avatar` and `POST /api/v1/doctor/app/icon` validated uploads solely with `file.content_type.startswith("image/")` and preserved the user-supplied filename extension via `Path(file.filename).suffix`. An attacker could upload an SVG containing `<script>` (`image/svg+xml`) or an `.html` file with a spoofed `Content-Type: image/png` header. Because `/uploads/*` is proxied onto the same Vercel frontend origin (`next.config.mjs`) where doctor JWT tokens are stored in `localStorage`, opening the uploaded URL executed arbitrary JavaScript in the application origin and allowed full JWT session theft.
  2. **Out-of-Memory (OOM) Denial of Service:** Upload routes read the entire request stream into memory (`file_content.read()`) without any file size limit or decompression-bomb protection.
  3. **Unvalidated Asset URL Schemes:** `PUT /api/v1/doctor/profile` accepted arbitrary strings for `avatar_url` and `app_icon_url` (including `javascript:` URIs).
- **Why This Change Was Needed (Root Cause & Rationale):**
  - Client-supplied `Content-Type` headers and filenames are untrusted user input and must never be used to determine storage extensions or file safety.
  - Re-encoding images through `Pillow` after verifying binary headers guarantees that only genuine raster pixels (PNG, JPEG, WebP) reach storage, stripping any embedded scripts, polyglot payloads, or EXIF metadata.
- **What Was Changed:**
  - Added `pillow>=10.4.0,<12.0.0` to [`backend/requirements.txt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/requirements.txt).
  - Created [`backend/app/core/uploads.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/uploads.py) implementing `validate_and_sanitize_image()`:
    - Streams uploads in 64 KB chunks and aborts immediately with `HTTP 413 Content Too Large` if the payload exceeds 2 MB.
    - Restricts MIME types to `image/png`, `image/jpeg`, `image/jpg`, and `image/webp` (explicitly blocking `image/svg+xml`).
    - Sets `Image.MAX_IMAGE_PIXELS = 4096 * 4096`, runs `img.verify()` + dimension checks (`<= 2048x2048`), and re-encodes the image into a fresh byte buffer with a deterministic extension (`.png`, `.jpg`, or `.webp`) while discarding the original filename.
  - Wired `upload_doctor_avatar` (`doctor.py`) and `upload_app_icon` (`app_build.py`) through `validate_and_sanitize_image()`.
  - Added `@field_validator("avatar_url", "app_icon_url")` on `DoctorProfileUpdateRequest` in [`backend/app/schemas/profile.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/profile.py#L49-L63) permitting only `https://`, `http://`, or root-relative `/path` URLs and rejecting `javascript:` / protocol-relative `//` URLs with `HTTP 422`.

---

#### 2. LocalStorage Path Traversal Prefix Fix (`P1-5`)
- **File:** [`backend/app/core/storage.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/storage.py#L55-L60)
- **Symptom / Problem:**
  - `LocalStorage._resolve_safe_path()` checked `if not str(target).startswith(str(self.base_dir)):`.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - String prefix comparison (`startswith`) on directory paths without a trailing path separator is vulnerable to sibling-directory prefix bypasses: if `base_dir` is `/app/uploads`, a path resolving to `/app/uploads_evil/payload.txt` starts with `"/app/uploads"` and bypasses the check.
- **What Was Changed:**
  - Replaced `str(target).startswith(str(self.base_dir))` with `target.is_relative_to(self.base_dir)`, which performs strict path-component boundary verification.

---

#### 3. Production `FRONTEND_URL`, SMTP, Alembic `VARCHAR(128)` & Dynamic `$PORT` Hardening (`P0-3`, `P1-4`)
- **Files:**
  - [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py)
  - [`backend/alembic/env.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/env.py)
  - [`backend/Dockerfile`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/Dockerfile)
- **Symptom / Problem:**
  1. `FRONTEND_URL` defaulted to `http://localhost:3000` with no production validator check. If omitted on Railway, email verification and password reset emails sent to real doctors contained broken `http://localhost:3000` links.
  2. Seven Alembic migration revision IDs in `backend/alembic/versions/` are 33–40 characters long (e.g., `007_appointment_active_slot_unique_index` is 40 chars), exceeding Alembic's default PostgreSQL `alembic_version.version_num VARCHAR(32)` column and causing `StringDataRightTruncation` on fresh or un-widened PostgreSQL databases.
  3. `backend/Dockerfile` hardcoded `--port 8000` in exec-form `CMD` and `http://127.0.0.1:8000` in `HEALTHCHECK`, ignoring Railway's dynamically injected `$PORT` environment variable if `PORT` was changed from 8000.
- **What Was Changed:**
  - **Config Validation (`backend/app/core/config.py`):**
    - In `ENVIRONMENT=production`, if `FRONTEND_URL` is explicitly set to `localhost` or `127.0.0.1`, startup fails with `ValueError`. If `FRONTEND_URL` was omitted in env vars, it now automatically derives from the first non-local production origin in `CORS_ORIGINS` (e.g., `https://doctors-platform-eight.vercel.app`).
    - Added production validation rejecting `localhost` / empty `SMTP_HOST` when `EMAIL_BACKEND="smtp"`.
  - **Automatic PostgreSQL `alembic_version` Widening (`backend/alembic/env.py`):**
    - In `run_migrations_online()`, when `connection.dialect.name == "postgresql"`, Alembic now idempotently creates/alters `alembic_version.version_num` to `VARCHAR(128)` before running migrations.
  - **Dynamic `$PORT` Container Support (`backend/Dockerfile`):**
    - Updated `CMD` to `["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]` and updated `HEALTHCHECK` to read `os.environ.get('PORT', '8000')`.

---

#### 4. Frontend Dependency Upgrade to Remediate Critical & High CVEs (`P0-7`)
- **Files:**
  - [`package.json`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/package.json)
  - [`package-lock.json`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/package-lock.json)
  - [`tsconfig.json`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/tsconfig.json)
- **Symptom / Problem:**
  - `npm audit --omit=dev` reported **8 production vulnerabilities (1 critical, 2 high, 5 moderate)** across `next@14.2.24`, `postcss <=8.5.22`, `source-map-js`, `brace-expansion`, `glob`, and `minimatch`.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - `next@14.2.24` was affected by multiple critical and high advisories (including rewrite request smuggling, Server Components/Actions DoS, cache poisoning, and Image Optimizer DoS/SSRF). Upgrading to the patched Next.js 15.5 LTS backport line (`15.5.29`) resolves all Next.js advisories while maintaining full React 18 compatibility.
- **What Was Changed:**
  - Upgraded `next` and `eslint-config-next` from `14.2.24` to `^15.5.29`.
  - Upgraded `postcss` to `^8.5.23` and added `"overrides": { "postcss": "^8.5.23" }` in `package.json` so Next.js's nested PostCSS dependency also resolves to `8.5.23`.
  - Ran `npm audit fix` to patch remaining transitive packages (`brace-expansion`, `source-map-js`, `glob`, `minimatch`).
- **Verification Executed:**
  - `npm audit --omit=dev` and full `npm audit`: **`found 0 vulnerabilities`** (down from 8 prod / 15 total vulnerabilities).
  - Phase 2 backend security & config tests (`tests/core/test_storage_and_containers.py`, `tests/core/test_health_and_models.py`): `16 passed, 0 failed`.
  - Frontend ESLint (`npm run lint`), TypeScript (`npx tsc --noEmit`), unit tests (`npm test`), and production build (`npm run build`): all passed with `0 errors`.

---

### Phase 3: Authentication Hardening, Rate-Limit Proxy Integrity, DB Performance & PostgreSQL CI

#### 1. Account Lockout, JWT Session Revocation (`token_version`) & Google OAuth Email Verification (`P1-1`, `P1-2`)
- **Files:**
  - [`backend/alembic/versions/013_add_token_version_to_doctors.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/013_add_token_version_to_doctors.py) *(New)*
  - [`backend/app/models/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py)
  - [`backend/app/core/security.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/security.py)
  - [`backend/app/api/deps.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/deps.py)
  - [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py)
- **Symptom / Problem:**
  1. **Missing Password Login Lockout:** Although the `doctors` table had `failed_login_attempts` and `locked_until` columns (used in OTP verification and password reset), `login_email()` never checked `locked_until` and never incremented `failed_login_attempts`. An attacker rotating IPs across a botnet could brute-force a doctor's password indefinitely.
  2. **No JWT Session Revocation After Password Reset:** Platform JWT access tokens have a 24-hour lifetime (`ACCESS_TOKEN_EXPIRE_MINUTES = 1440`). When a doctor reset a compromised password via `/api/v1/auth/reset-password`, existing stolen JWT tokens remained valid for up to 24 hours because `get_current_doctor()` only checked `Doctor.is_active`.
  3. **Unchecked `email_verified` Claim in Google OAuth:** `authenticate_google()` linked incoming Google Sign-In tokens to existing email/password doctor accounts by matching `email` without verifying `id_info.get("email_verified") is True`.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - IP-based rate limiting alone (`5/minute` in SlowAPI) cannot stop distributed credential-stuffing attacks that rotate source IPs; per-account lockout (`failed_login_attempts` / `locked_until`) is mandatory defense-in-depth.
  - Embedding a monotonically increasing `token_version` (`"tv"`) inside the JWT payload and validating it in `get_current_doctor()` allows instant, stateless-friendly session revocation whenever a doctor resets their password, without requiring a separate token blacklist lookup.
  - Verifying `id_info.get("email_verified")` prevents account takeover via unverified workspace alias emails.
- **What Was Changed:**
  - Created Alembic migration [`013_add_token_version_to_doctors.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/013_add_token_version_to_doctors.py) adding `token_version INTEGER NOT NULL DEFAULT 1` to `doctors` and mapped `Doctor.token_version` in [`backend/app/models/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py#L101-L106).
  - Updated `create_access_token()` in [`backend/app/core/security.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/security.py#L139-L161) to embed `"tv": int(token_version or 1)` in every JWT and updated `get_current_doctor()` in [`backend/app/api/deps.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/deps.py#L31-L55) to reject any token whose `"tv"` claim does not match `doctor.token_version`.
  - Updated `reset_password()` in [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py#L1065-L1072) to increment `doctor.token_version += 1`, immediately invalidating all pre-existing JWTs.
  - Updated `login_email()` in [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py#L455-L505) to enforce `doctor.locked_until > now` (`HTTP 403`), increment `failed_login_attempts` on invalid passwords, lock the account for 15 minutes after 5 consecutive failures, and reset the counter to `0` upon successful login.
  - Updated `authenticate_google()` in [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py#L98-L102) to reject tokens where `id_info.get("email_verified")` is falsy (`HTTP 400`).

---

#### 2. `X-Forwarded-For` Anti-Spoofing (`TRUSTED_PROXY_COUNT`) & Redis Rate-Limit Readiness (`P1-1`)
- **Files:**
  - [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py)
  - [`backend/app/core/rate_limit.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/rate_limit.py)
- **Symptom / Problem:**
  - `get_client_ip()` unconditionally extracted `forwarded_for.split(",")[0].strip()` (the **leftmost** hop in `X-Forwarded-For`). Because `backend/Dockerfile` runs Uvicorn behind Railway's edge proxy, an attacker could send a fabricated `X-Forwarded-For: <random-ip>` header on every request, causing `hops[0]` to be the attacker's spoofed IP and completely bypassing SlowAPI rate limits.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - Reverse proxies append the connecting client IP to the **end** of `X-Forwarded-For`. When running behind $N$ trusted proxies (`TRUSTED_PROXY_COUNT = 1` on Railway), the authentic client IP observed by the edge proxy is `hops[-TRUSTED_PROXY_COUNT]`, while any entries to the left of that index are untrusted client-supplied values.
- **What Was Changed:**
  - Added `TRUSTED_PROXY_COUNT: int = 0` (automatically defaulting to `1` when `ENVIRONMENT == "production"`) and `REDIS_URL: str = ""` to `Settings` in [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py#L52-L53).
  - Updated `get_client_ip()` in [`backend/app/core/rate_limit.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/rate_limit.py#L12-L33) to select `hops[max(0, len(hops) - trusted_count)]` whenever `TRUSTED_PROXY_COUNT > 0`.
  - Configured SlowAPI `Limiter` in [`backend/app/core/rate_limit.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/rate_limit.py#L40-L44) to use `settings.REDIS_URL` when provided (falling back to `"memory://"` for single-worker deployments).

---

#### 3. Database Per-Request Latency Optimization & Health Endpoint Error Sanitization (`P1-4`, `P1-5`)
- **Files:**
  - [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py)
  - [`backend/app/api/routes/health.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/health.py)
- **Symptom / Problem:**
  1. `create_session_with_retry()` executed `session.execute(text("SELECT 1"))` on **every single API request**, even though the SQLAlchemy engine already enabled `pool_pre_ping=True`. Because the production database is remote Serverless Neon PostgreSQL (`aws-us-east-2`), this redundant query added an unnecessary network round-trip to every API call.
  2. `GET /api/v1/health/database` included `"error": str(exc)` in its unauthenticated `HTTP 503` response body when the database was unreachable, potentially exposing internal PostgreSQL hostnames, connection parameters, or driver details to public callers.
- **What Was Changed:**
  - Removed the redundant `session.execute(text("SELECT 1"))` from `create_session_with_retry()` in [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py#L40-L42), relying on SQLAlchemy's built-in `pool_pre_ping=True`.
  - Removed `"error": str(exc)` from the public `HTTP 503` payload in [`backend/app/api/routes/health.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/health.py#L36-L45) while preserving structured server-side error logging (`logger.error("database_health_check_failed", error=str(exc))`).

---

#### 4. Backend Lint Remediation & Real PostgreSQL CI Pipeline Hardening (`P1-3`)
- **Files:**
  - [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py)
  - [`backend/app/api/routes/schedule.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/schedule.py)
  - [`backend/tests/conftest.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/conftest.py)
  - [`.github/workflows/ci.yml`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/.github/workflows/ci.yml)
- **Symptom / Problem:**
  1. `ruff check backend/` was failing with **12 lint errors** (7× `E711` `== None` SQLAlchemy comparisons, 3× `F401` unused imports, 2× `F841` unused exception variables), breaking the `backend-checks` job in GitHub Actions.
  2. Even though `.github/workflows/ci.yml` provisioned a `postgres:16-alpine` service container, `backend/tests/conftest.py` hardcoded `TEST_DATABASE_URL = "sqlite:///:memory:"` and `Base.metadata.create_all()`. As a result, the PostgreSQL container in CI was never used and `alembic upgrade head` was never tested in CI.
  3. `pip-audit` and `npm audit` in `.github/workflows/ci.yml` appended `|| true`, silently ignoring dependency vulnerabilities, and `frontend-checks` did not run `npx tsc --noEmit` or `npm test`.
- **What Was Changed:**
  - Fixed all remaining Ruff lint errors across `auth_service.py`, `schedule.py`, and `public.py` (`ruff check .` now reports `All checks passed!`).
  - Updated [`backend/tests/conftest.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/conftest.py#L18-L28) to read `os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")` and configure `StaticPool` only for SQLite, allowing CI to run the entire pytest suite against live PostgreSQL 16.
  - Updated [`.github/workflows/ci.yml`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/.github/workflows/ci.yml#L54-L115) to:
    - Run `alembic upgrade head` against `postgres:16-alpine` before pytest.
    - Pass `TEST_DATABASE_URL` pointing to `postgres:16-alpine` during pytest execution.
    - Enforce blocking `pip-audit` and `npm audit --omit=dev --audit-level=high` (removing `|| true`).
    - Run `npx tsc --noEmit` and `npm test` in `frontend-checks`.
- **Verification Executed:**
  - `cd backend && .venv/bin/ruff check .`: **`All checks passed!`** (`0 errors`).
  - Full backend pytest suite (including new lockout, Google `email_verified`, `token_version` revocation, migration `013`, `TRUSTED_PROXY_COUNT` anti-spoofing, and health error scrubbing tests): **`230 passed, 0 failed`**.

---

### Phase 4: Observability, PHI Privacy, Production CSP Lockdown, Dashboard KPI Accuracy & Cutover Runbook

#### 1. Next.js App Router Sentry `instrumentation.ts` & PHI/PII Scrubbing (`P1-6`, `P2-1`)
- **Files:**
  - [`instrumentation.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/instrumentation.ts) *(New)*
  - [`sentry.client.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.client.config.ts)
  - [`sentry.server.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.server.config.ts)
  - [`sentry.edge.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.edge.config.ts)
  - [`lib/logger.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/logger.ts)
- **Symptom / Problem:**
  1. Next.js 15 App Router requires a root `instrumentation.ts` hook (`register()` and `onRequestError`) for `@sentry/nextjs` v11 to initialize server/edge telemetry and capture unhandled server request errors.
  2. While the backend Sentry setup (`backend/app/core/sentry.py`) enforced `send_default_pii=False` for HIPAA/PHI privacy, `lib/logger.ts` attached `email: context.email` to `sentryClient.setUser(...)` and the frontend Sentry config files omitted `sendDefaultPii: false`.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - Healthcare platforms should never leak personally identifiable information (email addresses, IP headers, or cookies) to third-party crash reporting pipelines. Opaque identifiers (`id: userId` and `username: tenantSlug`) provide full debugging traceability without transmitting PII.
- **What Was Changed:**
  - Created [`instrumentation.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/instrumentation.ts) registering `sentry.server.config` and `sentry.edge.config` and exporting `onRequestError = Sentry.captureRequestError`.
  - Added a `beforeSend` PII scrubber (`delete event.user.email; delete event.user.ip_address;`) to [`sentry.client.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.client.config.ts), [`sentry.server.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.server.config.ts), and [`sentry.edge.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.edge.config.ts).
  - Removed `email: context.email` from `sentryClient.setUser(...)` in [`lib/logger.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/logger.ts#L163-L173).

---

#### 2. Production Content Security Policy (CSP) Lockdown (`P2-2`)
- **File:** [`next.config.mjs`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/next.config.mjs)
- **Symptom / Problem:**
  - `next.config.mjs` included `'unsafe-eval'` in `script-src` and `https://*.railway.app http://127.0.0.1:8000 http://localhost:8000` in `connect-src` unconditionally, even in production builds.
- **Why This Change Was Needed (Root Cause & Rationale):**
  - Allowing `unsafe-eval`, wildcard `*.railway.app` tenants, and `localhost` origins in a production CSP weakens browser protections against script injection and data exfiltration to arbitrary Railway subdomains.
- **What Was Changed:**
  - Updated [`next.config.mjs`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/next.config.mjs#L1-L91) so that when `NODE_ENV === "production"`:
    - `'unsafe-eval'` is excluded from `script-src`.
    - `https://*.railway.app`, `http://127.0.0.1:8000`, and `http://localhost:8000` are excluded from `connect-src` (whitelisting only the exact `NEXT_PUBLIC_API_URL`, custom `gosmartclinic.com` domains, Google OAuth, and Sentry).
    - Added optional `NEXT_PUBLIC_STORAGE_DOMAIN` support to `img-src` for Cloudflare R2 custom CDN domains.

---

#### 3. Clinic-Timezone Date & Server-Side KPI Counts on Dashboard Overview (`P2-3`)
- **File:** [`components/dashboard/OverviewTab.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/dashboard/OverviewTab.tsx#L44-L82)
- **Symptom / Problem:**
  1. `OverviewTab.tsx` computed `todayStr` using `new Date().toISOString().split("T")[0]` (UTC). Because the platform operates in `Asia/Kolkata` (`UTC+05:30`), between 00:00 and 05:30 IST `todayStr` resolved to yesterday's date, showing the wrong day's appointments on the doctor's dashboard.
  2. Total Booked and Completed KPI cards were calculated by fetching `getDoctorAppointments({ page_size: 100 })` (page 1 only) and filtering `items` in browser memory, capping KPI counts at 100 appointments for busy clinics.
- **What Was Changed:**
  - Formatted `todayStr` using `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())` to match the backend's `CLINIC_TIMEZONE`.
  - Replaced the single un-filtered page-1 fetch with lightweight status-filtered queries (`getDoctorAppointments({ status: "BOOKED", page_size: 1 })` and `getDoctorAppointments({ status: "COMPLETED", page_size: 1 })`) and read the exact PostgreSQL `total` count from the response.

---

#### 4. Production Deployment Guide Redaction & Cutover Reference (`P2-4`)
- **File:** [`docs/production/deployment.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/production/deployment.md)
- **Symptom / Problem:**
  - `docs/production/deployment.md` only documented Alembic migrations `001`–`005`, omitted required production environment variables (`EMAIL_BACKEND`, `RESEND_API_KEY`, `FRONTEND_URL`, `STORAGE_BACKEND=s3` + R2 variables, `TRUSTED_PROXY_COUNT`), exposed partial secret prefixes/DSNs, and referenced legacy `docspace.com` custom domains.
- **What Was Changed:**
  - Documented all 13 Alembic migrations (`001`–`013`) and automatic PostgreSQL `alembic_version VARCHAR(128)` handling.
  - Updated the Railway and Vercel Environment Variables Reference tables with the complete production configuration (Resend, Cloudflare R2, Neon `-pooler`, feature flags, `TRUSTED_PROXY_COUNT=1`, and `NEXT_PUBLIC_SENTRY_DSN`), redacted partial secrets, and standardized custom domain examples to `gosmartclinic.com`.

---

## Automated Verification Scorecard (All Phases 1–4)

| Suite / Tool | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Alembic Migration Chain (`001` → `013`)** | `alembic upgrade head` (clean DB) | ✅ **PASSED** | All 6 tables (`alembic_version`, `appointments`, `doctors`, `email_verification_tokens`, `schedules`, `tenants`) and `token_version` created cleanly |
| **Backend Pytest Suite** | `cd backend && .venv/bin/python -m pytest tests/ -q` | ✅ **230 passed, 0 failed** | Covers auth, lockout, `token_version` revocation, uploads, public booking, slot conflicts, storage, proxy headers, and health checks |
| **Backend Ruff Linter** | `cd backend && .venv/bin/ruff check .` | ✅ **0 errors** | Down from 12 lint errors to 0 (`All checks passed!`) |
| **Frontend NPM Security Audit** | `npm audit --omit=dev` | ✅ **0 vulnerabilities** | Down from 8 production (`1 critical, 2 high, 5 moderate`) / 15 total vulnerabilities to 0 |
| **Frontend TypeScript Check** | `npx tsc --noEmit` | ✅ **0 errors** | Strict type verification across Next.js `15.5.29` & Sentry configs |
| **Frontend ESLint** | `npm run lint` | ✅ **0 warnings / 0 errors** | Clean `eslint-config-next@15.5.29` verification |
| **Frontend Unit & Hardening Suites** | `npm test` | ✅ **67/67 passed (100%)** | Calendar Utilities (`32/32`), No-Demo-Fallback (`11/11`), Sidebar Theme (`10/10`), Onboarding Hardening (`24/24`) |
| **Frontend Production Build** | `npm run build` | ✅ **PASSED (4.7s)** | Next.js `15.5.29` standalone production bundle & all 12 routes compiled |

---

## Developer Manual Testing Guide (End-to-End Test Cases)

### Prerequisites — Start Local Stack
```bash
# Terminal 1: Start FastAPI Backend (port 8000)
cd backend
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2: Start Next.js Frontend (port 3000)
npm run dev
```
*(For live production smoke testing, replace `http://127.0.0.1:8000` with `https://backend-production-b26c.up.railway.app` and `http://localhost:3000` with `https://doctors-platform-eight.vercel.app`.)*

---

### TC-01: Public Patient Appointment Booking, Idempotency & Double-Booking Prevention (`Phase 1 / P0-1`)
- **Objective:** Verify that an unauthenticated patient can book an available slot on a doctor's public portal, network retries with the same `Idempotency-Key` do not fail, and a second patient cannot double-book the same slot.
- **Browser UI Steps:**
  1. Open `http://localhost:3000/<doctor-slug>` (or `/dr/<doctor-slug>`).
  2. Select a future weekday (Monday–Saturday) and click an available 30-minute time slot (e.g., `10:00 AM`).
  3. Enter Patient Name (`Rahul Sharma`), Phone (`+91 9876543210`), Email (`rahul@example.com`), and Notes, then click **Confirm Appointment**.
  4. **Expected UI Result:** Booking confirmation screen displays a `Booking Reference` (`APT-XXXXXXXX`). Refreshing the available slots for that date no longer lists `10:00 AM`, and the appointment appears immediately on the doctor's **Dashboard → Calendar** and **Overview** tabs.
- **CLI `curl` Verification:**
  ```bash
  # 1. Book a slot (Expected: HTTP 201 Created with booking_id "APT-...")
  curl -i -X POST "http://127.0.0.1:8000/api/v1/public/tenants/<doctor-slug>/appointments" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: manual-test-key-001" \
    -d '{
      "patient_name": "Rahul Sharma",
      "patient_email": "rahul@example.com",
      "patient_phone": "+919876543210",
      "appointment_date": "2026-12-01",
      "appointment_time": "10:00 AM",
      "start_time": "10:00",
      "end_time": "10:30",
      "appointment_type": "in_clinic",
      "notes": "First consultation"
    }'

  # 2. Replay exact same request with same Idempotency-Key (Expected: HTTP 201 returning identical booking_id)
  curl -i -X POST "http://127.0.0.1:8000/api/v1/public/tenants/<doctor-slug>/appointments" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: manual-test-key-001" \
    -d '{
      "patient_name": "Rahul Sharma",
      "patient_phone": "+919876543210",
      "appointment_date": "2026-12-01",
      "appointment_time": "10:00 AM",
      "appointment_type": "in_clinic"
    }'

  # 3. Attempt to book the same slot without the idempotency key (Expected: HTTP 409 Conflict "Slot already booked")
  curl -i -X POST "http://127.0.0.1:8000/api/v1/public/tenants/<doctor-slug>/appointments" \
    -H "Content-Type: application/json" \
    -d '{
      "patient_name": "Second Patient",
      "patient_phone": "+919999988888",
      "appointment_date": "2026-12-01",
      "appointment_time": "10:00 AM",
      "appointment_type": "in_clinic"
    }'
  ```

---

### TC-02: Feature-Flag Gating of Non-Persistent Lab Reports & Medicine Orders (`Phase 1 / P0-2`)
- **Objective:** Verify that unimplemented lab report and medicine order endpoints cannot silently discard patient submissions when `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES=false` (default).
- **Steps & Expected Results:**
  ```bash
  # 1. Check public profile services (Expected: medicine_inventory: false, lab_reports: false)
  curl -s "http://127.0.0.1:8000/api/v1/public/tenants/<doctor-slug>" | jq .services

  # 2. Direct POST to /reports or /medicine-orders (Expected: HTTP 400 if disabled on tenant, or HTTP 501 Not Implemented if enabled on tenant)
  curl -i -X POST "http://127.0.0.1:8000/api/v1/public/tenants/<doctor-slug>/reports" \
    -H "Content-Type: application/json" \
    -d '{"patient_name":"Test","patient_phone":"1234567890","report_type":"Blood","file_name":"a.pdf"}'
  ```

---

### TC-03: Android APK Builder Lockdown & Cross-Tenant IDOR Protection (`Phase 1 / P0-6`)
- **Objective:** Confirm in-container APK builds are disabled (`503`) by default and that Doctor B cannot view Doctor A's build status or logs (`404`).
- **Browser UI Steps:**
  1. Log into the Doctor Dashboard (`http://localhost:3000/dashboard`) and open the **Android App** tab.
  2. **Expected UI Result:** The build button displays **"Builds Disabled on Server"** (disabled state) and a notice banner explains that on-demand compilation is disabled in the web container while custom branding/icon uploads remain active.
- **CLI `curl` Verification:**
  ```bash
  # 1. Preview endpoint reports builds_enabled: false
  curl -s "http://127.0.0.1:8000/api/v1/doctor/app/preview" \
    -H "Authorization: Bearer <DOCTOR_A_JWT>" | jq .builds_enabled

  # 2. Triggering a build returns HTTP 503 Service Unavailable
  curl -i -X POST "http://127.0.0.1:8000/api/v1/doctor/app/build" \
    -H "Authorization: Bearer <DOCTOR_A_JWT>"

  # 3. Querying another doctor's task_id with Doctor B's JWT returns HTTP 404 Not Found
  curl -i "http://127.0.0.1:8000/api/v1/doctor/app/build/<DOCTOR_A_TASK_ID>/status" \
    -H "Authorization: Bearer <DOCTOR_B_JWT>"
  ```

---

### TC-04: Image Upload Security — Stored XSS (SVG/HTML), Oversize DoS & URL Scheme Validation (`Phase 2 / P0-4`)
- **Objective:** Verify that avatar and app icon uploads reject SVG scripts, spoofed MIME types, >2 MB files, and `javascript:` profile URLs while re-encoding valid PNG/JPEG/WebP images.
- **CLI `curl` Verification:**
  ```bash
  # 1. Attempt Stored XSS via SVG upload (Expected: HTTP 400 Bad Request)
  printf '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' > /tmp/xss.svg
  curl -i -X POST "http://127.0.0.1:8000/api/v1/doctor/avatar" \
    -H "Authorization: Bearer <DOCTOR_JWT>" \
    -F "file=@/tmp/xss.svg;type=image/svg+xml"

  # 2. Attempt MIME spoofing: HTML file declared as image/png (Expected: HTTP 400 Bad Request)
  printf '<html><script>alert(1)</script></html>' > /tmp/fake.png
  curl -i -X POST "http://127.0.0.1:8000/api/v1/doctor/app/icon" \
    -H "Authorization: Bearer <DOCTOR_JWT>" \
    -F "file=@/tmp/fake.png;type=image/png"

  # 3. Attempt >2 MB upload (Expected: HTTP 413 Content Too Large)
  dd if=/dev/zero of=/tmp/huge.png bs=1048576 count=3
  curl -i -X POST "http://127.0.0.1:8000/api/v1/doctor/avatar" \
    -H "Authorization: Bearer <DOCTOR_JWT>" \
    -F "file=@/tmp/huge.png;type=image/png"

  # 4. Attempt javascript: URI in profile update (Expected: HTTP 422 Unprocessable Entity)
  curl -i -X PUT "http://127.0.0.1:8000/api/v1/doctor/profile" \
    -H "Authorization: Bearer <DOCTOR_JWT>" \
    -H "Content-Type: application/json" \
    -d '{"avatar_url": "javascript:alert(document.cookie)"}'
  rm -f /tmp/xss.svg /tmp/fake.png /tmp/huge.png
  ```

---

### TC-05: Password Login Brute-Force Lockout (`Phase 3 / P1-1`)
- **Objective:** Verify that 5 consecutive failed password login attempts lock the doctor account for 15 minutes (`HTTP 403 Forbidden`), even if the attacker changes their IP address or enters the correct password on attempt #6.
- **Steps & Expected Results:**
  1. Attempt to log in at `POST /api/v1/auth/login` 5 times with an invalid password for a registered doctor account:
     - Attempts 1–5 return `HTTP 401 Unauthorized` (`"Invalid email or password"`).
  2. On attempt #6 (even from a different IP or after waiting 60 seconds for the IP rate limit window to reset), submit the **correct** password:
     - **Expected Result:** `HTTP 403 Forbidden` with `"Account is temporarily locked due to repeated failed login attempts. Please try again later."`

---

### TC-06: Instant JWT Session Revocation on Password Reset (`Phase 3 / P1-2`)
- **Objective:** Confirm that resetting a doctor's password increments `token_version` and immediately invalidates all previously issued 24-hour JWT tokens.
- **Steps & Expected Results:**
  1. Log in via `POST /api/v1/auth/login` and save the returned `access_token` as `OLD_JWT`.
  2. Confirm `GET /api/v1/auth/me` with `Authorization: Bearer $OLD_JWT` returns `HTTP 200 OK`.
  3. Trigger a password reset via `POST /api/v1/auth/forgot-password` and complete `POST /api/v1/auth/reset-password` with a new password (receiving `NEW_JWT`).
  4. Call `GET /api/v1/auth/me` again with `Authorization: Bearer $OLD_JWT`:
     - **Expected Result:** `HTTP 401 Unauthorized` (`"Could not validate credentials"`).
  5. Call `GET /api/v1/auth/me` with `Authorization: Bearer $NEW_JWT`:
     - **Expected Result:** `HTTP 200 OK`.

---

### TC-07: Health Check Sanitization & Dashboard Clinic-Timezone KPIs (`Phase 3 & 4`)
- **Objective:** Verify `/api/v1/health/database` never leaks raw database exception strings on failure and that Dashboard Overview KPI cards show accurate `Asia/Kolkata` today appointments and total counts.
- **Steps & Expected Results:**
  1. Call `curl -i http://127.0.0.1:8000/api/v1/health/database` → returns `HTTP 200 OK` with `{"status":"healthy","database":"connected"}` (and when DB is unreachable, returns `HTTP 503` containing only `{"detail":{"status":"unhealthy","database":"disconnected"}}` with no `"error"` key).
  2. Open **Dashboard → Overview** (`http://localhost:3000/dashboard`) and inspect the **Network** tab:
     - Confirm 3 parallel requests are fired: `from=<YYYY-MM-DD in IST>&to=<YYYY-MM-DD in IST>&page_size=100`, `status=BOOKED&page_size=1`, and `status=COMPLETED&page_size=1`.
     - Confirm the **Upcoming Booked** and **Completed Visits** KPI cards display the exact `total` counts from the backend response.




