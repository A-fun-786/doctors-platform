# Staff Management & Authentication Architecture

**Document Version:** 2.1.0  
**Status:** Production Ready  
**Target Platform:** GoSmartClinic Practice Management System  
**Last Updated:** November 15, 2026  

---

## 1. Executive Summary

The **Staff Management & Authentication** system provides a multi-tenant, role-isolated operational hierarchy for healthcare clinics. It allows clinic owner doctors (Practice Administrators) to maintain a complete clinical and administrative roster, provision login credentials with cryptographic isolation, enforce strict login portal boundaries, and delegate day-to-day clinic operations without exposing administrative configurations or multi-tenant control.

### Core Architecture Highlights
1. **Dual-Portal Unified Authentication (`/login`):**
   - Single entry point with high-end, classic segmented tabs strictly labeled **Admin** and **Staff**.
   - Strict role boundary enforcement prevents staff accounts from signing into the Admin portal and prevents Admin accounts from signing into the Staff portal (HTTP 403 with a 1-click tab switcher).
2. **Admin-Provisioned Credentials:**
   - Practice administrators provision staff credentials (email & initial password) upon onboarding or in edit mode.
   - Built-in cryptographically safe random password generator.
3. **HIPAA & Cryptographic Privacy Standard:**
   - Stored passwords are one-way hashed with `bcrypt` (12 rounds) and never retrievable in plain text from the database.
   - Temporary credentials delivery modal provides a 1-click **"Copy Full Credentials"** button for sharing via WhatsApp, SMS, or email upon issuance.
   - An in-session secure cache surfaces the recently generated password with an **Eye Reveal/Mask** toggle before the administrator leaves the screen.
4. **Role-Based Navigation & Access Boundaries:**
   - Staff accounts automatically inherit their clinic's tenant workspace and appointments.
   - Administrative tabs (**Manage Staff**, **Android App**, and clinic profile editing) are hidden from staff sessions.
   - Protected backend routes enforce `require_doctor_owner` dependencies.

---

## 2. Role Matrix & Operational Boundaries

| User Type | Clinical Roles | Portal Access | Permissions & Capabilities | Restricted Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Doctor / Practice Owner** | Lead MD, Clinic Director | **Admin** Portal | Full tenant control, appointments, prescriptions, roster management, staff credential provisioning & resets, clinic profile editing, financial/salary records. | None |
| **Employed Doctor** | Associate Doctor, Junior Doctor, Consultant Specialist, Physician, Surgeon | **Staff** Portal | Patient consultations, view assigned visits only, mark own visits completed, clinical documentation. | Cannot book appointments, cannot reschedule or cancel appointments, cannot view other doctors' bookings, cannot manage other staff, cannot edit clinic settings. |
| **Nursing & Triage** | Registered Nurse, Head Nurse | **Staff** Portal | Patient triage, vitals recording, queue monitoring. | Restricted to clinical staff actions. |
| **Front Desk & Admin** | Receptionist, Billing Executive | **Staff** Portal | Patient check-in, appointment booking, OPD slips. | Restricted to front-desk actions. |
| **Diagnostics & Pharmacy** | Pharmacist, Lab Technician | **Staff** Portal | Prescription fulfillment, medicine stock, lab reports. | Restricted to department actions. |

---

## 3. Database Schema & Migrations

The database layer utilizes SQLAlchemy 2.0 mapped models backed by Alembic versioned migrations.

### 3.1 Migration History
- `010_staff_management`: Provisions the foundational `staff_members` table with doctor tenant foreign keys, contact details, department, employment type, salary in integer paise, and indexing.
- `011_staff_authentication`: Adds authentication columns (`can_login`, `hashed_password`, `must_change_password`, `last_login_at`) and creates an indexed lookup on `staff_members.email`.
- `012_multi_doctor_appointments`: Adds nullable foreign key `staff_id REFERENCES staff_members(id) ON DELETE SET NULL` to `appointments` and converts the global slot unique index into two partial unique indexes (`uq_primary_doctor_active_slot` where `staff_id IS NULL` and `uq_staff_doctor_active_slot` where `staff_id IS NOT NULL`), unlocking concurrent multi-doctor bookings in a clinic.

