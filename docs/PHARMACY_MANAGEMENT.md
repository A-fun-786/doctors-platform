# Pharmacy & Dispensary Inventory Management

*Last updated: November 15, 2026*

## 1. Overview
The **Dispensary & Medicine Inventory Management** module provides healthcare practitioners with on-site clinical stock tracking, purchase vs. sale pricing, threshold warnings, batch tracking, expiry monitoring, and an **Unlisted Medicine Demand Wishlist**.

### What It Does & Why It Exists
Medical practices dispense medications and clinical consumables during in-person patient consultations. Practitioners need:
- **Internal Dispensary Catalog:** In-clinic stock of tablets, syrups, injectables, ointments, and consumables (`MedicineItem`).
- **Dual-Price Tracking:** Clinic procurement cost (`purchase_price`) and dispensed sale price (`unit_price`). In dispensary inventory, `unit_price` (> 0.0) and `expiry_date` are strictly mandatory; currency is Indian Rupee (`₹`).
- **Real-Time Stock Alerts:** Automatic stock status calculation (`in_stock`, `low_stock`, `out_of_stock`) based on `current_stock` versus `min_stock_alert`.
- **Expiry Monitoring:** Flagging expired items and near-expiry medications (expiring within 30 days) to prevent dispensing compromised drugs.
- **Unlisted Medicine Demand Wishlist:** When patients ask for medications the clinic does not currently carry, doctors and staff log them into a separate demand tracker (`MedicineWishlistItem`). It tracks patient inquiry frequency (`request_count`), aggregates demand ranking, auto-increments on duplicate patient requests, and allows 1-click graduation (`+ Stock`) into active inventory when stock arrives.

