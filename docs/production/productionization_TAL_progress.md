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
| **Phase 2** | Upload Security, Cloud Storage, Config & Frontend CVEs | ⏳ Pending | Pillow image magic-byte validation & re-encoding (blocking SVG/HTML stored XSS & OOM DoS), path traversal `is_relative_to` fix, `FRONTEND_URL` & Postgres `alembic_version VARCHAR(128)` hardening, dynamic `$PORT`, Next.js CVE upgrade |
| **Phase 3** | Auth Lockout, JWT Revocation, DB Performance & Postgres CI | ⏳ Pending | Password login brute-force lockout, `token_version` JWT revocation on password reset, Google `email_verified` enforcement, `X-Forwarded-For` proxy-depth IP extraction, removal of redundant per-request `SELECT 1`, Ruff cleanup & real PostgreSQL CI testing |
| **Phase 4** | Observability, PHI Privacy, CSP Tightening & Cutover Runbook | ⏳ Pending | Frontend Sentry `instrumentation.ts` & PII scrubbing, production CSP lockdown, clinic-timezone dashboard KPIs, redacted & updated deployment documentation |

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