### 3.2 `staff_members` Table Definition

```sql
CREATE TABLE staff_members (
    id UUID PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(30) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(50) NOT NULL DEFAULT 'Clinical',
    employment_type VARCHAR(30) NOT NULL DEFAULT 'full_time',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    base_salary_paise INTEGER NOT NULL DEFAULT 0,
    emergency_contact VARCHAR(100) NULL,
    notes TEXT NULL,
    can_login BOOLEAN NOT NULL DEFAULT FALSE,
    hashed_password VARCHAR(255) NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_doctor_status ON staff_members(doctor_id, status);
CREATE INDEX idx_staff_doctor_dept ON staff_members(doctor_id, department);
CREATE INDEX idx_staff_email ON staff_members(email);
```

---

## 4. Authentication Architecture & Portal Enforcement

### 4.1 Login Request Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Doctor or Staff)
    participant UI as Login Window (/login)
    participant API as Auth API (/api/v1/auth/login)
    participant DB as Database (Doctors & Staff)

    User->>UI: Selects Tab ("Admin" or "Staff") & Enters Credentials
    UI->>API: POST /api/v1/auth/login {email, password, portal_type}
    
    alt Target is Doctor in Doctors Table
        API->>DB: Query Doctor by email
        DB-->>API: Doctor record found
        alt portal_type == "staff"
            API-->>UI: HTTP 403 ("Admin account. Switch to Admin tab.")
            UI-->>User: Shows 1-Click "Switch to Admin Tab" CTA
        else Valid Credentials
            API-->>UI: HTTP 200 {access_token, user_type: "doctor", role: "Doctor"}
            UI-->>User: Redirects to /dashboard (Admin features enabled)
        end
    else Target is Staff Member in staff_members Table
        API->>DB: Query StaffMember by email WHERE can_login = True
        DB-->>API: Staff record found
        alt portal_type == "admin"
            API-->>UI: HTTP 403 ("Staff account. Switch to Staff tab.")
            UI-->>User: Shows 1-Click "Switch to Staff Tab" CTA
        else Valid Credentials
            API-->>UI: HTTP 200 {access_token, user_type: "staff", role: staff.role}
            UI-->>User: Redirects to /dashboard (Role-restricted view)
        end
    end