### Architecture Placement
- **Frontend Dashboard:** [PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx) mounted inside [DashboardShell.tsx](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx) under the "Dispensary Stock" tab. Features a sub-navigation toggle between `Live Dispensary Stock` and `Unlisted Medicine Wishlist`.
- **Public Patient Practice Page:** [app/[slug]/page.tsx](file:///Users/emanur/doctors-platform/app/[slug]/page.tsx) renders an on-site dispensary feature card when `service_medicine_inventory` is enabled.
- **Backend API Routes:** FastAPI router at `/api/v1/doctor/pharmacy/*` in [backend/app/api/routes/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py).
- **Backend Service Layer:** Business logic in [backend/app/services/pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py).
- **Database Models:** Multi-tenant entities `medicine_items` and `medicine_wishlist_items` in [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py).

---

## 2. Code Map

### Key Files & Responsibilities
- [components/dashboard/PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx): React client component with dual sub-tabs (`Live Stock` and `Wishlist`), KPI cards, demand priority badges, search-empty banner prompts, stock adjustment, pagination, and modals.
- [lib/api.ts](file:///Users/emanur/doctors-platform/lib/api.ts): Client fetch abstractions for inventory CRUD and wishlist management (`getMedicineWishlist`, `createWishlistItem`, `incrementWishlistItem`, `updateWishlistItem`, `deleteWishlistItem`, `convertWishlistItem`).
- [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py): SQLAlchemy models `MedicineItem` and `MedicineWishlistItem`.
- [backend/app/schemas/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/schemas/pharmacy.py): Pydantic request/response schemas, validators, and stats representations.
- [backend/app/services/pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py): Service routines executing database operations scoped by `doctor_id` / `tenant_id`.
- [backend/app/api/routes/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py): FastAPI route handlers enforcing authentication and role-based doctor access.
- [backend/tests/test_pharmacy.py](file:///Users/emanur/doctors-platform/backend/tests/test_pharmacy.py): Automated test suite for inventory validations, stock updates, wishlist CRUD, multi-tenant isolation, and inventory conversion.

### Entry Points and Main Flows
1. **Dispensary Dashboard Load:**
   - User navigates to Dispensary Stock -> `PharmacyTab` executes `fetchData()` -> concurrently requests `GET /api/v1/doctor/pharmacy/stats`, `GET /api/v1/doctor/pharmacy/medicines`, and `GET /api/v1/doctor/pharmacy/wishlist`.
2. **Logging Unlisted Medicine Inquiries:**
   - Patient asks for an unlisted drug -> Staff searches in live inventory; finding 0 results displays banner: *"`{name}` was not found in your dispensary stock. Did a patient inquire about this medicine? [ + Add to Demand Wishlist ]"*.
   - Staff submits modal -> `POST /api/v1/doctor/pharmacy/wishlist` -> `pharmacy_service.create_or_increment_wishlist_item`.
   - If an unlisted item with the same name exists (case-insensitive) for the clinic, the service increments `request_count += 1`, appends any new clinical notes, and updates `last_requested_at`.
3. **Manual Patient Request Increment:**
   - Another patient asks for a listed wishlist item -> staff clicks `+1 Request` -> calls `POST /api/v1/doctor/pharmacy/wishlist/{id}/increment` -> increments `request_count`.
4. **Graduation from Wishlist to Live Stock:**
   - Clinic procures the unlisted drug -> staff clicks `+ Stock` on wishlist row -> opens Add Medicine modal pre-filled with name, dosage, and category, holding `convertingWishlistId`.
   - On medicine save (`POST /api/v1/doctor/pharmacy/medicines`), the UI immediately invokes `POST /api/v1/doctor/pharmacy/wishlist/{id}/convert/{medicine_id}` -> marks wishlist item as `converted` and records foreign key `converted_medicine_id`.

### Data Models and Important State

#### `MedicineItem` (`medicine_items` table)
- `id` (String UUID, PK)
- `doctor_id` (String UUID, FK `doctors.id`, indexed)
- `tenant_id` (String UUID, FK `tenants.id`, indexed)
- `name` (String, required)
- `generic_name` (String, optional)
- `category` (String: Tablet, Capsule, Syrup, Injection, Ointment, Drops, Consumable, Other)
- `dosage_form` & `strength` (e.g., "Tablet", "500mg")
- `batch_number` (String, optional)
- `expiry_date` (Date, strictly mandatory)
- `purchase_price` (Float, clinic procurement cost, optional)
- `unit_price` (Float, mandatory > 0.0, dispensed retail price)
- `current_stock` (Integer, default 0)
- `min_stock_alert` (Integer, default 10)
- Calculated Statuses:
  - `expired`: `expiry_date < today`
  - `near_expiry`: `today <= expiry_date <= today + 30 days`
  - `out_of_stock`: `current_stock == 0`
  - `low_stock`: `0 < current_stock <= min_stock_alert`
  - `in_stock`: `current_stock > min_stock_alert`

#### `MedicineWishlistItem` (`medicine_wishlist_items` table)
- `id` (String UUID, PK)
- `doctor_id` (String UUID, FK `doctors.id`, indexed, cascade delete)
- `tenant_id` (String UUID, FK `tenants.id`, indexed)
- `name` (String, required)
- `generic_name`, `category`, `dosage_form`, `strength` (Optional clinical details)
- `request_count` (Integer, default 1, tracks inquiry frequency)
- `notes` (Text, clinical indications or patient notes)
- `status` (String: `"requested"` or `"converted"`, indexed)
- `last_requested_at` (DateTime timezone-aware, defaults to `now()`)
- `converted_medicine_id` (String UUID, FK `medicine_items.id`, SET NULL)

---

## 3. Decisions and Gotchas

### Decisions & Rationale
- **Separation of Wishlist from Live Stock:**
  - *Alternative Rejected:* Reusing `medicine_items` with a flag or 0 stock.
  - *Why:* Out-of-stock items are medicines the clinic regularly stocks that happen to have 0 inventory. The wishlist is for medicines the clinic does *not* carry, preventing pollution of procurement SKU lists, batch audits, and expiry tracking.
- **Auto-Increment on Duplicate Inquiry:**
  - When staff inputs "Azithromycin 500mg" and another staff logs "azithromycin 500mg", the system auto-increments `request_count` rather than generating duplicate conflicting rows.
- **Strict In-Clinic Scope:**
  - Courier delivery addresses, delivery dispatch fees, and third-party e-commerce carts are strictly prohibited. The system manages physical on-site clinical stock.
- **Strict Price & Expiry Enforcement:**
  - `unit_price` must be `> 0.0` and `expiry_date` is required at creation time to prevent unpriced or unmonitored dispensing.

### Gotchas & Constraints
- **SQLite vs Postgres Case-Insensitive Matching:**
  - In SQLite (local testing), `func.lower(MedicineWishlistItem.name) == name.strip().lower()` is used rather than `.ilike()`, ensuring cross-database compatibility without collation errors.
- **Multi-Tenant Isolation:**
  - All queries across `medicine_items` and `medicine_wishlist_items` MUST include `.filter(Model.doctor_id == current_doctor.id)`. Leaking cross-doctor catalog entries is a severe violation.
- **Conversion Cascade Safety:**
  - `converted_medicine_id` uses `ondelete="SET NULL"`. If a converted medicine is later deleted from inventory, the historical wishlist record remains intact with status `"converted"`.
- **Note Appending:**
  - When a duplicate wishlist item is logged with new notes, the service appends the new text prefixed with a timestamp (`[YYYY-MM-DD HH:MM]`) to retain patient context without overwriting previous indications.

---

## 4. How to Work With It

### Build, Run, and Test Commands
All commands verified and run directly in the project environment:
```bash
# 1. Run backend pytest suite (all 165 tests must pass)
ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests

# 2. Run TypeScript compilation check (0 errors required)
npx tsc --noEmit

# 3. Run ESLint check (0 warnings, 0 errors required)
npm run lint

# 4. Run frontend test suites (50 checks across 9 scripts)
npm test

# 5. Start backend development server
cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000

# 6. Start frontend development server
npm run dev
```

### Config & Flags
- `ALLOW_MOCK_AUTH=true`: Allows backend test runner to bypass OAuth/external auth providers and inject mock doctor headers.
- `service_medicine_inventory`: Doctor profile feature toggle (`doctors.service_medicine_inventory`). Controls public visibility of dispensary services on `app/[slug]/page.tsx`.

### Extending Common Functionality

#### Example: Adding a Field to `MedicineWishlistItem` (e.g. `preferred_brand`)
1. **Model:** In [backend/app/models/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/models/pharmacy.py), add:
   ```python
   preferred_brand = Column(String(255), nullable=True)
   ```
2. **Schema:** In [backend/app/schemas/pharmacy.py](file:///Users/emanur/doctors-platform/backend/app/schemas/pharmacy.py), add `preferred_brand: Optional[str] = None` to `MedicineWishlistItemCreateRequest`, `MedicineWishlistItemUpdateRequest`, and `MedicineWishlistItemResponse`.
3. **Service:** In [backend/app/services/pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py), map `preferred_brand` during creation and updates.
4. **Frontend:** Update `MedicineWishlistItem` and `MedicineWishlistCreateInput` in [lib/api.ts](file:///Users/emanur/doctors-platform/lib/api.ts), then add the input field in the modal inside [PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx).
5. **Tests:** Update [backend/tests/test_pharmacy.py](file:///Users/emanur/doctors-platform/backend/tests/test_pharmacy.py) to assert `preferred_brand`.

---

## 5. Open Questions
*None currently open. In-clinic scope, unlisted wishlist workflows, mandatory selling price, and multi-tenant isolation are fully defined and tested.*

