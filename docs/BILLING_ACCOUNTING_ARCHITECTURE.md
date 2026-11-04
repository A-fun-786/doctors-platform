# DocSpace — Patient-to-Clinic Billing & Invoicing Architecture Guide

> **Module Status:** Complete & Verified on `feat/billing-management`  
> **Key Design Pillars:** Multi-tenant isolation, integer-paise financial precision, sequential per-clinic numbering, immutable audit ledger, cross-module adapter (`addToInvoice`), and gateway-ready abstraction (Manual now, Razorpay pluggable).

---

## 1. Overview & Architecture Goals

The **Billing & Invoicing / Accounting Module** acts as the central financial ledger of the DocSpace platform. 

In a multi-tenant clinic management SaaS, individual clinics use varying sets of modules (Appointments, Pharmacy, Lab Diagnostics, Teleconsultation). Rather than dispersing payment logic or tight-coupling billing to individual modules:

1. **Central Ledger Pattern**: Billing is decoupled and self-contained. Any operational module communicates through a simple, standardized contract (`addToInvoice`) to append items to a patient's bill.
2. **Standalone Capable**: Standalone clinics, pharmacies, or diagnostic labs can create, issue, and settle invoices directly without requiring an appointment visit.
3. **Immutable Auditability**: Invoices snapshot prices, discounts, and taxes at billing time. Once issued, invoices are locked against mutation. Payments are immutable and can only be reversed via formal refunds. Every mutation writes to a dedicated `billing_audit_logs` table.
4. **Gateway-Ready Abstraction**: Features a `PaymentProvider` interface with a `ManualPaymentProvider` implemented now (cash, UPI, card, offline) and a `RazorpayPaymentProvider` stub ready for zero-friction gateway integration later.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLINICAL MODULES LAYER                                   │
│    Appointments (Consultations)     Pharmacy (Prescriptions)     Lab (Diagnostics)      │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
                                         ▼ addToInvoice(tenant_id, doctor_id, patient, items)
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          CENTRAL BILLING & INVOICING MODULE                             │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │  Invoice Lifecycle:                                                             │   │
│   │    draft  ──[Issue]──>  issued  ──[Payment]──>  partially_paid / paid           │   │
│   │      │                    │                             │                       │   │
│   │      └──[Cancel]──>  cancelled                          └──[Refund]──> refunded │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│   ┌──────────────────────────────┐          ┌──────────────────────────────────────┐    │
│   │  Clinic Service Catalog      │          │  Payment Provider Abstraction        │    │
│   │  • Consultation rates        │          │  • ManualPaymentProvider (Active)    │    │
│   │  • Lab test standard prices  │          │  • RazorpayPaymentProvider (Ready)   │    │
│   │  • Tax / GST rate defaults   │          │                                      │    │
│   └──────────────────────────────┘          └──────────────────────────────────────┘    │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │  Immutable Financial Ledger & Audit Trail:                                      │   │
│   │  • Sequence Counter: INV-YYYY-XXXX (Per-tenant atomic numbering)                │   │
│   │  • Paise-based Math: All money stored strictly as integers (1 INR = 100 paise)   │   │
│   │  • Idempotency Check: Prevents duplicate payments on retries or double clicks   │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                DOCTOR DASHBOARD UI                                      │
│    • Financial KPI Cards (Total Invoiced, Collected Today, Outstanding Balance)         │
│    • Invoices Table with Search & Status Pills (Draft, Issued, Partially Paid, Paid)     │
│    • New Invoice Modal with Service Catalog Quick-Adder & Real-Time Calculation        │
│    • Record Payment Modal with Partial / Split Payment Support                          │
│    • Printable Tax Invoice & Receipt (Styled with @media print for A4 & Thermal)        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Rules & Standards

### 2.1 Multi-Tenant Isolation
Every query and database entity explicitly enforces `tenant_id` scoping. No doctor can read, create, modify, or settle invoices belonging to another clinic tenant.

### 2.2 Integer-Paise Financial Precision (No Floating-Point)
- All monetary fields in the database and API payloads are strictly stored and computed as **integers representing paise** (e.g., ₹500.00 = `50000` paise).
- This prevents IEEE 754 floating-point rounding discrepancies in invoice totals, discounts, taxes, and balance calculations.
- The frontend converts paise to Rupees for display using Indian numbering formatting (`₹{ (paise / 100).toLocaleString('en-IN') }`).

### 2.3 Invoice Numbering & Lifecycle
- Invoices receive a clean, sequential, clinic-scoped identifier: `INV-{YYYY}-{0001}` (e.g. `INV-2026-0001`, `INV-2026-0002`).
- **Statuses**:
  - `draft`: Editable. Line items can be added, modified, or removed.
  - `issued`: Locked. Prices, quantities, and discounts cannot be mutated.
  - `partially_paid`: Balance due is strictly greater than zero and less than total amount.
  - `paid`: Balance due is exactly 0 paise.
  - `cancelled`: Revoked by clinic administration.
  - `refunded`: Payments reversed.

