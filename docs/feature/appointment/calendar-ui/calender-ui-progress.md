# Progress: Calendar UI Enhancements & Cleanups

**Plans**: `removal-plan.md`, `google_calendar_removal_plan.md`, `phase3-verification-plan.md`, `calendar_empty_slot_plan.md` | **Base SHA**: `7c324e3` | **Branch**: `calendar-ui` | **Status**: Verified ✅

## 1. Summary & Scope
1. **Appointments & Schedule Tabs Removal (Phase 1)**: Removed obsolete "schedule" and "appointments" navigation tabs and rendering blocks from `DashboardShell` and `page.tsx`. Deleted `AppointmentsTab.tsx`, `ScheduleTab.tsx`, and `components/dashboard/appointments/` (14 files).
2. **Google Calendar Sync Removal (Phase 2)**: Executed `google_calendar_removal_plan.md`. Completely removed obsolete Google Calendar sync UI scaffolding, buttons, modals, and hooks while strictly preserving Google OAuth Sign-In for doctor authentication and backend calendar scheduling APIs.
3. **Calendar Module Enhancement & Hardening (Phase 3)**: Executed `phase3-verification-plan.md`. Standardized 30-minute slot granularity, implemented Option A Hard-Block conflict enforcement across all calendar modal submit handlers, auto-advanced end times (+30m parity), clamped `minutesToTime24` boundary conditions (00:00–23:59), pruned dead code (`getSlotHourKey`), and added comprehensive automated unit and acceptance suites (56 unit tests + 8 QA acceptance scenarios).
4. **Dashboard Navigation Tab Rebranding (Phase 4)**: Renamed the doctor dashboard tab from `calendar` to `appointment` (`id: "calendar"` → `id: "appointment"`, `label: "Calendar"` → `label: "Appointment"`). Updated `DashboardShell.tsx`, `page.tsx`, and `OverviewTab.tsx`, along with the automated navigation test suite in `scripts/test_dashboard_shell.mjs`.
5. **Empty Slot Popup, Editable Working Hours & Dedicated Patient Schema (Phase 5)**: Executed `calendar_empty_slot_plan.md`. Created dedicated database columns for patient vitals (`patient_gender`, `patient_age`, `patient_height`, `patient_weight`, `patient_blood_group`, `patient_address`) with safe Alembic migration `008_add_patient_details_to_appointments.py`. Implemented dynamic, editable doctor working hours (Morning and Evening shifts) with slot recalculation, live daily capacity preview, and interactive WeekView empty-slot cues. Developed modern, responsive dual-tab `SlotActionModal` with 5 strictly mandatory validated fields for booking (Name, Mobile, Gender, Age, Reason) and streamlined single-field Doctor Leave form.

---

## 2. Key Changes (Google Calendar Removal)
- **Component Deletions**:
  - `components/dashboard/calendar/sidebar/GoogleCalendarCard.tsx` (sidebar sync status widget)
  - `components/dashboard/calendar/modals/GoogleCalendarModal.tsx` (mock settings & sync modal)
  - `components/dashboard/calendar/sidebar/SyncNotificationBanner.tsx` (static sync notification banner)
- **Component & Hook Updates**:
  - `QuickActionsCard.tsx`: Removed `onSyncGoogle`, `syncingGoogle` props, `RotateCw` icon, and the "Sync with Google Calendar" action button.
  - `CalendarSidebar.tsx`: Pruned deleted card imports and unused props (`onOpenGoogleModal`, `onSyncGoogle`, `syncingGoogle`).
  - `useCalendarData.ts`: Removed `syncingGoogle` state and `handleSyncGoogle()` callback.
  - `useCalendarModals.ts`: Removed `showGoogleModal` state and `openGoogleModal()` callback.
  - `CalendarTab.tsx`: Removed `GoogleCalendarModal` import/rendering and pruned Google sync props/destructuring.
- **Documentation**:
  - Updated `CALENDAR_UI_DOCUMENTATION.md` (removed Section 10 & 12.5, updated Quick Actions, and renumbered sections).
  - Updated `README.md` calendar component hierarchy tree.

---

## 3. Key Changes (Phase 3 — Calendar Module Enhancement & Hardening)