```

### 4.2 Strict Role Enforcement Rules
1. **Admin Tab Login:**
   - Evaluates credentials against the `doctors` table.
   - If a valid staff member attempts login on the Admin tab, the backend returns HTTP 403:  
     `"This account is a clinic staff account. Please switch to the 'Staff' tab to sign in."`
   - The UI surfaces a direct 1-click button: `[Switch to Staff Tab →]`.
2. **Staff Tab Login:**
   - Evaluates credentials against `staff_members` where `can_login = True` and `status = 'active'`.
   - If a clinic doctor owner attempts login on the Staff tab, the backend returns HTTP 403:  
     `"This account is a clinic administrator account. Please switch to the 'Admin' tab to sign in."`
   - The UI surfaces a direct 1-click button: `[Switch to Admin Tab →]`.

---

## 5. Security & Password Lifecycle Management

### 5.1 Why Saved Passwords Cannot Be Read Back
Industry compliance regulations (including HIPAA, ISO 27001, and SOC 2 Type II) require that **passwords must never be stored in plain text or reversible encryption**.
- In GoSmartClinic, staff passwords are one-way hashed using `bcrypt` (12 cost factor rounds).
- The raw password is deleted from memory as soon as the hash is generated.
- Neither database administrators nor practice owners can decrypt saved passwords.

### 5.2 Credentials Delivery Lifecycle
1. **Provisioning:**
   - Administrator creates staff member or clicks "Edit" / "Reset Password".
   - Admin enters an initial password or clicks **"Generate Random Password"** (`Clinic@xxxx!`).
2. **Immediate Delivery Confirmation:**
   - Upon successful creation or reset, the UI presents the **"Portal Credentials Issued"** modal.
   - Displays:
     - Portal URL (`/login`, Staff tab)
     - Username / Email
     - Temporary Password
   - Includes a 1-click **"Copy Full Credentials"** button formatted for direct transmission to the employee via secure channel (WhatsApp, SMS, or email).
3. **Session Cache Memory:**
   - If the administrator inspects the staff member's profile again during the current browser session, a highlighted card **"Password Set This Session"** displays the credentials with an **Eye Reveal/Mask** toggle and a quick **Copy** button.
   - Once the administrator closes or refreshes the page, the in-memory cache is wiped, ensuring zero persistent plain-text exposure.
4. **Credential Resets:**
   - If a staff member misplaces their password, the practice administrator can click **"Reset Password"** on their directory profile to issue a fresh password instantly.

---

## 6. REST API Reference

All endpoints (except login) require an HTTP Bearer JWT token in the `Authorization` header.

### 6.1 Authentication Endpoints

#### `POST /api/v1/auth/login`
Authenticates practice owners and staff members.
- **Request Body:**
  ```json
  {
    "email": "doctor@clinic.com",
    "password": "Password123!",
    "portal_type": "admin"
  }
  ```
- **Responses:**
  - `200 OK`: Returns JWT `access_token`, `doctor` profile payload (with `user_type: "doctor" | "staff"`, `role`, and `can_manage_staff`), and `tenant` context.
  - `401 UNAUTHORIZED`: Invalid credentials or deactivated account.
  - `403 FORBIDDEN`: Mismatched portal type (provides clear directive to switch tabs).

#### `GET /api/v1/auth/me`
Retrieves identity and permissions for the authenticated session.
- **Staff Session Response:**
  ```json
  {
    "id": "uuid",
    "full_name": "Priya Sharma",
    "email": "priya@clinic.com",
    "phone": "+91 98765 00000",
    "role": "Nurse",
    "user_type": "staff",
    "staff_id": "uuid",
    "can_manage_staff": false,
    "onboarding_completed": true,
    "tenant": {
      "id": "uuid",
      "slug": "dr-sameer-clinic",
      "clinic_name": "Metro Health Clinic"
    }
  }
  ```

### 6.2 Staff Management Endpoints

#### `GET /api/v1/staff`
Lists staff members for the authenticated clinic tenant.
- **Query Parameters:** `department`, `role`, `status`, `search`.
- **Access:** Doctor Owner & Clinical Staff.

#### `POST /api/v1/staff`
Creates a staff member and provisions optional portal login credentials.
- **Access:** Doctor Owner Only (`require_doctor_owner`).
- **Request Body:**
  ```json
  {
    "full_name": "Dr. Rajesh Verma",
    "email": "rajesh.verma@clinic.com",
    "phone": "+91 98765 43210",
    "role": "Doctor",
    "department": "Clinical",
    "employment_type": "full_time",
    "base_salary_paise": 8500000,
    "can_login": true,
    "password": "Clinic@7291a!"
  }
  ```

#### `PUT /api/v1/staff/{staff_id}`
Updates details, department, status, compensation, or portal login access.
- **Access:** Doctor Owner Only (`require_doctor_owner`).

#### `POST /api/v1/staff/{staff_id}/reset-password`
Administrative override to rotate or set a new password for a staff member.
- **Access:** Doctor Owner Only (`require_doctor_owner`).
- **Request Body:**
  ```json
  {
    "new_password": "NewClinicPass@456!"
  }
  ```

#### `DELETE /api/v1/staff/{staff_id}`
Removes a staff member from the clinic roster and revokes portal login immediately.
- **Access:** Doctor Owner Only (`require_doctor_owner`).

---

### 6.2 Staff Doctor Appointment & Calendar Scoping

When a user logs in via the **Staff Portal** with a clinical role (`doctor`, `junior doctor`, `consultant`, `physician`, `surgeon`, `specialist`), strict operational boundaries are applied:

1. **Viewing Scope:**
   - `GET /api/v1/doctor/calendar`: Automatically overrides `staff_id = current_doctor._current_staff.id` and `primary_only = False`.
   - `GET /api/v1/doctor/appointments`: Scoped strictly to the staff doctor's own visits (`staff_id = current_doctor._current_staff.id`).
   - `GET /api/v1/doctor/appointments/{id}`: Returns `403 Forbidden` if `appointment.staff_id != current_doctor._current_staff.id`.

2. **Booking & Modification Lockouts:**
   - `POST /api/v1/doctor/appointments`: Returns `403 Forbidden` (`"Staff doctors are not permitted to book appointments. Please contact clinic reception."`).
   - `PUT/PATCH /api/v1/doctor/appointments/{id}` and `/reschedule`: Returns `403 Forbidden` (`"Staff doctors are not permitted to modify or reschedule appointments. Please contact clinic reception."`).
   - `POST /api/v1/doctor/appointments/{id}/cancel`: Returns `403 Forbidden` (`"Staff doctors are not permitted to cancel appointments. Please contact clinic reception."`).

3. **Consultation & Completion Workflow:**
   - `POST /api/v1/doctor/appointments/{id}/complete`: Permitted **only** if `appointment.staff_id == current_doctor._current_staff.id`. Returns `403 Forbidden` if attempting to complete another practitioner's appointment.

---

## 7. Frontend Component Architecture

```
components/
├── auth/
│   └── EmailAuthForm.tsx            # Unified login window with Admin/Staff tabs & Google sign-in
├── dashboard/
│   ├── DashboardShell.tsx           # Application frame with role-restricted navigation
│   ├── StaffTab.tsx                 # Staff directory, modals, credentials delivery, reset dialogs
│   ├── CalendarTab.tsx              # Detects isStaffDoctor, locks filter, disables booking modals
│   ├── calendar/
│   │   ├── views/
│   │   │   ├── CalendarHeader.tsx   # Displays locked "My Bookings" badge; hides "+ Book Appointment"
│   │   │   ├── AgendaView.tsx       # Omits booking CTA in empty state for staff doctors
│   │   │   ├── WeekView.tsx         # Disables empty slot click-to-book and hides hover "+" icon
│   │   │   └── DayView.tsx          # Disables empty slot booking and hides hover "+" icon
│   │   └── panels/
│   │       └── AppointmentDetailsPanel.tsx # Hides Cancel and Reschedule; retains "Mark Completed"
│   └── profile/
│       └── ProfileViewCard.tsx      # Practice profile view with staff read-only restrictions
lib/
└── api.ts                           # Typed API client SDK with staff auth and password methods
```

---

## 8. Automated Test Suite & Quality Assurance

The implementation is verified by automated test suites across all tiers:

```bash
# 1. Staff Doctor Appointment Restrictions & Permissions (7 tests)
pytest backend/tests/test_staff_doctor_appointment_restrictions.py -v

