# Pharmacy & Dispensary Inventory Management

*Last updated: November 15, 2026*

## 1. Overview
The **Dispensary & Medicine Inventory Management** module provides healthcare practitioners with on-site clinical stock tracking, purchase vs. sale pricing, threshold warnings, batch tracking, and expiry monitoring.

### Why It Exists
Medical practices dispense medications and clinical consumables during in-person patient consultations. Practitioners need:
- An internal catalog of dispensed medicines, formulations, and dosage forms.
- Dual-price tracking: clinic procurement cost (`purchase_price`) and dispensed sale price (`unit_price`).
- Real-time stock levels with automated alerts when supplies fall below a safety threshold (`min_stock_alert`).
- Mandatory expiry date tracking (with automated flags for expired items or items expiring within 30 days).
- Clean, paginated clinical inventory viewing with Indian Rupee (`₹`) pricing.

### Architecture Placement
- **Frontend Dashboard:** [PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx) embedded inside [DashboardShell.tsx](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx).
- **Public Practice Webpage:** [app/[slug]/page.tsx](file:///Users/emanur/doctors-platform/app/[slug]/page.tsx) renders an on-site dispensary feature card when `service_medicine_inventory` is enabled.
- **Backend API:** FastAPI routes under `/api/v1/doctor/pharmacy/*` in [backend/app/api/routes/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py).
- **Database Model:** `medicine_items` mapped via SQLAlchemy in [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py).

---

## 2. Code Map

### Key Files & Responsibilities
- [components/dashboard/PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx): Primary clinic dispensary UI (KPI metrics, search/filter controls, high-contrast paginated table, Add/Edit modal).
- [lib/api.ts](file:///Users/emanur/doctors-platform/lib/api.ts): Typed client API functions (`getPharmacyStats`, `getMedicineInventory`, `createMedicineItem`, `updateMedicineItem`, `deleteMedicineItem`).
- [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py): `MedicineItem` entity with dynamic `calculate_status()`, `purchase_price`, and `unit_price`.
- [backend/app/schemas/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/schemas/pharmacy.py): Pydantic validation schemas (`MedicineItemCreateRequest`, `MedicineItemUpdateRequest`, `PharmacyStatsResponse`).
- [backend/app/services/pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py): Business logic for tenant-scoped CRUD and expiry enrichment.
- [backend/app/api/routes/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py): Authenticated FastAPI endpoints for dispensary management.
- [backend/tests/test_pharmacy.py](file:///Users/emanur/doctors-platform/backend/tests/test_pharmacy.py): Automated test suite covering mandatory selling price, mandatory expiry, and isolation.

### Entry Points and Main Flow
1. **Catalog Query:** `PharmacyTab` mounts -> calls `getPharmacyStats()` and `getMedicineInventory()` in parallel -> renders 4 KPI metric cards and searchable medicine table.
2. **Item Creation:** User clicks "Add Medicine" -> enters clinical formulation, stock, `purchase_price`, mandatory `unit_price` (> 0), and mandatory `expiry_date` -> submits `POST /api/v1/doctor/pharmacy/medicines`.
3. **Item Update:** User clicks the edit pencil on any row -> pre-fills modal -> submits `PUT /api/v1/doctor/pharmacy/medicines/{id}`.
4. **Item Deletion:** User clicks delete trash icon -> confirms -> calls `DELETE /api/v1/doctor/pharmacy/medicines/{id}`.

### Data Models & State
- `MedicineItem`:
  - `name` (str, required), `generic_name` (optional str), `category` (str), `dosage_form` (str)
  - `strength` (optional str), `sku` (optional str), `batch_number` (optional str)
  - `stock_quantity` (int, ge=0), `min_stock_alert` (int, ge=0)
  - `purchase_price` (float, ge=0.0, default=0.0): Clinic procurement cost
  - `unit_price` (float, gt=0.0): Mandatory patient selling price
  - `expiry_date` (date, required): Mandatory expiration date
  - `status`: Computed dynamically (`"out_of_stock"` if `<= 0`, `"low_stock"` if `<= min_stock_alert`, else `"in_stock"`).
  - Enriched flags: `is_expiring_soon` (within 30 days) and `is_expired` (`expiry_date < today`).

---

## 3. Decisions and Gotchas

### Decisions
- **Pure In-Clinic Scope:** No e-commerce home-delivery or courier dispatch pipelines.
- **Mandatory Selling Price & Expiry Date:** `unit_price` must be `> 0.0` and `expiry_date` must be provided on creation. Updates also reject `unit_price <= 0`.
- **Direct Edit / Delete UI:** Removed redundant "Adjust Stock" modal and "Clear Stock" button in favor of direct row editing and deleting.
- **Client-Side Pagination:** The inventory table supports 25, 50, and 100 rows per page with page navigation, preventing DOM lag on large inventories (e.g. 1,000+ items).
- **Indian Rupee Currency:** All monetary values feature the `IndianRupee` (`₹`) prefix.

### Gotchas & Constraints
- **Pydantic Validation (422):** Any API call omitting `unit_price`, setting `unit_price <= 0`, or omitting `expiry_date` returns HTTP 422. Test fixtures must include both valid values.
- **Database Server Default:** `purchase_price` column in `medicine_items` has `server_default="0.0"`. Pre-existing records without explicit purchase prices automatically default to `0.0`.
- **Next.js Dev Cache:** Never run `next build` concurrently with an active `npm run dev` task.

---

## 4. How to Work With It

### Build, Run, and Test Commands
```bash
# Run backend pytest suite (all 162 tests must pass)
ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests

# Run frontend TypeScript type checking
npx tsc --noEmit

# Run ESLint
npm run lint

# Run frontend automated test suites (50 tests)
npm test

# Run frontend development server
npm run dev

# Run backend development server
cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000
```

### Adding a New Field to Medicine Items
1. Add column to `MedicineItem` in [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py).
2. Add schema field to `MedicineItemCreateRequest`, `MedicineItemUpdateRequest`, and `MedicineItemResponse` in [backend/app/schemas/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/schemas/pharmacy.py).
3. Update `_enrich_medicine_response` and `create_medicine` in [backend/app/services/pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py).
4. Update TypeScript interfaces in [lib/api.ts](file:///Users/emanur/doctors-platform/lib/api.ts).
5. Add UI inputs in [components/dashboard/PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx).
6. Add unit test assertions in [backend/tests/test_pharmacy.py](file:///Users/emanur/doctors-platform/backend/tests/test_pharmacy.py).

---

## 5. Open Questions
*None currently open. In-clinic inventory model verified and passing 100% of automated tests.*