### 3a. 30-Minute Slot Granularity (`constants.ts`)
- `TIME_ROWS` expanded from hourly to **30-minute intervals** (9:00 AM → 8:30 PM, 24 rows total).
- Added `SLOT_DURATION_MINUTES = 30` constant.
- Introduced `TimeOption30M` interface and `TIME_OPTIONS_30M` array: full 30-min dropdown options (09:00–20:00) for use in modal pickers.
- Mock `DOCTOR_SCHEDULE` data enriched: all dates have half-hour `AVAILABLE`, `APPOINTMENT`, `BLOCKED`, and `LEAVE` slots.

### 3b. Calendar Utility Functions & Time Clamping (`calendarUtils.ts`)
Active time-arithmetic and conflict-detection helpers:
| Function | Purpose | Edge Cases Handled |
|---|---|---|
| `timeToMinutes(time24)` | Converts `"HH:MM"` → total minutes from midnight | Midnight `"00:00"` (0), End of day `"23:59"` (1439), single digit hour, malformed `"abc"` |
| `minutesToTime24(minutes)` | Converts minutes → `"HH:MM"` | Clamped to `[0, 1439]` (00:00–23:59) to prevent midnight rollover |
| `addMinutesToTime(time24, mins)` | Adds N minutes (default 30) to a time string | Clamped at `"23:59"`; defaults to +30 min |
| `getSlot30MinKey(time24)` | Maps a 24h time to its 30-min row label (12h format) | Empty string, noon/midnight transitions |
| `getTimeRowRange(timeRow)` | Parses a row label like `"9:30 AM"` → `{ start, end }` in 24h | Noon `"12:00 PM"`, Midnight `"12:30 AM"`, Evening `"8:30 PM"` |
| `isIntervalOverlapping(a1,a2,b1,b2)` | Checks if two `[start, end)` intervals overlap | Adjacent non-overlapping, contained, identical, inverted ranges |
| `doesEventOverlapSlot(event, slotStart, slotEnd)` | Checks if a `CalendarEvent` hits a slot window | Boundary checks, cross-slot intervals |
| `findConflictingEvents(start, end, events)` | Returns all blocking events (`APPOINTMENT`, `LEAVE`, `HOLIDAY`, `BLOCKED`) | Skips `CANCELLED` and `AVAILABLE` types |

- **Dead Code Elimination**: Removed unused legacy function `getSlotHourKey`.

### 3c. Modal Hard-Block Conflict Enforcement (`useCalendarModals.ts`)
Submit handlers now enforce strict Option A Hard-Block conflict policy before API dispatch:
- **`handleAddAppointmentSubmit`**: Blocks submission if `findConflictingEvents` detects overlapping appointments, doctor leaves, clinic holidays, or blocked intervals; returns toast error with conflicting entity name/reason.
- **`handleAddAvailabilitySubmit`**: Blocks submission if window overlaps doctor leaves or clinic holidays; validates `end > start` and minimum 30-minute duration.
- **`handleBlockSubmit`**: Blocks submission if window collides with existing booked appointments; returns toast specifying number of booked patients requiring reschedule.

---

## 4. Key Changes (Dashboard Tab Rename: `calendar` → `appointment`)
- **Navigation & Dashboard Shell Updates**:
  - `components/dashboard/DashboardShell.tsx`:
    - Updated `DashboardTabId` type union: `"calendar"` → `"appointment"`.
    - Updated navigation definition: `{ id: "calendar", label: "Calendar", icon: Calendar }` → `{ id: "appointment", label: "Appointment", icon: Calendar }`.
  - `app/dashboard/page.tsx`:
    - Updated conditional mounting: `{activeTab === "appointment" && <CalendarTab ... />}`.
  - `components/dashboard/OverviewTab.tsx`:
    - Updated navigation actions: replaced `onNavigateTab("calendar")` with `onNavigateTab("appointment")` across Today's Appointments table and Operational Calendar quick actions.
- **Automated Test Suite Updates**:
  - `scripts/test_dashboard_shell.mjs`:
    - Updated Suite 3 mock tab ID assertions: `["overview", "appointment", "schedule", "appointments", "profile"]`.

---

## 5. Key Changes (Phase 5 — Empty Slot Popup, Editable Working Hours & Dedicated Schema)

### 5a. Dedicated Database Columns & Migration
- **Model** (`backend/app/models/appointment.py`):
  Added dedicated columns to `Appointment`:
  - `patient_gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)`
  - `patient_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)`
  - `patient_height: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)`
  - `patient_weight: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)`
  - `patient_blood_group: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)`
  - `patient_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)`
- **Alembic Migration** (`backend/alembic/versions/008_add_patient_details_to_appointments.py`):
  Adds 6 columns to `appointments` table with safe bidirectional rollback (`downgrade` drops the 6 columns in batch mode). Tested and verified forward and backward.