### 2.4 Payment Idempotency & Split Payments
- Payments accept an `idempotency_key`. Repeating a request with the same idempotency key returns the existing payment record without duplicate debiting or balance deduction.
- Split payments (e.g., patient pays ₹500 in Cash and ₹300 via UPI) are fully supported, automatically reducing the invoice balance due.

---

## 3. Database Schema Reference

All tables are managed via **Alembic Migration** [`011_billing_and_accounting.py`](file:///Users/emanur/doctors-platform/backend/alembic/versions/011_billing_and_accounting.py) and defined in [`backend/app/models/billing.py`](file:///Users/emanur/doctors-platform/backend/app/models/billing.py).

### 3.1 `clinic_service_catalog`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Item identifier |
| `tenant_id` | UUID | Foreign Key (`tenants.id`), Indexed | Clinic isolation boundary |
| `name` | String(255) | Not Null | Service name (e.g. "General Consultation") |
| `category` | String(100) | Not Null | Category (Consultation, Lab, Pharmacy, Procedure) |
| `description` | Text | Nullable | Optional service details |
| `unit_price_paise` | Integer | Not Null | Price in integer paise (₹500 = 50000) |
| `tax_rate_percent` | Numeric(5, 2) | Default: 0.00 | GST percentage |
| `is_active` | Boolean | Default: True | Active status |

### 3.2 `clinic_invoice_sequences`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Sequence identifier |
| `tenant_id` | UUID | Foreign Key (`tenants.id`), Indexed | Clinic isolation boundary |
| `year` | Integer | Not Null | Calendar year (e.g. 2026) |
| `last_sequence`| Integer | Default: 0 | Atomic counter incremented per invoice |

### 3.3 `invoices`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Invoice identifier |
| `tenant_id` | UUID | Foreign Key (`tenants.id`), Indexed | Clinic isolation boundary |
| `doctor_id` | UUID | Foreign Key (`doctors.id`), Indexed | Billing provider |
| `appointment_id`| UUID | Foreign Key (`appointments.id`), Nullable | Optional visit reference |
| `invoice_number`| String(50) | Indexed | E.g. `INV-2026-0001` |
| `patient_name` | String(255) | Not Null | Patient full name |
| `patient_contact`| String(50) | Nullable | Phone number |
| `patient_email` | String(255) | Nullable | Patient email |
| `status` | String(50) | Indexed, Default: "draft" | Lifecycle state |
| `issue_date` | Date | Default: Current Date | Date issued |
| `due_date` | Date | Nullable | Payment deadline |
| `subtotal_paise`| Integer | Default: 0 | Sum of line totals |
| `discount_paise`| Integer | Default: 0 | Applied discount |
| `tax_paise` | Integer | Default: 0 | Total computed GST |
| `total_amount_paise` | Integer | Default: 0 | `subtotal - discount + tax` |
| `paid_amount_paise` | Integer | Default: 0 | Cumulative settlements |
| `balance_due_paise` | Integer | Default: 0 | `total - paid` |

### 3.4 `invoice_items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Line item identifier |
| `invoice_id` | UUID | Foreign Key (`invoices.id`), Cascade Delete | Parent invoice |
| `tenant_id` | UUID | Foreign Key (`tenants.id`), Indexed | Isolation check |
| `source_module` | String(50) | Default: "consultation" | consultation, pharmacy, lab, checkup, other |
| `source_ref_id` | String(100) | Nullable | E.g. `order_id` or `prescription_id` |
| `description` | String(255) | Not Null | Item name |
| `quantity` | Integer | Default: 1 | Item quantity |
| `unit_price_paise` | Integer | Not Null | Unit price snapshot |
| `discount_paise` | Integer | Default: 0 | Per-line discount |
| `tax_rate_percent` | Numeric(5, 2) | Default: 0.00 | GST percentage |
| `tax_amount_paise` | Integer | Default: 0 | Calculated GST |
| `line_total_paise` | Integer | Default: 0 | Final line total |

### 3.5 `payments`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Transaction identifier |
| `invoice_id` | UUID | Foreign Key (`invoices.id`) | Target invoice |
| `tenant_id` | UUID | Foreign Key (`tenants.id`), Indexed | Clinic isolation boundary |
| `amount_paise` | Integer | Not Null | Amount settled |
| `method` | String(50) | Default: "cash" | cash, upi, card, online, other |
| `reference_number` | String(100) | Nullable | UTR, auth code, cash slip # |
| `status` | String(50) | Default: "success" | success, failed, refunded |
| `gateway` | String(50) | Nullable | manual, razorpay, stripe |
| `gateway_order_id` | String(100) | Nullable | Gateway order ref |
| `gateway_payment_id` | String(100) | Nullable | Gateway payment ref |
| `idempotency_key` | String(100) | Indexed, Nullable | Anti-duplicate key |

### 3.6 `refunds` & `billing_audit_logs`
- `refunds`: Records partial or full payment reversals with mandatory reason.
- `billing_audit_logs`: Append-only audit trail logging `tenant_id`, `entity_type`, `entity_id`, `action`, `actor_id`, and `metadata_json`.

---

## 4. API Endpoints Reference

All endpoints are registered under `/api/v1/doctor/billing/*` in [`backend/app/api/routes/billing.py`](file:///Users/emanur/doctors-platform/backend/app/api/routes/billing.py) and require Doctor JWT authentication.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/doctor/billing/stats` | Aggregated revenue KPIs, collections today, outstanding debt, and payment method breakdown |
| `GET` | `/api/v1/doctor/billing/invoices` | List invoices with filters (`status_filter`, `search`) |
| `POST`| `/api/v1/doctor/billing/invoices` | Explicitly create an invoice with line items (draft or auto-issue) |
| `GET` | `/api/v1/doctor/billing/invoices/{id}` | Retrieve complete invoice detail with line items and payment transactions |
| `PATCH`| `/api/v1/doctor/billing/invoices/{id}` | Update draft invoice details or replace line items |
| `POST`| `/api/v1/doctor/billing/invoices/{id}/issue` | Lock draft and mark invoice as `issued` |
| `POST`| `/api/v1/doctor/billing/invoices/{id}/cancel` | Cancel an unpaid invoice |
| `POST`| `/api/v1/doctor/billing/invoices/{id}/payments` | Record payment against invoice (supports partial amount, split methods, idempotency) |
| `POST`| `/api/v1/doctor/billing/refunds` | Process payment refund and update invoice balance |
| `POST`| `/api/v1/doctor/billing/add-to-invoice` | Cross-module adapter endpoint appending line items to today's draft invoice |
| `GET` | `/api/v1/doctor/billing/catalog` | Get clinic's service fee catalog |
| `POST`| `/api/v1/doctor/billing/catalog` | Add new item to service catalog |
| `POST`| `/api/v1/doctor/billing/catalog/seed-defaults` | Seed standard medical fees (₹500 consultation, ₹300 follow-up, ₹150 blood sugar) |

---

## 5. Gateway-Ready Payment Provider Architecture

Defined in [`backend/app/services/payment_provider.py`](file:///Users/emanur/doctors-platform/backend/app/services/payment_provider.py):

```python
class PaymentProvider(ABC):
    @abstractmethod
    def initiate_payment(self, amount_paise: int, invoice_number: str, customer_info: dict, idempotency_key: str) -> PaymentResult:
        ...

class ManualPaymentProvider(PaymentProvider):
    # Implemented now for Cash, UPI, POS Terminal Card receipts

class RazorpayPaymentProvider(PaymentProvider):
    # Structured pluggable stub for Razorpay order generation & webhook verification
```

Adding Razorpay in the future requires only supplying Razorpay API credentials to `RazorpayPaymentProvider` without altering invoice models, line items, or accounting rules.

---

## 6. Doctor Dashboard UI (`BillingTab.tsx`)

Located at [`components/dashboard/BillingTab.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/BillingTab.tsx):
- **Metrics Bar**: 4 KPI cards for Total Invoiced, Collected Today, Outstanding Balance Due, and Settlement Rate.
- **Search & Filters**: Instant search by invoice #, patient name, or contact number + status filters (`All`, `Draft`, `Issued`, `Partially Paid`, `Paid`, `Cancelled`).
- **New Invoice Modal**: Allows selecting items from the clinic's fee catalog or entering custom items with real-time computation of subtotal, discounts, GST, and net amount.
- **Record Payment Modal**: Clean modal for recording partial or full payments with method selector (Cash, UPI, Card) and reference/UTR field.
- **Printable Tax Invoice / Receipt**: Styled with `@media print` so doctors can click "Print Receipt" and produce a clean A4 or thermal receipt directly via `window.print()`.

---

## 7. Testing & Quality Verification

Implemented in [`backend/tests/test_billing.py`](file:///Users/emanur/doctors-platform/backend/tests/test_billing.py):
1. `test_service_catalog_seed_and_create`: Verifies catalog seeding and item creation.
2. `test_create_and_issue_invoice_lifecycle`: Verifies draft creation, totals calculation, draft editing, and lock-on-issue behavior.
3. `test_partial_and_split_payments`: Verifies split payment math (₹500 Cash + ₹500 UPI) and automatic transition to `partially_paid` then `paid`.
4. `test_payment_idempotency`: Verifies that identical idempotency keys return the existing transaction without duplicate charges.
5. `test_cross_module_adapter_add_to_invoice`: Verifies cross-module item bundling into today's draft invoice.
6. `test_multi_tenant_isolation`: Verifies that Doctor B cannot access or modify Doctor A's invoices.
