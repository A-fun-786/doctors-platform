# Live Deployment (TAL) — Cutover Log, Root Causes & Solutions (`gosmartclinic.com`)

## Objective

This document records the live production health check, pre-cutover diagnostics, database migration, and deployment execution for promoting the **`production` branch (`78ea064`, merged from `origin/develop` `9bd26be`)** of **GoSmartClinic (`Doctors Platform`)** live on **`gosmartclinic.com`** across **Vercel**, **Railway**, and **Neon PostgreSQL**.

Each issue observed during the cutover documents:
1. **Symptom / Problem** observed in the live environment.
2. **Root Cause & Engineering Rationale**.
3. **Solution Applied**.
4. **Post-Cutover Verification**.

---

## Live Production Topology

| Layer | Provider / Resource | Live Endpoint / Identifier | Status After Cutover |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel (`doctor-platform1/doctors-platform`) | `https://gosmartclinic.com`, `https://www.gosmartclinic.com` (`dpl_DM88gYdDqaSrhN7WCTZvxtBQLLGB`) | ✅ **READY / HTTP 200** |
| **Backend API** | Railway (`doctors-platform-prod` / service `backend`) | `https://api.gosmartclinic.com`, `https://backend-production-72a54.up.railway.app` (`81df6c16-3b44-4a63-9df8-93e40dfd75b6`) | ✅ **SUCCESS / HTTP 200** |
| **Database** | Neon Serverless PostgreSQL (`neondb`) | `ep-cool-dream-b433f1sa.c-6.us-east-2.aws.neon.tech` | ✅ **Connected / Alembic `013` (head)** |
| **DNS** | Hostinger NS (`cosmos.dns-parking.com`, `nova.dns-parking.com`) | `A @ -> 76.76.21.21`, `CNAME www -> cname.vercel-dns.com.`, `CNAME api -> ma3orblh.up.railway.app.` | ✅ **Active** |

---

## Issues Identified, Root Causes & Solutions Applied

### 1. Stale Live Production Builds (19-Day Deployment Drift)
- **Symptom / Problem:**
  - Before cutover, `https://gosmartclinic.com` served Vercel deployment `dpl_4aZYpXi1HvveupzmmHMTK8PaBTcp` (created `2026-11-04`), and Railway `backend` ran deployment `4168e8bf-6fcc-4206-a49f-3bcb98e6e604` (created `2026-11-04T18:24:06Z`).
  - Live `Content-Security-Policy` headers on `https://gosmartclinic.com` still permitted `'unsafe-eval'`, `https://*.railway.app`, `http://127.0.0.1:8000`, and `http://localhost:8000`, confirming Phases 1–4 productionization commits (`78ea064`, `2026-11-23`) were not live.
- **Root Cause & Rationale:**
  - Neither Vercel nor Railway was auto-deploying pushes to `production`, leaving live users on builds 19 days behind the repository.
- **Solution Applied:**
  - Deployed `backend/` directly to Railway (`doctors-platform-prod` / `backend`):
    ```bash
    railway up ./backend --path-as-root --service backend --detach --json -m "Deploy production branch 78ea064"
    ```
  - Deployed the root Next.js `15.5.29` application to Vercel Production:
    ```bash
    vercel --prod --archive=tgz --yes
    ```

---

### 2. Neon PostgreSQL Schema Drift (`009` → `013`)
- **Symptom / Problem:**
  - Inspecting the live Neon database before deployment showed `alembic_version = 009_add_working_hours_to_doctor` and only 5 tables (`alembic_version`, `appointments`, `doctors`, `schedules`, `tenants`) with `18` doctors, `3` appointments, and `1` schedule.
  - Migrations `010`–`013` (`email_verification_tokens` table, `doctors.email_verified`, `doctors.email_verified_at`, `doctors.failed_login_attempts`, `doctors.locked_until`, and `doctors.token_version`) were missing.
- **Root Cause & Rationale:**
  - Migrations `010`–`013` were merged on `2026-11-23`, after the last `2026-11-04` deploy. Promoting the new backend code before migrating Neon would break login, JWT `token_version` validation, brute-force lockout, and password reset queries.
  - Because `neonctl` CLI authentication had expired (`invalid_grant`) and `pg_dump` was not installed locally, a direct snapshot via `psycopg` was needed before running DDL.