- **Pydantic Schemas** (`backend/app/schemas/appointment.py` & `backend/app/schemas/calendar.py`):
  - `AppointmentCreateRequest`: Added `patient_gender` (validated against `"Male" | "Female" | "Other"`), `patient_age` (validated `0 <= age <= 130`), `patient_height`, `patient_weight`, `patient_blood_group`, `patient_address`.
  - `AppointmentResponse`: Includes all 6 dedicated patient columns.
  - `CalendarEvent`: Added patient vitals fields so calendar day streams serialize them to frontend clients.
- **Services** (`appointment_service.py` & `calendar_service.py`):
  - `create_appointment`: Persists all 6 dedicated patient columns into SQLAlchemy `Appointment` entity.
  - `get_doctor_calendar`: Injects patient details and clinical notes into calendar appointment events.

### 5b. Editable Doctor Working Hours Management
- **Utilities & State** (`components/dashboard/calendar/calendarUtils.ts`):
  - `WorkingHoursShift`: `{ id, label, start, end, enabled }`.
  - `WorkingHoursConfig`: `{ shifts: WorkingHoursShift[] }`.
  - `DEFAULT_WORKING_HOURS`: Morning Shift (10:00 AM – 1:00 PM, 6 slots), Evening Shift (4:00 PM – 8:00 PM, 8 slots).
  - `calculateShiftSlotCount(start, end)`: Calculates exact 30-minute slot count.
  - `getDoctorWorkingHours()` / `saveDoctorWorkingHours()`: Persistent client storage via `localStorage`.
  - `isSlotWithinWorkingHours(dateStr, slotStart, slotEnd, config)`: Evaluates dynamically against doctor's active customized shifts and enforces Sunday clinic closure.
- **Modal** (`components/dashboard/calendar/modals/EditWorkingHoursModal.tsx`):
  - Toggle morning & evening shifts on/off.
  - Select start and end times via 30-minute interval dropdowns (`TIME_OPTIONS_30M`).
  - Total Daily Capacity badge: dynamically calculates total slots and minutes.
  - Overlap and inverted range guard validation.
- **Sidebar Card** (`components/dashboard/calendar/sidebar/WorkingHoursCard.tsx`):
  - Dynamically renders all enabled shifts with slot counts.
  - "Edit Hours" button in header opens `EditWorkingHoursModal`.

### 5c. Dual-Tab Slot Action Modal & Empty Slot Trigger
- **Modal** (`components/dashboard/calendar/modals/SlotActionModal.tsx`):
  - **Context Banner**: Selected date, 30-min window, and slot status badge.
  - **Tab Switcher**: "Book Patient" (User icon) vs "Doctor Leave" (Coffee icon).
  - **Tab 1 (Book Patient)**:
    - 5 Mandatory Fields with red asterisk: Patient Name (`min_length >= 1`), Mobile Number (`min_length >= 5`), Gender (`Male`, `Female`, `Other`), Age (`0` to `130`), Visit Reason (`min_length >= 1`).
    - Optional Clinical Vitals: Blood Group (A+, A-, B+, B-, O+, O-, AB+, AB-), Height, Weight, Address, Short Clinical Notes.
    - Submit guard: Button disabled until all 5 mandatory fields are valid.
  - **Tab 2 (Doctor Leave)**:
    - Streamlined form with only the Leave Reason field.
    - Quick common reason selectors + custom reason input.
    - Submits doctor schedule leave for this exact 30-minute slot.
  - **Conflict Detection**: Real-time detection of overlapping events with collision alert banner.
- **WeekView Integration** (`components/dashboard/calendar/views/WeekView.tsx`):
  - Evaluates empty cells against `isSlotWithinWorkingHours`.
  - Empty cells within working hours show dashed blue border, cursor pointer, and hover prompt `+ Book / Leave`.
  - Clicking triggers `openSlotActionModal(day.dateStr, slotStart, slotEnd)`.
- **CalendarTab & Hooks** (`useCalendarModals.ts` & `CalendarTab.tsx`):
  - Handlers `handleSlotBookingSubmit` and `handleSlotLeaveSubmit` dispatch API requests, show toast confirmation, and refresh the calendar stream.

---

