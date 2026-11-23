# 🔄 Account Migration Guide: Moving Prod Stack to `gosmartclinic.admin@gmail.com`

This runbook outlines how to transfer ownership of each service provider in [`deployment.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/deployment.md) to **`gosmartclinic.admin@gmail.com`** without causing production downtime.

---

## 1. Vercel (Frontend Hosting)

Current project: `doctors-platform` (Team: `doctor-platform1`).

### Option A: Transfer via Team Invite (Zero Downtime — Recommended)
1. Sign in to [Vercel Dashboard](https://vercel.com).
2. Go to **Team Settings** (`doctor-platform1`) &rarr; **Members**.
3. Click **Invite** &rarr; enter `gosmartclinic.admin@gmail.com` &rarr; role: **Owner**.
4. Log into `gosmartclinic.admin@gmail.com` and accept the email invitation.
5. In **Team Settings** &rarr; **Members**, demote or remove the old account once verified.

### Option B: Transfer Individual Project
1. Go to **Project Settings** &rarr; scroll to bottom &rarr; **Transfer Project**.
2. Transfer to the newly created Vercel account or team belonging to `gosmartclinic.admin@gmail.com`.

---

## 2. Railway (Backend API Container)

Current project: `doctors-platform` (`fe822617-6de1-4fc4-b1c3-4acaeca4f8f5`).

1. Log into [Railway Dashboard](https://railway.com).
2. Open project `doctors-platform` &rarr; **Settings** &rarr; **Members**.
3. Invite `gosmartclinic.admin@gmail.com` as **Admin** / **Member**.
4. Log into Railway with `gosmartclinic.admin@gmail.com` and accept the invitation.
> [!NOTE]
> Workspace-level ownership transfer is restricted on Railway's Free/Hobby plan. Keeping `gosmartclinic.admin@gmail.com` as a project Member/Admin provides full deployment, variables, and runtime management without incurring paid plan fees or downtime.

---

## 3. Neon (PostgreSQL Database)

Current project: `doctors-platform` (`broad-dew-02890071`).

### Option A: Organization Invite & Transfer (Recommended)
1. Log into [Neon Console](https://console.neon.tech).
2. Navigate to your Organization / Project settings &rarr; **Members**.
3. Invite `gosmartclinic.admin@gmail.com` with role **Admin**.
4. Log in as `gosmartclinic.admin@gmail.com`, accept invite, and assign ownership.

### Option B: Database Dump & Restore (If on standalone free tier personal account)
If Neon's free tier prevents org membership transfers:
1. Export schema and data:
   ```bash
   pg_dump "$DATABASE_URL" -Fc -f backup.dump
   ```
2. Create project `doctors-platform` in the new Neon account (`gosmartclinic.admin@gmail.com`).
3. Restore into the new database:
   ```bash
   pg_restore -d "$NEW_DATABASE_URL" --no-owner --no-privileges backup.dump
   ```
4. Update Railway variable:
   ```bash
   railway variable set DATABASE_URL="<new_neon_db_url>" --service backend
   ```

---

## 4. Google Cloud Platform (Google OAuth)

Current Client ID: `644948532553-...` (Google Sign-In).

1. Log into [Google Cloud Console](https://console.cloud.google.com).
2. Select the GCP project managing your OAuth consent screen.
3. Go to **IAM & Admin** &rarr; **IAM**.
4. Click **Grant Access** / **Add**.
5. New principals: `gosmartclinic.admin@gmail.com` &rarr; Role: **Owner**.
6. Accept invitation if needed.
7. (Optional) Remove the previous Google account from IAM once confirmed.

---

## 5. Sentry (Error & Crash Reporting)

Current DSN: `o4512165357486080.ingest.us.sentry.io`.

1. Sentry's **Developer (Free)** plan restricts organizations to **1 member seat**, preventing invites without upgrading.
2. **Option A (Direct Email Transfer - Recommended):**
   - Go to [User Account Settings](https://sentry.io/settings/account/details/).
   - Update the primary email address directly to `gosmartclinic.admin@gmail.com`.
   - Confirm via verification email, then update password / link Google SSO.
3. **Option B (Fresh Free Account - Cleanest):**
   - Sign up fresh at [Sentry](https://sentry.io/signup/) using `gosmartclinic.admin@gmail.com`.
   - Create projects (`gosmartclinic-frontend`, `gosmartclinic-backend`).
   - Copy new DSNs to Vercel and Render environment variables.
4. **Option C (Temporary Trial):**
   - In Organization Settings &rarr; Subscription, start the 14-day Team trial (no credit card required).
   - Invite `gosmartclinic.admin@gmail.com` as Owner, then remove the old account.

---

## 6. Cloudflare (Wrangler / R2 Storage)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Navigate to **Manage Account** &rarr; **Members**.
3. Click **Invite Member** &rarr; `gosmartclinic.admin@gmail.com` &rarr; Role: **Super Administrator**.
4. Accept invite from `gosmartclinic.admin@gmail.com`.

---

## 7. Re-authenticating Local Development CLIs

Once ownership is transferred, log out and authenticate your local terminal CLIs with the new credentials:

```bash
# Vercel CLI
vercel logout
vercel login

# Railway CLI
railway logout
railway login

# Neon CLI
neonctl auth logout
neonctl auth

# Cloudflare Wrangler CLI
wrangler logout
wrangler login
```

After re-authenticating, re-link the project locally:
```bash
railway link fe822617-6de1-4fc4-b1c3-4acaeca4f8f5
vercel link
```