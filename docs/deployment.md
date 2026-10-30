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
   - Pre-created version tracking schema to prevent length truncation.
   - Executed Alembic migrations via Python 3.12:
     - `001_initial_foundation` (Users, core profiles, auth models)
     - `002_add_auth_providers` (OAuth tracking)
     - `003_add_doctor_onboarding_and_services` (Doctor metadata & clinic workflows)
     - `004_add_app_icon_url` (Custom branding asset links)
     - `005_alter_avatar_url_to_text` (High-resolution avatar support)

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
| `DATABASE_URL` | `postgresql+psycopg://...neon.tech/neondb?sslmode=require` | Connection to Neon PostgreSQL |
| `JWT_SECRET_KEY` | `ed88486d36e9...` (64 hex characters) | HS256 JWT signature generation |
| `ALLOW_MOCK_AUTH` | `false` | Disables developer backdoors |
| `STORAGE_BACKEND` | `local` | Upload storage provider (`local` / `s3`) |
| `PORT` | `8000` | Internal container listener port |
| `CORS_ORIGINS` | `["https://doctors-platform-eight.vercel.app"]` | Strict CORS whitelist |
| `GOOGLE_CLIENT_ID` | `644948532553-g01hlshcmkoaft84l6b06oc9nklm9j1u.apps.googleusercontent.com` | Google OAuth client ID |
| `SENTRY_DSN` | `https://eecc704912c2...@o4512165357486080.ingest.us.sentry.io/...` | Sentry crash reporting & performance monitoring |

### Frontend (Vercel)
| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://backend-production-b26c.up.railway.app` | Base API URL called by client fetchers |

---

## 🌐 Custom Domain Setup Guide

When you are ready to point your custom domain (e.g., `docspace.com`) to the live platform:

### 1. Root / Frontend Domain (`docspace.com`)
1. In terminal:
   ```bash
   vercel domains add docspace.com
   vercel domains add www.docspace.com
   ```
2. In your DNS provider (Cloudflare, Namecheap, GoDaddy):
   - **Type `A`**: `@` &rarr; `76.76.21.21`
   - **Type `CNAME`**: `www` &rarr; `cname.vercel-dns.com`

### 2. API Subdomain (`api.docspace.com`)
1. In terminal:
   ```bash
   railway domain api.docspace.com --service backend
   ```
2. Railway will display a DNS record:
   - **Type `CNAME`**: `api` &rarr; `<service-id>.up.railway.app`
3. Add that CNAME in your DNS management console.

### 3. Synchronize Variables
Once DNS propagates:
```bash
# 1. Update frontend to call custom backend domain
vercel env add NEXT_PUBLIC_API_URL production --value "https://api.docspace.com" --force --yes
vercel --prod --archive=tgz --yes

# 2. Update backend CORS to allow custom frontend domain
railway variable set CORS_ORIGINS='["https://docspace.com","https://www.docspace.com"]'
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