- **Solution Applied:**
  1. Exported a pre-migration JSON snapshot of `alembic_version`, `tenants`, `doctors`, `schedules`, and `appointments` (`18` doctors, `18` tenants, `1` schedule, `3` appointments) using `backend/.venv/bin/python` + `psycopg`.
  2. Ran Alembic migrations against the live Neon `DATABASE_URL`:
     ```bash
     cd backend && .venv/bin/alembic upgrade head
     ```
     Upgraded cleanly through `010_add_email_verification_and_security` → `011_add_sent_at_to_verification_tokens` → `012_add_password_reset_purpose_support` → `013_add_token_version_to_doctors (head)`.
  3. Verified all `18/18` existing `doctors` rows remained intact with `email_verified = true` (backfilled by migration `010`) and `token_version = 1` (defaulted by migration `013`).

---

### 3. Retired Railway URL (`404 Application not found`) & Unlinked Local CLI
- **Symptom / Problem:**
  - Checking `https://backend-production-b26c.up.railway.app/api/v1/health` (documented in [`docs/production/deployment.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/production/deployment.md#L5)) returned `HTTP 404` (`Application not found`), and `railway status` returned `Project not found`.
- **Root Cause & Rationale:**
  - After account migration to `gosmartclinic.admin@gmail.com`, the active Railway project is `doctors-platform-prod` (`798b6084-b5bb-4270-839f-11f1553845da`), whose active service domain is `backend-production-72a54.up.railway.app` and custom domain is `api.gosmartclinic.com`. The local repository directory was not yet linked to `doctors-platform-prod`.
- **Solution Applied:**
  - Linked the workspace explicitly to the active Railway project/service:
    ```bash
    railway link -p doctors-platform-prod -e production -s backend
    ```
  - Verified the live Vercel JS bundle already targets `https://api.gosmartclinic.com` (`NEXT_PUBLIC_API_URL=https://api.gosmartclinic.com`), and confirmed both `https://api.gosmartclinic.com` and `https://backend-production-72a54.up.railway.app` serve HTTP 200.

---

### 4. Missing Explicit Production Runtime Flags on Railway
- **Symptom / Problem:**
  - Railway service `backend` had `ENVIRONMENT=production`, `DATABASE_URL`, `JWT_SECRET_KEY`, `ALLOW_MOCK_AUTH=false`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, `EMAIL_BACKEND=resend`, `RESEND_API_KEY`, `EMAIL_FROM=noreply@gosmartclinic.com`, `REQUIRE_EMAIL_VERIFICATION=true`, `SENTRY_DSN`, `STORAGE_BACKEND=local`, and `PORT=8000`, but omitted explicit `FRONTEND_URL`, `TRUSTED_PROXY_COUNT`, `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES`, and `ENABLE_ANDROID_APK_BUILDS`.
- **Root Cause & Rationale:**
  - Those settings were introduced during Phases 1–3 productionization. Relying on implicit code defaults/fallbacks works, but setting them explicitly prevents accidental regression if defaults or `CORS_ORIGINS` order ever change.
- **Solution Applied:**
  - Set the variables explicitly on Railway (`--skip-deploys`) before triggering the production container build:
    ```bash
    railway variable set \
      FRONTEND_URL=https://gosmartclinic.com \
      TRUSTED_PROXY_COUNT=1 \
      ENABLE_EXPERIMENTAL_CLINICAL_SERVICES=false \
      ENABLE_ANDROID_APK_BUILDS=false \
      --service backend --skip-deploys --json
    ```

---

### 5. Local ISP DNS CNAME Resolution Quirk vs. Public DNS
- **Symptom / Problem:**
  - `curl` and `dig` from the local machine using the default ISP IPv6 DNS (`2401:4900:...`) resolved `gosmartclinic.com` (`A 76.76.21.21`) but failed host resolution for `www.gosmartclinic.com` and `api.gosmartclinic.com`.
  - Meanwhile, `https://gosmartclinic.com/api/v1/health` (proxied via Vercel Edge) returned HTTP 200.
- **Root Cause & Rationale:**
  - `gosmartclinic.com` uses Hostinger nameservers (`cosmos.dns-parking.com`, `nova.dns-parking.com`) rather than Vercel nameservers, and the local ISP DNS resolver failed recursive CNAME lookup on `cname.vercel-dns.com.` and `ma3orblh.up.railway.app.`. Querying Google Public DNS (`8.8.8.8`) confirmed valid records exist:
    - `gosmartclinic.com.` → `A 76.76.21.21`
    - `www.gosmartclinic.com.` → `CNAME cname.vercel-dns.com.` (`66.33.60.66`, `76.76.21.142`)
    - `api.gosmartclinic.com.` → `CNAME ma3orblh.up.railway.app.` (`153.52.255.81`)
- **Solution Applied:**
  - Verified direct backend and `www` reachability via `curl --resolve api.gosmartclinic.com:443:153.52.255.81` and `--resolve www.gosmartclinic.com:443:76.76.21.142`, as well as through Vercel's server-side proxy on `https://gosmartclinic.com/api/v1/*`.

---

## Deferred / Follow-Up Hardening Items

| Item | Current State | Impact & Recommended Follow-Up |
| :--- | :--- | :--- |
| **Persistent Object Storage** | `STORAGE_BACKEND=local`, `volumeMounts: []` on Railway | Uploaded clinic icons and avatars on Railway are ephemeral and lost on container redeploy. Provision Cloudflare R2 (`STORAGE_BACKEND=s3`, `S3_*`, `NEXT_PUBLIC_STORAGE_DOMAIN`) or attach a Railway Volume at `/app/uploads`. |
| **Frontend Sentry DSN** | `NEXT_PUBLIC_SENTRY_DSN` not set on Vercel | [`sentry.client.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/sentry.client.config.ts) safely skips initialization. Add a frontend Sentry project DSN to Vercel `Production` (`vercel env add NEXT_PUBLIC_SENTRY_DSN production`) and redeploy to enable browser error tracking. |
| **Railway Healthcheck Path** | `healthcheckPath: null` in Railway deploy manifest | Docker `HEALTHCHECK` runs inside the container, and Railway can also probe `/api/v1/health/database` at the platform level if configured in Railway Service Settings. |
| **Neon `-pooler` & PgBouncer** | `DATABASE_URL` uses direct Neon host | Kept intentionally because [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py#L13-L22) uses a bounded pool (`pool_size=3`, `max_overflow=5`) without PgBouncer `prepare_threshold=None`. Switch to `-pooler` only alongside `prepare_threshold=None` if connection count grows. |
| **Dead URL Cleanup** | `backend-production-b26c.up.railway.app` in `next.config.mjs` & `deployment.md` | Harmless in CSP `connect-src`, but can be removed in a future maintenance commit on `develop`. |

---

## Post-Cutover Verification Scorecard

| Check | Target / Command | Observed Result |
| :--- | :--- | :--- |
| **Neon Alembic Revision** | `.venv/bin/alembic current` (against live Neon `DATABASE_URL`) | ✅ `013_add_token_version_to_doctors (head)` |
| **Neon Data Integrity** | `SELECT count(*), ... FROM doctors` | ✅ `18` doctors, `18` verified, `18` with `token_version = 1` |
| **Railway Container Logs** | `railway logs --lines 20` | ✅ `environment="production"`, `log_format="json"`, `sentry_initialized`, Uvicorn listening on `0.0.0.0:8000` |
| **Vercel Proxy API Health** | `GET https://gosmartclinic.com/api/v1/health` | ✅ **HTTP 200** (`environment: "production"`, `sentry_enabled: true`, `rate_limiting_enabled: true`) |
| **Vercel Proxy DB Health** | `GET https://gosmartclinic.com/api/v1/health/database` | ✅ **HTTP 200** (`{"status":"healthy","database":"connected"}`) |
| **Custom API Domain Health** | `GET https://api.gosmartclinic.com/api/v1/health` & `/database` (`--resolve 153.52.255.81`) | ✅ **HTTP 200** (`"database":"connected"`) |
| **Prod Auth & Security Routes** | `POST /api/v1/auth/forgot-password` (`{}`) & `GET /api/v1/builds/nonexistent` | ✅ **HTTP 422** (Pydantic validation active) & **HTTP 404** (unauthenticated build access blocked) |
| **OpenAPI Lockdown** | `GET https://api.gosmartclinic.com/openapi.json` | ✅ **HTTP 404** (disabled in `production`) |
| **Frontend Routes (`gosmartclinic.com`)** | `GET /`, `/login`, `/register`, `/forgot-password`, `/reset-password` | ✅ All **HTTP 200** (`x-vercel-cache: PRERENDER` on `/`) |
| **Phase 4 CSP Header** | `curl -sI https://gosmartclinic.com` | ✅ `'unsafe-eval'`, `https://*.railway.app`, and `localhost:8000` removed; `https://flagcdn.com` present |
| **Git Working Tree** | `git status -sb` | ✅ Clean on `production...origin/production` (`78ea064`) |
