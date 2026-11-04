# Railway & Production Restoration Report

**Date:** November 4, 2026  
**Target Services:** `https://gosmartclinic.com` (Frontend on Vercel) & `https://api.gosmartclinic.com` (Backend on Railway)  
**Status:** ✅ Fully Restored & Healthy

---

## 1. Executive Summary

Users encountered a persistent **"Failed to fetch"** error when attempting to sign in on `gosmartclinic.com`. Investigation revealed two layers of failure:
1. **Backend Service Down**: The production FastAPI backend on Railway was offline due to an expired trial on the previous Railway account; all prior deployments were purged.
2. **Stale Frontend API Target**: Even after the new backend was brought up, Vercel had baked an obsolete temporary Railway URL (`backend-production-b26c.up.railway.app`) into the client-side JavaScript bundle during an earlier build.

Both issues were systematically diagnosed, migrated, and resolved.

---

## 2. Root Cause Analysis

| Layer | Symptom | Root Cause |
|---|---|---|
| **Railway Backend** | `HTTP 404 {"status":"error","code":404,"message":"Application not found"}` | Account trial expired on Railway; container stopped on Oct 28 and deployments were set to `REMOVED`. |
| **DNS / SSL** | `api.gosmartclinic.com` pointing to old target | Hostinger DNS CNAME was targeting `sdzdjpxg.up.railway.app` (deleted project), failing SSL verification. |
| **Vercel Frontend** | Google Sign-In `Failed to fetch` | Client bundle chunk `925-292fc04a42556f62.js` sent requests to defunct `backend-production-b26c.up.railway.app`. |

---

## 3. Actions Taken

### A. New Railway Project & Backend Deployment
1. **Authenticated** with active Railway credentials.
2. **Created Project:** `doctors-platform-prod` (ID: `798b6084-b5bb-4270-839f-11f1553845da`).
3. **Created Service:** `backend` (ID: `3225df6b-765c-4f59-a313-68ed05826318`).
4. **Injected Environment Variables:**
   - `DATABASE_URL`: Neon PostgreSQL connection pool
   - `CORS_ORIGINS`: `https://gosmartclinic.com,https://www.gosmartclinic.com,https://doctors-platform-eight.vercel.app`
   - `JWT_SECRET_KEY`: Production secret key
   - `EMAIL_BACKEND` & `RESEND_API_KEY`: Resend integration
   - `GOOGLE_CLIENT_ID`: OAuth client credentials
   - `SENTRY_DSN`, `STORAGE_BACKEND`, `PORT=8000`, `ENVIRONMENT=production`
5. **Built & Deployed Container:**
   - Built multi-stage Dockerfile (`python:3.12-slim`).
   - Deployment `d0646fca-1d00-45d8-9fbb-e1afa53459e9` completed with `SUCCESS`.
   - Healthcheck verified: Uvicorn running on `0.0.0.0:8000`.

### B. DNS & SSL Configuration (Hostinger)
Updated existing DNS records under `gosmartclinic.com`:
- **CNAME `api`** updated to: `ma3orblh.up.railway.app`
- **TXT `_railway-verify.api`** updated to: `railway-verify=6b9feb39636febdd438f310bb7e392860ca0f051b1002ba981a2f6dfd77a425c`
- **SSL Status:** Verified ownership and generated valid Let's Encrypt certificate (`CERTIFICATE_STATUS_TYPE_VALID`).

### C. Vercel Frontend Build Repair
1. Discovered `NEXT_PUBLIC_API_URL` and `API_URL` on Vercel were hardcoded to `https://backend-production-b26c.up.railway.app`.
2. Updated both variables in Vercel `production` and `preview` environments to:
   ```
   https://api.gosmartclinic.com
   ```
3. Executed production build and deployment (`vercel --prod --yes`).
4. Verified that new production chunk (`20-bd941e06ffdb5432.js`) correctly communicates with `https://api.gosmartclinic.com`.

### D. Production Branch Alignment
1. Switched local branch from `develop` to `production` (`git checkout production`).
2. Re-deployed backend to Railway from `production` (Deployment: `4168e8bf-6fcc-4206-a49f-3bcb98e6e604` -> `SUCCESS`).
3. Re-deployed frontend to Vercel from `production` (`Ready in 52s` -> Aliased to `gosmartclinic.com`).
4. Both environments now run exclusively on code from branch `production` (`fb147345`).

---

## 4. Verification & Health Status

| Endpoint | Test | Result |
|---|---|---|
| `https://api.gosmartclinic.com/api/v1/health` | HTTP GET | `200 OK` — `{"status":"healthy","service":"doctor-platform-api","environment":"production"}` |
| `https://api.gosmartclinic.com/api/v1/auth/login` | HTTP POST | `401 Unauthorized` (Valid request lifecycle) |
| `https://api.gosmartclinic.com/api/v1/auth/google` | HTTP POST (CORS) | `200 OK` on preflight OPTIONS with origin `gosmartclinic.com` |
| `https://gosmartclinic.com` | Live Frontend | Aliased to production deployment (`Ready in 59s`) |

---

## 5. Maintenance References
- **Railway Project:** `doctors-platform-prod` (Service: `backend`)
- **Direct Service URL (Fallback):** `https://backend-production-72a54.up.railway.app`
- **Production API URL:** `https://api.gosmartclinic.com`

