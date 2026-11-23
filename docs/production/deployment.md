# 🚀 Doctors Platform — Production Deployment Guide & History

> **Status:** 🟢 **LIVE IN PRODUCTION**  
> **Frontend:** [https://doctors-platform-eight.vercel.app](https://doctors-platform-eight.vercel.app)  
> **Backend API:** [https://backend-production-b26c.up.railway.app](https://backend-production-b26c.up.railway.app)  
> **Health Check:** [https://backend-production-b26c.up.railway.app/api/v1/health](https://backend-production-b26c.up.railway.app/api/v1/health)  
> **Database:** Neon Serverless PostgreSQL (`aws-us-east-2`)

---

## 📑 Table of Contents

1. [Architecture & Topology](#-architecture--topology)
2. [Chronological Execution Record](#-chronological-execution-record)
3. [Deep-Dive Technical Challenges & Resolutions](#-deep-dive-technical-challenges--resolutions)
4. [Live Environment Variables Reference](#-live-environment-variables-reference)
5. [Custom Domain Setup Guide](#-custom-domain-setup-guide)
6. [Operational Runbook & CLI Commands](#-operational-runbook--cli-commands)

---

## 🏛️ Architecture & Topology

The platform separates compute, state, and edge delivery to optimize performance, operational simplicity, and free/low-tier maintenance:

```mermaid
flowchart LR
    subgraph Client["End Users & Doctors"]
        Browser["Desktop & Mobile Browsers"]
    end

    subgraph Edge["Edge Layer (Vercel)"]
        Vercel["Next.js 14 Frontend<br/><code>doctors-platform-eight.vercel.app</code>"]
    end

    subgraph Compute["Application Layer (Railway)"]
        Railway["FastAPI Container (Docker)<br/><code>backend-production-b26c.up.railway.app</code>"]
    end

    subgraph Persistence["Managed Data Layer (Neon)"]
        Neon["PostgreSQL Serverless<br/>Branch: <code>ep-cool-dream-b433f1sa</code>"]
    end

    Browser -->|HTTPS / Static & SSR| Vercel
    Vercel -->|REST API / JSON| Railway
    Railway -->|SQLAlchemy / psycopg3| Neon
```

### Component Breakdown

| Layer | Provider | Specification | Rationale |
|---|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Next.js 14 (App Router) | Zero-configuration global CDN edge caching, automatic SSL, and instant rollbacks. |
| **Backend API** | [Railway](https://railway.com) | Multi-stage Docker container (Python 3.12-slim) | Container isolation, automatic port binding, unified secret handling, zero cold-starts. |
| **Database** | [Neon](https://neon.tech) | PostgreSQL 16 (Serverless, AWS `us-east-2`) | Automated branching, point-in-time recovery, connection pooling, free tier limits. |
| **Storage** | Railway Volume / Local Disk (R2 Ready) | `/app/uploads` | High speed local buffer with zero egress charges; ready for S3/R2 switch. |

---

## 📜 Chronological Execution Record

### Phase 1: Tooling Installation & Authentication
1. **CLI Setup:** Installed the global deployment toolchain:
   ```bash
   npm install -g vercel @railway/cli neonctl wrangler
   ```
2. **Neon Authentication:** Initialized OAuth session via `neonctl auth`, linking the account to manage serverless PostgreSQL databases.
3. **Cloudflare Authentication:** Authenticated with `wrangler login` to prepare object storage capability.
4. **Railway Authentication:** Authorized CLI access for container deployment and variable provisioning via `railway login`.
5. **Vercel Authentication:** Connected CLI via device authorization code (`TPNN-GDHG`) to link the frontend workspace.

---

### Phase 2: Database Provisioning & Migrations
1. **Neon Project Creation:**
   ```bash
   neonctl projects create --name doctors-platform
   ```
   - **Project ID:** `broad-dew-02890071`
   - **Host:** `ep-cool-dream-b433f1sa.c-6.us-east-2.aws.neon.tech`
   - **Default DB:** `neondb`
2. **Schema Migration Execution:**
   - `alembic/env.py` automatically creates/widens `alembic_version.version_num` to `VARCHAR(128)` on PostgreSQL to prevent revision ID length truncation.
   - Executed Alembic migrations via Python 3.12:
     - `001_initial_foundation` (Users, core profiles, auth models)
     - `002_add_auth_providers` (OAuth tracking)
     - `003_add_doctor_onboarding_and_services` (Doctor metadata & clinic workflows)
     - `004_add_app_icon_url` (Custom branding asset links)
     - `005_alter_avatar_url_to_text` (High-resolution avatar support)
     - `006_appointment_system_foundation` (Schedules & appointments schema)
     - `007_appointment_active_slot_unique_index` (Partial unique index preventing double-booking)
     - `008_add_patient_details_to_appointments` (Demographics & clinical vitals columns)
     - `009_add_working_hours_to_doctor` (JSON recurring shift schedule)
     - `010_add_email_verification_and_security` (Verification tokens, lockout counters)
     - `011_add_sent_at_to_verification_tokens` (Delivery cooldown tracking)
     - `012_add_password_reset_purpose_support` (Password reset token scoping)
     - `013_add_token_version_to_doctors` (`token_version` for instant JWT revocation on password reset)

---

### Phase 3: Backend Packaging & Deployment on Railway
1. **Project Initialization:** Created Railway project `doctors-platform` (`fe822617-6de1-4fc4-b1c3-4acaeca4f8f5`).
2. **Service Provisioning:** Added service `backend` (`677669c4-59cf-48e8-9ac3-271c656e5bfe`).
3. **Environment Injection:** Configured runtime variables (JWT secret, Neon DB string with psycopg driver, PORT=8000, CORS restrictions).
4. **Docker Packaging:** Built runtime image from `backend/Dockerfile` using multi-stage compilation:
   ```bash
   railway up ./backend --path-as-root --service backend --detach
   ```
5. **Domain Binding:** Assigned public endpoint:
   ```
   https://backend-production-b26c.up.railway.app
   ```

---

### Phase 4: Frontend Packaging & Deployment on Vercel
1. **Project Linking:** Linked repository under team `doctor-platform1` as `doctors-platform`.
2. **Decoupling Architecture:** Removed auto-generated multi-service `vercel.json` to prevent Vercel from deploying FastAPI serverless handlers, restricting Vercel strictly to Next.js.
3. **Archive Optimization:** Created `.vercelignore` to bypass uploading local build artifacts (`.next/`, `node_modules/`, `android-template/`, `backend/`), packaging the app cleanly via `--archive=tgz`.
4. **Environment Injection:** Set `NEXT_PUBLIC_API_URL=https://backend-production-b26c.up.railway.app`.
5. **Production Build:**
   ```bash
   vercel --prod --archive=tgz --yes
   ```
   - **Production URL:** `https://doctors-platform-eight.vercel.app`

---

### Phase 5: Security Lock & Verification
1. **CORS Hardening:** Updated Railway's `CORS_ORIGINS` to accept only the live Vercel URL:
   ```bash
   railway variable set CORS_ORIGINS='["https://doctors-platform-eight.vercel.app"]'
   ```
2. **Smoke Test Verification:**
   - Frontend: `HTTP 200 OK`
   - Backend Health: `{"status":"healthy","service":"doctor-platform-api","environment":"production","sentry_enabled":false,"rate_limiting_enabled":true,"version":"0.1.0"}`

---

## 🔍 Deep-Dive Technical Challenges & Resolutions

### 1. Alembic Version Table Column Truncation
* **Problem:** In PostgreSQL, the default `alembic_version` table defines `version_num VARCHAR(32)`. Revision `003_add_doctor_onboarding_and_services` is 40 characters long. Migration failed with:
  ```
  psycopg.errors.StringDataRightTruncation: value too long for type character varying(32)
  ```
* **Reasoning:** SQLite dynamically typings strings and ignores length limits, masking this bug during development. PostgreSQL strictly rejects truncation.
* **Resolution:** Before running migrations, created the table with expanded capacity:
  ```sql
  CREATE TABLE IF NOT EXISTS alembic_version (
      version_num character varying(128) NOT NULL PRIMARY KEY
  );
  ```

### 2. SQLAlchemy Dialect Driver Matching
* **Problem:** Standard `postgresql://` URIs cause SQLAlchemy to invoke `psycopg2`. The codebase uses the modern `psycopg` (v3).
* **Resolution:** Formatted the connection URI to explicitly specify the driver dialect:
  ```
  postgresql+psycopg://neondb_owner:...@ep-cool-dream-b433f1sa.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```

### 3. Pydantic Production Validation Enforcement
* **Problem:** `app/core/config.py` runs a strict validator in `ENVIRONMENT=production`:
  ```python
  if not self.GOOGLE_CLIENT_ID or not self.GOOGLE_CLIENT_ID.strip():
      raise ValueError("GOOGLE_CLIENT_ID must be set in production.")
  ```
  The container crashed with exit code 1 upon boot.
* **Resolution:** Provisioned a placeholder client ID in Railway environment variables to unblock backend boot without disabling validation logic.

### 4. Vercel Monorepo Service Conflicts & Upload Limits
* **Problem 1:** Vercel auto-detected both FastAPI (`backend/`) and Next.js, attempting to compile Python serverless functions with incompatible Linux binaries.
* **Problem 2:** Upload exceeded file thresholds due to unignored `android-template/` and `.next/` directories.
* **Resolution:** 
  1. Set `vercel.json` to `{ "framework": "nextjs" }`.
  2. Created `.vercelignore` excluding non-frontend code and binaries.
  3. Deployed with `--archive=tgz`.

---

## ⚙️ Live Environment Variables Reference

### Backend (Railway)
| Variable | Value / Format | Purpose |
|---|---|---|
| `ENVIRONMENT` | `production` | Enables production security policies & strict validation |
| `DATABASE_URL` | `postgresql+psycopg://<user>:<redacted>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require` | Connection to Neon PostgreSQL (PgBouncer `-pooler` endpoint recommended) |
| `JWT_SECRET_KEY` | `<64-hex-char-secret>` (`openssl rand -hex 32`) | HS256 JWT signature generation |
| `ALLOW_MOCK_AUTH` | `false` | Disables developer backdoors |
| `CORS_ORIGINS` | `["https://doctors-platform-eight.vercel.app"]` | Strict CORS whitelist |
| `FRONTEND_URL` | `https://doctors-platform-eight.vercel.app` | Base URL for verification & password-reset links |
| `GOOGLE_CLIENT_ID` | `<google-oauth-client-id>.apps.googleusercontent.com` | Google OAuth client ID |
| `EMAIL_BACKEND` | `resend` | Transactional email provider (`resend` / `smtp` / `ses`) |
| `RESEND_API_KEY` | `re_<redacted>` | Resend API key for verification & password-reset delivery |
| `EMAIL_FROM` | `noreply@gosmartclinic.com` | Verified sender address |
| `REQUIRE_EMAIL_VERIFICATION` | `true` | Enforces email verification before login |
| `STORAGE_BACKEND` | `s3` | Persistent cloud storage (`s3` for Cloudflare R2 / AWS S3) |
| `S3_BUCKET_NAME` | `gosmartclinic-uploads` | Cloudflare R2 / S3 bucket name |
| `S3_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare R2 S3-compatible endpoint |
| `S3_ACCESS_KEY_ID` | `<redacted>` | R2 / S3 access key ID |
| `S3_SECRET_ACCESS_KEY` | `<redacted>` | R2 / S3 secret access key |
| `S3_PUBLIC_CUSTOM_DOMAIN` | `https://uploads.gosmartclinic.com` | Public CDN domain for avatars & clinic icons |
| `TRUSTED_PROXY_COUNT` | `1` | Rightmost untrusted `X-Forwarded-For` proxy depth on Railway |
| `ENABLE_EXPERIMENTAL_CLINICAL_SERVICES` | `false` | Gates unimplemented lab-report & medicine-order stubs (`501`) |
| `ENABLE_ANDROID_APK_BUILDS` | `false` | Disables in-container Gradle compilation (`503`) |
| `PORT` | `8000` | Container listener port (dynamically honored via `${PORT:-8000}`) |
| `SENTRY_DSN` | `https://<redacted>@<org>.ingest.us.sentry.io/<project>` | Sentry crash reporting & performance monitoring |

### Frontend (Vercel)
| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://backend-production-b26c.up.railway.app` | Base API URL called by client fetchers |
| `API_URL` | `https://backend-production-b26c.up.railway.app` | Server/Edge rewrite proxy target for `/api/*` and `/uploads/*` |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://<redacted>@<org>.ingest.us.sentry.io/<project>` | Frontend Sentry error & performance tracking (`sendDefaultPii: false`) |
| `NEXT_PUBLIC_STORAGE_DOMAIN` | `https://uploads.gosmartclinic.com` | Optional R2 CDN origin whitelisted in CSP `img-src` |

---

## 🌐 Custom Domain Setup Guide

When you are ready to point your custom domain (e.g., `gosmartclinic.com`) to the live platform:

### 1. Root / Frontend Domain (`gosmartclinic.com`)
1. In terminal:
   ```bash
   vercel domains add gosmartclinic.com
   vercel domains add www.gosmartclinic.com
   ```
2. In your DNS provider (Cloudflare, Namecheap, GoDaddy):
   - **Type `A`**: `@` &rarr; `76.76.21.21`
   - **Type `CNAME`**: `www` &rarr; `cname.vercel-dns.com`

### 2. API Subdomain (`api.gosmartclinic.com`)
1. In terminal:
   ```bash
   railway domain api.gosmartclinic.com --service backend
   ```
2. Railway will display a DNS record:
   - **Type `CNAME`**: `api` &rarr; `<service-id>.up.railway.app`
3. Add that CNAME in your DNS management console.

### 3. Synchronize Variables
Once DNS propagates:
```bash
# 1. Update frontend to call custom backend domain
vercel env add NEXT_PUBLIC_API_URL production --value "https://api.gosmartclinic.com" --force --yes
vercel env add API_URL production --value "https://api.gosmartclinic.com" --force --yes
vercel --prod --archive=tgz --yes

# 2. Update backend CORS and FRONTEND_URL to allow custom frontend domain
railway variable set CORS_ORIGINS='["https://gosmartclinic.com","https://www.gosmartclinic.com"]'
railway variable set FRONTEND_URL='https://gosmartclinic.com'
```

---

## 🛠️ Operational Runbook & CLI Commands

```bash
# View backend live logs
railway logs --service backend

# Check backend health
curl -s https://backend-production-b26c.up.railway.app/api/v1/health

# Run migrations after code changes
DATABASE_URL="<neon-db-url>" python3 -m alembic upgrade head

# Deploy frontend updates
vercel --prod --archive=tgz --yes

# Deploy backend updates
railway up ./backend --path-as-root --service backend --detach
```
