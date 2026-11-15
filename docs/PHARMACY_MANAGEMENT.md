# Pharmacy & Dispensary Inventory Management

*Last updated: November 15, 2026*

## 1. Overview
The **Dispensary & Medicine Inventory Management** module provides healthcare practitioners with on-site clinical stock tracking, threshold warnings, batch tracking, and inventory adjustments.

### Why It Exists
Medical practices dispense medications and clinical consumables during in-person patient consultations. Practitioners need:
- An internal catalog of dispensed medicines, formulas, and dosage forms.
- Real-time stock levels with automated alerts when supplies fall below a safety threshold (`min_stock_alert`).
- Tracking of expiry dates (with automated flags for expired or expiring within 30 days).
- Quick stock addition/deduction logging for restocking and dispensing.

### Architecture Placement
- **Frontend Dashboard:** [PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx) embedded inside [DashboardShell.tsx](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx).
- **Public Practice Webpage:** [app/[slug]/page.tsx](file:///Users/emanur/doctors-platform/app/[slug]/page.tsx) renders an on-site dispensary feature card when `service_medicine_inventory` is enabled.
- **Backend API:** FastAPI routes under `/api/v1/doctor/pharmacy/*` in [backend/app/api/routes/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py).
- **Database Model:** PostgreSQL/SQLite table `medicine_items` mapped via SQLAlchemy in [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py).

---

## 2. Code Map

### Key Files & Responsibilities
- [components/dashboard/PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx): Primary clinic dispensary UI (KPI metrics, search/filter table, Add/Edit modal, Quick Stock Adjustment modal).
- [lib/api.ts](file:///Users/emanur/doctors-platform/lib/api.ts): Typed client API functions (`getPharmacyStats`, `getMedicineInventory`, `createMedicineItem`, `updateMedicineItem`, `deleteMedicineItem`, `adjustMedicineStock`, `seedSampleMedicines`).
- [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py): `MedicineItem` entity with dynamic `calculate_status()` logic.
- [backend/app/schemas/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/schemas/pharmacy.py): Pydantic validation schemas (`MedicineItemCreateRequest`, `MedicineItemUpdateRequest`, `StockAdjustmentRequest`, `PharmacyStatsResponse`).
- [backend/app/services/pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py): Business logic for CRUD, stock increment/decrement validation, and expiry enrichment.
- [backend/app/api/routes/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py): Authenticated FastAPI endpoints for dispensary management.
- [app/[slug]/page.tsx](file:///Users/emanur/doctors-platform/app/[slug]/page.tsx): Patient profile view displaying verified in-clinic dispensary availability.
- [android-template/.../HomeScreen.kt](file:///Users/emanur/doctors-platform/android-template/app/src/main/kotlin/com/docspace/template/ui/screens/HomeScreen.kt): Native Android template displaying in-clinic dispensary status.

### Entry Points and Main Flow
1. **Catalog Query:** `PharmacyTab` mounts -> calls `getPharmacyStats()` and `getMedicineInventory()` in parallel -> renders 4 KPI metric cards and searchable medicine table.
2. **Stock Adjustment:** User clicks "+/- Stock" on an item -> opens adjustment modal with delta shortcuts (+10, +50, -5, etc.) -> submits to `POST /api/v1/doctor/pharmacy/medicines/{id}/adjust-stock` -> stock is safely updated and item status recalculated.
3. **Item Creation/Update:** User submits Add/Edit modal -> calls `POST / PUT /api/v1/doctor/pharmacy/medicines` -> validated by Pydantic and persisted in `medicine_items`.
4. **Seed Sample Data:** If inventory is empty, a "Seed Sample Medicines" button populates 6 standard clinical preparations (Amoxicillin, Paracetamol, Metformin, Azithromycin, Cetirizine, Omeprazole).

### Data Models & State
- `MedicineItem`:
  - `name` (str), `generic_name` (optional str), `category` (str), `dosage_form` (str)
  - `strength` (str), `sku` (optional str), `batch_number` (optional str)
  - `stock_quantity` (int, ge=0), `min_stock_alert` (int, ge=0)
  - `unit_price` (float, ge=0.0), `expiry_date` (optional date)
  - `status`: Computed dynamically (`"out_of_stock"` if `<= 0`, `"low_stock"` if `<= min_stock_alert`, else `"in_stock"`).
  - Enriched flags: `is_expiring_soon` (within 30 days) and `is_expired` (`expiry_date < today`).

---

## 3. Decisions and Gotchas

### Decisions
- **Pure In-Clinic Dispensary Model:** Patient home-delivery ordering and courier dispatch workflows were intentionally removed. Doctor clinics operate internal dispensaries for in-person consultations rather than public e-commerce delivery.
- **Stock Clamping:** Negative stock quantities are prevented at both the database level (`stock_quantity >= 0`) and the service layer. Reductions greater than current stock return `HTTP 400 Bad Request`.
- **Dynamic Status & Expiry Computation:** Stock status and expiry warnings (`is_expiring_soon`, `is_expired`) are calculated on the fly against today's date rather than relying on stale cron-updated fields.
- **Tenant Isolation:** Every item is scoped to `doctor_id` (and associated `tenant_id`). Doctors cannot view, modify, or delete medicines from another practice.

### Gotchas & Constraints
- **Date Comparison in Tests:** When testing time/date-sensitive operations, use future dates (e.g. `today + timedelta(days=5)`) rather than fixed dates to prevent time-of-day filtering failures when the test suite runs in the afternoon.
- **Next.js Dev Cache:** Do not run `next build` while `npm run dev` is active in another process; doing so overwrites `.next/` with production chunks and causes local development chunk 404s.

---

## 4. How to Work With It

### Build, Run, and Test Commands
```bash
# Run backend pytest suite (all 160 tests must pass)
ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests

# Run frontend TypeScript type checking
npx tsc --noEmit

# Run frontend automated test suites
npm test

# Run frontend development server
npm run dev

# Run backend development server
cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000
```

### Adding a New Therapeutic Category
1. Add the category name to `CATEGORIES` array in [components/dashboard/PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx).
2. Category strings are validated up to 100 characters in [backend/app/schemas/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/schemas/pharmacy.py).

---

## 5. Open Questions
*None currently open. In-clinic inventory model verified and passing 100% of automated tests.*