# 2. Backend Staff Authentication & Portal Boundaries (7 tests)
pytest backend/tests/test_staff_auth.py -v

# 3. Backend Staff Roster Management & CRUD (6 tests)
pytest backend/tests/test_staff.py -v

# 4. Comprehensive Backend Test Suite (180 tests)
ALLOW_MOCK_AUTH=true pytest backend/tests/ -v

# 5. Frontend Shell Navigation & Responsive QA (10 suites, 64 checks)
npm test

# 6. Production TypeScript Check & Lint
npx tsc --noEmit && npm run lint

# 7. Production Next.js Build
npm run build
```

All 180 backend tests and all 10 frontend test suites pass with **100% compliance**.

### 5.2 Credentials Delivery Lifecycle
1. **Provisioning:**
   - Administrator creates staff member or clicks "Edit" / "Reset Password".
   - Admin enters an initial password or clicks **"Generate Random Password"** (`Clinic@xxxx!`).
2. **Immediate Delivery Confirmation:**
   - Upon successful creation or reset, the UI presents the **"Portal Credentials Issued"** modal.
   - Displays:
     - Portal URL (`/login`, Staff tab)
     - Username / Email
     - Temporary Password
   - Includes a 1-click **"Copy Full Credentials"** button formatted for direct transmission to the employee via secure channel (WhatsApp, SMS, or email).
3. **Session Cache Memory:**
   - If the administrator inspects the staff member's profile again during the current browser session, a highlighted card **"Password Set This Session"** displays the credentials with an **Eye Reveal/Mask** toggle and a quick **Copy** button.
   - Once the administrator closes or refreshes the page, the in-memory cache is wiped, ensuring zero persistent plain-text exposure.
4. **Credential Resets:**
   - If a staff member misplaces their password, the practice administrator can click **"Reset Password"** on their directory profile to issue a fresh password instantly.

---

## 6. REST API Reference

All endpoints (except login) require an HTTP Bearer JWT token in the `Authorization` header.

### 6.1 Authentication Endpoints

#### `POST /api/v1/auth/login`
Authenticates practice owners and staff members.
- **Request Body:**
  ```json
  {
    "email": "doctor@clinic.com",
    "password": "Password123!",
    "portal_type": "admin"
  }
  ```
- **Responses:**
  - `200 OK`: Returns JWT `access_token`, `doctor` profile payload (with `user_type: "doctor" | "staff"`, `role`, and `can_manage_staff`), and `tenant` context.
  - `401 UNAUTHORIZED`: Invalid credentials or deactivated account.
  - `403 FORBIDDEN`: Mismatched portal type (provides clear directive to switch tabs).

#### `GET /api/v1/auth/me`
Retrieves identity and permissions for the authenticated session.
- **Staff Session Response:**
  ```json
  {
    "id": "uuid",
    "full_name": "Priya Sharma",
    "email": "priya@clinic.com",
    "phone": "+91 98765 00000",
    "role": "Nurse",
    "user_type": "staff",
    "staff_id": "uuid",
    "can_manage_staff": false,
    "onboarding_completed": true,
    "tenant": {
      "id": "uuid",
      "slug": "dr-sameer-clinic",
      "clinic_name": "Metro Health Clinic"
    }
  }
  ```

### 6.2 Staff Management Endpoints

#### `GET /api/v1/staff`
Lists staff members for the authenticated clinic tenant.
- **Query Parameters:** `department`, `role`, `status`, `search`.
- **Access:** Doctor Owner & Clinical Staff.

#### `POST /api/v1/staff`
Creates a staff member and provisions optional portal login credentials.
- **Access:** Doctor Owner Only (`require_doctor_owner`).
- **Request Body:**
  ```json
  {
    "full_name": "Dr. Rajesh Verma",
    "email": "rajesh.verma@clinic.com",
    "phone": "+91 98765 43210",
    "role": "Doctor",
    "department": "Clinical",
    "employment_type": "full_time",
    "base_salary_paise": 8500000,
    "can_login": true,
    "password": "Clinic@7291a!"
  }
  ```

#### `PUT /api/v1/staff/{staff_id}`
Updates details, department, status, compensation, or portal login access.
- **Access:** Doctor Owner Only (`require_doctor_owner`).

#### `POST /api/v1/staff/{staff_id}/reset-password`
Administrative override to rotate or set a new password for a staff member.
- **Access:** Doctor Owner Only (`require_doctor_owner`).
- **Request Body:**
  ```json
  {
    "new_password": "NewClinicPass@456!"
  }
  ```

#### `DELETE /api/v1/staff/{staff_id}`
Removes a staff member from the clinic roster and revokes portal login immediately.
- **Access:** Doctor Owner Only (`require_doctor_owner`).

---

### 6.2 Staff Doctor Appointment & Calendar Scoping

When a user logs in via the **Staff Portal** with a clinical role (`doctor`, `junior doctor`, `consultant`, `physician`, `surgeon`, `specialist`), strict operational boundaries are applied:

1. **Viewing Scope:**
   - `GET /api/v1/doctor/calendar`: Automatically overrides `staff_id = current_doctor._current_staff.id` and `primary_only = False`.
   - `GET /api/v1/doctor/appointments`: Scoped strictly to the staff doctor's own visits (`staff_id = current_doctor._current_staff.id`).
   - `GET /api/v1/doctor/appointments/{id}`: Returns `403 Forbidden` if `appointment.staff_id != current_doctor._current_staff.id`.

2. **Booking & Modification Lockouts:**
   - `POST /api/v1/doctor/appointments`: Returns `403 Forbidden` (`"Staff doctors are not permitted to book appointments. Please contact clinic reception."`).
   - `PUT/PATCH /api/v1/doctor/appointments/{id}` and `/reschedule`: Returns `403 Forbidden` (`"Staff doctors are not permitted to modify or reschedule appointments. Please contact clinic reception."`).
   - `POST /api/v1/doctor/appointments/{id}/cancel`: Returns `403 Forbidden` (`"Staff doctors are not permitted to cancel appointments. Please contact clinic reception."`).

3. **Consultation & Completion Workflow:**
   - `POST /api/v1/doctor/appointments/{id}/complete`: Permitted **only** if `appointment.staff_id == current_doctor._current_staff.id`. Returns `403 Forbidden` if attempting to complete another practitioner's appointment.

---

## 7. Frontend Component Architecture

```
components/
├── auth/
│   └── EmailAuthForm.tsx            # Unified login window with Admin/Staff tabs & Google sign-in
├── dashboard/
│   ├── DashboardShell.tsx           # Application frame with role-restricted navigation
│   ├── StaffTab.tsx                 # Staff directory, modals, credentials delivery, reset dialogs
│   ├── CalendarTab.tsx              # Detects isStaffDoctor, locks filter, disables booking modals
│   ├── calendar/
│   │   ├── views/
│   │   │   ├── CalendarHeader.tsx   # Displays locked "My Bookings" badge; hides "+ Book Appointment"
│   │   │   ├── AgendaView.tsx       # Omits booking CTA in empty state for staff doctors
│   │   │   ├── WeekView.tsx         # Disables empty slot click-to-book and hides hover "+" icon
│   │   │   └── DayView.tsx          # Disables empty slot booking and hides hover "+" icon
│   │   └── panels/
│   │       └── AppointmentDetailsPanel.tsx # Hides Cancel and Reschedule; retains "Mark Completed"
│   └── profile/
│       └── ProfileViewCard.tsx      # Practice profile view with staff read-only restrictions
lib/
└── api.ts                           # Typed API client SDK with staff auth and password methods
```

---

## 8. Automated Test Suite & Quality Assurance

The implementation is verified by automated test suites across all tiers:

```bash
# 1. Staff Doctor Appointment Restrictions & Permissions (7 tests)
pytest backend/tests/test_staff_doctor_appointment_restrictions.py -v

# 2. Backend Staff Authentication & Portal Boundaries (7 tests)
pytest backend/tests/test_staff_auth.py -v

# 3. Backend Staff Roster Management & CRUD (6 tests)
pytest backend/tests/test_staff.py -v

# 4. Comprehensive Backend Test Suite (180 tests)
ALLOW_MOCK_AUTH=true pytest backend/tests/ -v

# 5. Frontend Shell Navigation & Responsive QA (10 suites, 64 checks)
npm test

# 6. Production TypeScript Check & Lint
npx tsc --noEmit && npm run lint

# 7. Production Next.js Build
npm run build
```

All 180 backend tests and all 10 frontend test suites pass with **100% compliance**.

