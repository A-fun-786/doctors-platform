# Developer Guidelines (AGENTS.md)

*Last updated: November 15, 2026*

## Conventions & Rules
- **Pure In-Clinic Scope:** The platform operates for doctor clinics, appointments, schedules, staff, and in-clinic dispensary stock. **Do not reintroduce e-commerce home-delivery or courier dispatch pipelines.**
- **Dispensary Constraints:** In medicine inventory, `unit_price` (> 0.0) and `expiry_date` are strictly mandatory; `purchase_price` tracks clinic procurement cost; currency is Indian Rupee (`₹`). Wishlist is strictly for unlisted medicines (not out-of-stock items) to track patient demand frequency (`request_count`).
- **Tenant Isolation:** Every operational table (`schedules`, `appointments`, `staff_members`, `medicine_items`, `medicine_wishlist_items`) must be scoped to `doctor_id` / `tenant_id`. Never execute queries without tenancy filters.
- **Strict Verification:** Always run `ALLOW_MOCK_AUTH=true ./backend/.venv/bin/pytest backend/tests` and `npx tsc --noEmit` before concluding work.
- **Next.js Dev Server Integrity:** Never run `next build` concurrently with an active `npm run dev` task; it corrupts `.next/` hot-module chunks.
- **Git Safety:** Never push to `origin` unless the user explicitly commands it.

## "If You Need to Change X, Look at Y First"
- **Dispensary Stock & Wishlist UI:** Edit [PharmacyTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/PharmacyTab.tsx). Deep docs: [docs/PHARMACY_MANAGEMENT.md](file:///Users/emanur/doctors-platform/docs/PHARMACY_MANAGEMENT.md).
- **Dispensary Stock & Wishlist Backend:** Edit [pharmacy_service.py](file:///Users/emanur/doctors-platform/backend/app/services/pharmacy_service.py) and [pharmacy.py routes](file:///Users/emanur/doctors-platform/backend/app/api/routes/pharmacy.py).
- **Public Patient Practice Page:** Edit [app/[slug]/page.tsx](file:///Users/emanur/doctors-platform/app/[slug]/page.tsx).
- **Calendar & Appointment Booking:** Edit [CalendarTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/CalendarTab.tsx) and [calendarUtils.ts](file:///Users/emanur/doctors-platform/components/dashboard/calendar/calendarUtils.ts). Deep docs: [docs/APPOINTMENT_SYSTEM.md](file:///Users/emanur/doctors-platform/docs/APPOINTMENT_SYSTEM.md).
- **Staff & Permission Roles:** Edit [StaffTab.tsx](file:///Users/emanur/doctors-platform/components/dashboard/StaffTab.tsx) and [staff_service.py](file:///Users/emanur/doctors-platform/backend/app/services/staff_service.py).
- **Android App Template:** Edit [HomeScreen.kt](file:///Users/emanur/doctors-platform/android-template/app/src/main/kotlin/com/docspace/template/ui/screens/HomeScreen.kt).

## Files Not to Touch Without Direct Instructions
- `backend/alembic/versions/` (unless creating a new sequential migration).
- `backend/app/core/security.py` (authentication and PBKDF2 hashing).
- `scripts/test_*.mjs` (regression test suites).