## 6. Decisions, Deviations & Assumptions
- **Decision (Pydantic Schema Backward Compatibility)**: In `AppointmentCreateRequest`, new patient columns are marked `Optional` with validators (validating gender values and age bounds when provided), while the frontend `SlotActionModal` strictly enforces all 5 mandatory fields (Name, Mobile, Gender, Age, Reason) before allowing submission.
  - *Reasoning*: Prevents breaking existing tests in `test_productionization.py` and `test_appointment_lifecycle.py` that create basic test appointments without clinical demographics, while ensuring 100% compliance with user requirements in the UI.
- **Decision (Dual Shift Storage)**: Config is persisted in `localStorage` with fallback to `DEFAULT_WORKING_HOURS`, allowing immediate UI recalculation without requiring extra backend auth-bound config endpoints.
- **Deviations from Plan**: None.
- **Assumptions**: Clinic operating hours follow doctor's configured morning and evening shifts; Sundays remain closed by standard clinic policy.

---

## 7. Verification Scorecard

| Suite / Check | Command | Result | Notes |
|---|---|---|---|
| **TypeScript Compilation** | `npx tsc --noEmit` | 🟢 PASS | 0 errors |
| **ESLint Validation** | `npm run lint` | 🟢 PASS | 0 warnings, 0 errors |
| **Next.js Production Build** | `npm run build` | 🟢 PASS | 8/8 routes compiled |
| **Backend Lifecycle & Pytest Suite** | `pytest backend/tests/test_appointment_lifecycle.py backend/tests/test_calendar.py` | 🟢 PASS | 46/46 passed |
| **Alembic Migration Bidirectional Test** | `alembic downgrade -1 && alembic upgrade head` | 🟢 PASS | 008 upgrade & downgrade verified |
| **Appointments Unit Suite** | `node scripts/test_appointments_comprehensive.mjs` | 🟢 PASS | 30/30 passed |
| **Calendar Utils Unit Suite** | `node scripts/test_calendar_utils.mjs` | 🟢 PASS | 32/32 passed (7/7 suites) |
| **Acceptance Scenarios Suite (C1–C7 & D2)** | `node scripts/verify_calendar_qa_scenarios.mjs` | 🟢 PASS | 8/8 passed |
| **Empty Slot & Working Hours Acceptance Suite (E1–E5)** | `node scripts/verify_empty_slot_plan.mjs` | 🟢 PASS | 5/5 passed (100%) |
| **Live Backend API & OpenAPI Docs** | `http://127.0.0.1:8000/docs`, `http://127.0.0.1:8000/openapi.json` | 🟢 PASS | HTTP 200 OK |

---

## 8. Manual Verification Guide & Acceptance
1. **Editable Working Hours**:
   - In doctor dashboard, navigate to Appointment/Calendar tab.
   - In right sidebar under "Working Hours", click **Edit Hours**.
   - Adjust Morning Shift to `09:00 - 12:30`. Observe live total daily capacity update to 15 slots.
   - Click "Save Working Hours" and verify toast notification.
2. **Empty Slot Click Trigger**:
   - In WeekView, observe 9:00 AM – 9:30 AM slot is now highlighted as active working hours with dashed border.
   - Hover over the slot to see `+ Book / Leave` cue.
   - Click the slot. Verify `SlotActionModal` opens with the selected date and 9:00 AM – 9:30 AM.
3. **Mandatory Booking Form Validation**:
   - Check that Name, Mobile, Gender, Age, and Visit Reason have red asterisks `*`.
   - Verify "Book Appointment" button is disabled until all 5 fields are filled and valid.
   - Enter Name: "Neha Verma", Mobile: "+91 98765 43210", Gender: "Female", Age: "28", Reason: "General Consultation", plus optional vitals (Height: 165 cm, Weight: 58 kg, Blood Group: B+).
   - Click "Book Appointment". Verify appointment is created and rendered in the slot.
4. **Doctor Leave Tab**:
   - Click another empty working-hour slot.
   - Switch to the "Doctor Leave" tab.
   - Verify only the "Leave Reason" selector/input is present.
   - Select "Medical Conference / CME" and click "Mark Leave for this Slot".
   - Verify amber leave badge renders on the calendar.

---

## 9. Rollback & Migration Instructions
- **Code Rollback**: `git revert HEAD`
- **Database Rollback**:
  ```powershell
  cd backend
  .\.venv\Scripts\alembic.exe downgrade 007_appointment_active_slot_unique_index
  ```
- **Data Implications**: Reverting the migration drops the 6 optional columns (`patient_gender`, `patient_age`, `patient_height`, `patient_weight`, `patient_blood_group`, `patient_address`) from the `appointments` table without affecting core appointment date, time, patient name, contact, reason, or status.
