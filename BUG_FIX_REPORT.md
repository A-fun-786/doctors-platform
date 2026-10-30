# 🛠️ Post-Deployment Bug Fix & Hardening Report — Doctors Platform

> **Date:** September 28, 2026  
> **Environment:** Production (`doctors-platform-eight.vercel.app` & `backend-production-b26c.up.railway.app`)  
> **Branch:** `dev-prod`

---

## 📋 Executive Summary

Following initial production rollout on Vercel (Edge Frontend) and Railway (FastAPI Container), end-to-end user journey auditing identified 4 post-deployment operational bugs across authentication, browser security policy enforcement, asset routing, and database payload size. All 4 issues have been diagnosed, remediated with root-cause fixes, verified via live endpoint testing, and pushed to production.

---

## 🔍 Detailed Incident Breakdown

### 1. "Failed to Fetch" Error on Registration & Login

| Attribute | Details |
|---|---|
| **Symptom** | New doctor registrations and logins failed in browser with `TypeError: Failed to fetch`. |
| **Root Cause** | Browser Content Security Policy (CSP) directive violation blocking cross-origin API calls. |
| **Reason** | In Phase 5 security hardening, strict security headers were injected via `next.config.mjs` and `nginx/conf.d/default.conf`. The `connect-src` directive was configured as `'self' https://accounts.google.com https://*.sentry.io`. Because the frontend is hosted on Vercel (`vercel.app`) while the backend runs on Railway (`up.railway.app`), the browser treated API requests as cross-origin and blocked all fetch calls before they could leave the browser. |
| **Measures Taken** | 1. Updated `connect-src` in `next.config.mjs` and `nginx/conf.d/default.conf` to explicitly permit `https://backend-production-b26c.up.railway.app`, `https://*.railway.app`, and local development ports (`http://127.0.0.1:8000`, `http://localhost:8000`).<br/>2. Verified preflight CORS responses (`OPTIONS /api/v1/auth/register`) return `200 OK` with `Access-Control-Allow-Origin: https://doctors-platform-eight.vercel.app`. |
| **Files Modified** | `next.config.mjs`, `nginx/conf.d/default.conf` |

---

### 2. Google Sign-In Inactive on Authentication Forms

| Attribute | Details |
|---|---|
| **Symptom** | Both `/login` and `/register` pages showed a disabled button: `Google Sign-In (Inactive)`. |
| **Root Cause** | Scaffolding placeholder button in `EmailAuthForm.tsx` was never wired to the Google Identity Services (GSI) SDK. |
| **Reason** | Initial implementation created two separate components: `GoogleAuthForm.tsx` (which had full GSI logic) and `EmailAuthForm.tsx` (which had email/password fields and an inactive placeholder button). The routes `/login` and `/register` only rendered `EmailAuthForm.tsx`. Even after credentials were provisioned in Phase 7, the button on the actual user-facing pages remained disabled. |
| **Measures Taken** | 1. Integrated Google Identity Services (`window.google.accounts.id`) directly into `EmailAuthForm.tsx`.<br/>2. Replaced the disabled button with the live Google One-Tap/Sign-In container (`googleButtonRef`).<br/>3. Wired the credential callback to `authenticateWithGoogle()` in `lib/api.ts`, which exchanges tokens with backend `@router.post("/google")` and redirects to `/onboarding` or `/dashboard`.<br/>4. Expanded CSP `script-src` and `frame-src` to permit `https://accounts.google.com` and `https://apis.google.com`. |
| **Files Modified** | `components/auth/EmailAuthForm.tsx`, `next.config.mjs`, `nginx/conf.d/default.conf` |

---

### 3. Broken Asset Rewrite Proxy for Uploaded Files (`/uploads/*`)

| Attribute | Details |
|---|---|
| **Symptom** | Uploaded custom clinic icons and avatars returned `404 Not Found` when accessed via frontend URL `https://doctors-platform-eight.vercel.app/uploads/...`. |
| **Root Cause** | Missing server-side `API_URL` environment variable during Next.js rewrite resolution. |
| **Reason** | `next.config.mjs` defined rewrites mapping `/uploads/:path*` to `${apiUrl}/uploads/:path*`, where `const apiUrl = process.env.API_URL || "http://127.0.0.1:8000"`. On Vercel, only `NEXT_PUBLIC_API_URL` had been provisioned. Because `API_URL` was unset, the proxy rewrite defaulted to `127.0.0.1:8000` (which does not exist inside Vercel's serverless edge environment). |
| **Measures Taken** | 1. Updated `apiUrl` resolution in `next.config.mjs` to prioritize `process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"`.<br/>2. Explicitly provisioned `API_URL=https://backend-production-b26c.up.railway.app` on Vercel production environment via CLI.<br/>3. Verified proxy rewrite passes (`curl https://doctors-platform-eight.vercel.app/uploads/...` returns `200 OK`). |
| **Files Modified** | `next.config.mjs`, Vercel production environment variables |

---

### 4. Database Payload Bloat via Base64 Avatar Data URIs

| Attribute | Details |
|---|---|
| **Symptom** | High database row size and slow profile load times when custom profile photos were uploaded. |
| **Root Cause** | Frontend stored raw `data:image/...;base64,...` strings directly in the PostgreSQL `doctors.avatar_url` column. |
| **Reason** | The backend lacked a dedicated avatar upload endpoint. `dashboard/page.tsx` and `onboarding/page.tsx` read user-selected images via browser `FileReader.readAsDataURL()` and submitted strings up to 2MB directly in the JSON profile update payload (`PUT /api/v1/doctor/profile`). |
| **Measures Taken** | 1. Implemented `@router.post("/avatar")` in `backend/app/api/routes/doctor.py` leveraging the production `BaseStorage` abstraction layer (`get_storage()`).<br/>2. Added `uploadDoctorAvatar(file: File)` multipart client helper in `lib/api.ts`.<br/>3. Refactored `handleAvatarUpload` in `dashboard/page.tsx` and `onboarding/page.tsx` to immediately persist image files to storage upon selection, storing only clean resource URLs (`/uploads/avatars/...`) in the database.<br/>4. Verified image loading from both Railway origin and Vercel proxy. |
| **Files Modified** | `backend/app/api/routes/doctor.py`, `lib/api.ts`, `app/dashboard/page.tsx`, `app/onboarding/page.tsx` |

---

## 📊 Verification Matrix

| Test Case | Method | Pre-Fix Status | Post-Fix Status |
|---|---|---|---|
| User Registration | `POST /api/v1/auth/register` via browser | ❌ `Failed to fetch` | ✅ `201 Created` |
| Google Sign-In Button | Browser UI on `/login` and `/register` | ❌ `Google Sign-In (Inactive)` | ✅ Live GSI button rendered |
| Google Token Authentication | `POST /api/v1/auth/google` | ❌ Unreachable from form | ✅ Authenticates & stores JWT |
| Uploaded Asset Proxy | `GET https://...vercel.app/uploads/...` | ❌ `404 Not Found` | ✅ `200 OK` (Proxied to Railway) |
| Avatar Storage | `POST /api/v1/doctor/avatar` | ❌ Missing endpoint (base64 in DB) | ✅ Saved to storage, clean URL |
| Backend Health | `GET /api/v1/health` | ✅ `200 OK` | ✅ `200 OK` |
