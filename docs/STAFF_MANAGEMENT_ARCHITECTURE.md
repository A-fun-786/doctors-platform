# Manage Staff Architecture (Roster & Personnel Directory)

**Version:** 1.1.0  
**Status:** Production Ready  
**Date:** November 2026  
**Module:** Manage Staff Module  

---

## 1. Executive Overview

The **Manage Staff** module is a streamlined, multi-tenant administrative interface for healthcare clinics and doctors operating on the DocSpace platform. It allows clinic doctors to manage their roster of doctors, nurses, and administrative personnel through a clean, intuitive, and dedicated directory interface.

### Key Capabilities
- **Doctor & Staff Onboarding:** Quickly add doctors (consultants, specialists, junior doctors) and staff members (nurses, receptionists, technicians, billing executives).
- **Multi-Tenant Isolation:** All staff records are strictly partitioned by `doctor_id`.
- **Directory Filtering & Search:** Search by name, role, department, phone, or email in real-time.
- **Profile Management:** Edit staff contact details, role, department, salary, and notes.
- **Deactivation/Removal:** Safely remove or update status (`active`, `on_leave`, `inactive`).

---

## 2. Supported Roles & Departments

### 2.1 Roles
- **Doctor** *(Prominent support for adding fellow physicians & consultants)*
- **Junior Doctor**
- **Nurse**
- **Receptionist**
- **Pharmacist**
- **Lab Technician**
- **Billing Executive**
- **Administrative Assistant**
- **Other**

### 2.2 Departments
- **Clinical**
- **Nursing**
- **Front Desk**
- **Pharmacy**
- **Laboratory**
- **Administration**
- **Emergency**
- **General**

---

## 3. Database Schema

Primary table: `staff_members`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique staff identifier |
| `doctor_id` | UUID (FK) | Multi-tenant clinic reference (`doctors.id`, CASCADE) |
| `full_name` | VARCHAR(120) | Full name of the staff member / doctor |
| `email` | VARCHAR(255) | Optional contact email |
| `phone` | VARCHAR(30) | Primary phone number |
| `role` | VARCHAR(50) | Role / Designation (Doctor, Nurse, etc.) |
| `department` | VARCHAR(50) | Department within clinic |
| `employment_type` | VARCHAR(30) | `full_time`, `part_time`, `contract`, `shift` |
| `status` | VARCHAR(30) | `active`, `on_leave`, `inactive`, `terminated` |
| `joining_date` | DATE | Date joined |
| `base_salary_paise` | INTEGER | Monthly compensation in integer paise (₹1 = 100 paise) |
| `emergency_contact` | VARCHAR(100) | Optional emergency contact details |
| `notes` | TEXT | Specialization, shifts, or clinical notes |
| `created_at`, `updated_at`| TIMESTAMPTZ | Audit timestamps |

*Note: Related backend tables `staff_tasks`, `staff_leaves`, and `staff_payrolls` remain defined in migrations and backend services for future advanced workforce expansions.*

---

## 4. REST API Reference

Base path: `/api/v1/staff` (Requires Bearer JWT authentication)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/staff` | List staff with optional `department`, `role`, `status`, `search` |
| `POST` | `/api/v1/staff` | Add new staff member or doctor |
| `GET` | `/api/v1/staff/{id}` | Get staff member details |
| `PUT` | `/api/v1/staff/{id}` | Update staff member profile |
| `DELETE` | `/api/v1/staff/{id}` | Remove staff member from roster |
| `GET` | `/api/v1/staff/summary` | KPI counts for quick dashboard metrics |

---

## 5. Verification & Testing

- **Backend Pytest Suite:** [`backend/tests/test_staff.py`](file:///Users/emanur/doctors-platform/backend/tests/test_staff.py) (8/8 passed, 100%).
- **Shell Regression Suite:** [`scripts/test_dashboard_shell.mjs`](file:///Users/emanur/doctors-platform/scripts/test_dashboard_shell.mjs) (14/14 passed, 100%).
- **Responsive QA Suite:** [`scripts/test_responsive_qa_suite.mjs`](file:///Users/emanur/doctors-platform/scripts/test_responsive_qa_suite.mjs) (50/50 passed, 100%).
- **TypeScript Type Safety:** `npx tsc --noEmit` (0 errors).
