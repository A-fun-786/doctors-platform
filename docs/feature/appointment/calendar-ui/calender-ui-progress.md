# Progress: Calendar UI Enhancements & Cleanups

**Plans**: `removal-plan.md`, `google_calendar_removal_plan.md`, `phase3-verification-plan.md`, `calendar_empty_slot_plan.md`, `CALENDAR_SLOT_DETAILS_DRAWER_PLAN.md`, `dayview_legend_bar_plan.md`, `appointment_calender_plan.md` | **Base SHA**: `1fe949c` | **Branch**: `calendar-ui` | **Status**: Verified ✅

## 1. Summary & Scope
1. **Appointments & Schedule Tabs Removal (Phase 1)**: Removed obsolete "schedule" and "appointments" navigation tabs and rendering blocks from `DashboardShell` and `page.tsx`. Deleted `AppointmentsTab.tsx`, `ScheduleTab.tsx`, and `components/dashboard/appointments/` (14 files).
2. **Google Calendar Sync Removal (Phase 2)**: Executed `google_calendar_removal_plan.md`. Completely removed obsolete Google Calendar sync UI scaffolding, buttons, modals, and hooks while strictly preserving Google OAuth Sign-In for doctor authentication and backend calendar scheduling APIs.
3. **Calendar Module Enhancement & Hardening (Phase 3)**: Executed `phase3-verification-plan.md`. Standardized 30-minute slot granularity, implemented Option A Hard-Block conflict enforcement across all calendar modal submit handlers, auto-advanced end times (+30m parity), clamped `minutesToTime24` boundary conditions (00:00–23:59), pruned dead code (`getSlotHourKey`), and added comprehensive automated unit and acceptance suites (56 unit tests + 8 QA acceptance scenarios).
4. **Dashboard Navigation Tab Rebranding (Phase 4)**: Renamed the doctor dashboard tab from `calendar` to `appointment` (`id: "calendar"` → `id: "appointment"`, `label: "Calendar"` → `label: "Appointment"`). Updated `DashboardShell.tsx`, `page.tsx`, and `OverviewTab.tsx`, along with the automated navigation test suite in `scripts/test_dashboard_shell.mjs`.
5. **Empty Slot Popup, Editable Working Hours & Dedicated Patient Schema (Phase 5)**: Executed `calendar_empty_slot_plan.md`. Created dedicated database columns for patient vitals (`patient_gender`, `patient_age`, `patient_height`, `patient_weight`, `patient_blood_group`, `patient_address`) with safe Alembic migration `008_add_patient_details_to_appointments.py`. Implemented dynamic, editable doctor working hours (Morning and Evening shifts) with slot recalculation, live daily capacity preview, and interactive WeekView empty-slot cues. Developed modern, responsive dual-tab `SlotActionModal` with 5 strictly mandatory validated fields for booking (Name, Mobile, Gender, Age, Reason) and streamlined single-field Doctor Leave form.
6. **Calendar Slot Details & Rescheduling Drawer with Full Patient Vitals & Leave Management (Phase 6)**: Executed `CALENDAR_SLOT_DETAILS_DRAWER_PLAN.md`. Built a high-performance, accessible right-side slide-in drawer (`CalendarDrawer.tsx`) triggered on appointment and leave slot clicks without leaving the calendar view or disrupting scroll/view state. Displays full patient demographics and clinical vitals captured during booking (Height, Weight, Blood Group, Age, Gender, Address, Notes, Reason, Contact) with 1-click copy buttons for Patient ID, Doctor ID, and Appointment ID. Integrates an inline appointment rescheduling sub-panel (`AppointmentRescheduleForm.tsx`, `SlotSelectorGrid.tsx`, `RescheduleConfirmModal.tsx`) with conflict checking against working hours, and a dedicated doctor leave management panel (`LeaveDetailsPanel.tsx`) with prominent Leave ID and immediate slot restoration.
7. **Week Calendar UI Enhancements, Bold Slot Typography & Top Legend Bar (Phase 7)**: Executed week calendar UI refinements. Replaced horizontal scrolling layout with a responsive, full-width CSS grid (`w-full grid-cols-[68px_repeat(7,minmax(0,1fr))]`), ensuring all 7 days and 24 time rows render simultaneously without any horizontal scrollbar. Standardized bold monospace typography across all hourly and half-hourly time labels as well as all event chip time intervals. Removed all `Plus` icons from empty slot cues in favor of streamlined hover cues (`Book / Leave` within shifts, `Add Slot` outside shifts). Removed hardcoded Sunday closure overlays to enable full 7-day slot visibility, and repositioned the operational color-coded legend bar to the top of the calendar view for immediate visual orientation.
8. **Real Calendar Date Synchronization & Google Calendar Mini-Calendar Alignment (Phase 8)**: Fixed a critical timezone-offset bug in calendar date calculation where `.toISOString().split("T")[0]` on local midnight dates shifted dates backwards by 1 day in positive UTC timezones. Replaced with robust, timezone-immune `formatDateToYYYYMMDD` and `parseYYYYMMDD` utilities. Redesigned `MiniCalendar.tsx` to authentically replicate Google Calendar: single-letter day-of-week headers (`M`, `T`, `W`, `T`, `F`, `S`, `S`), circular day badges, prominent real-time date highlight without text clutter, soft selection circle for non-current days, active week row tinting, and appointment dot indicators. Streamlined `CalendarSidebar.tsx` by removing the redundant `+ New Appointment` / `+ Create` button and strictly omitting the textual word "Today" from banners, headers, and buttons, maintaining an uncluttered, distraction-free operational sidebar.
9. **Clean Calendar Slots: Pure Patient Name Display, Empty Slot Uniformity & Zero Break Time Mention (Phase 9)**: Executed clean calendar slots refinements. Inside booked appointment slots in WeekView, stripped out all secondary time ranges and visit reasons to prevent vertical clipping, displaying solely the patient's name in bold high-contrast typography. Streamlined unbooked intervals to render as uniform empty slots with 1-click booking affordance. Completely eliminated all "Break" / "Break Time" / "Lunch Break" banners to maintain an uninterrupted schedule view. In DayView, rendered appointment cards with prominent patient name and visit reason alongside clean empty slot triggers.
10. **DayView Top Legend Bar Integration (Phase 10)**: Integrated the operational, color-coded calendar legend bar at the very top of `DayView.tsx` with complete visual, semantic, and styling parity with `WeekView.tsx`. Positioned edge-to-edge above the Day Schedule Header, it provides instant visual orientation for Appointment (Patient - blue), Empty Slot (Click to Book - dashed white), Doctor Leave (amber), and Blocked Period (purple) alongside the 30-Minute Operating Intervals indicator. This completely eliminates visual and layout dissonance when switching between Day and Week views.
11. **Exclusive Working Hours Slot Display in DayView & WeekView (Phase 11)**: Eliminated non-working off-hour rows (9:00 AM – 10:00 AM, 1:00 PM – 4:00 PM inter-shift closure, and 8:00 PM – 9:00 PM) from both DayView and WeekView. Both calendar views now render exclusively the doctor's configured active working shifts (e.g. Morning Shift: 10:00 AM – 1:00 PM and Evening Shift: 4:00 PM – 8:00 PM, 14 active slots total) plus any special booked events. Empty slots are displayed strictly during active operational clinic hours, providing clean, confusion-free booking workflows with 100% schedule consistency across views.
12. **Database Migration & Doctor Working Hours Persistence (appointment_calender_plan.md Phase 1)**: Executed Phase 1 of `appointment_calender_plan.md`. Added Alembic migration `009_add_working_hours_to_doctor.py` introducing a `working_hours` JSON column on the `doctors` table with bidirectional `upgrade()` and `downgrade()` routines, automated fallback seeding for existing rows, and dialect-neutral text binding supporting SQLite and PostgreSQL (`--sql` verified). Updated SQLAlchemy `Doctor` model to declare `working_hours: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)`. Created robust Pydantic schemas (`WorkingHoursShift`, `DoctorWorkingHoursUpdate`, `DoctorWorkingHoursResponse`) with 30-minute interval validation, start < end enforcement, non-overlapping active shift detection, and max 4 shifts per day ceiling. Added `GET /api/v1/doctor/working-hours` and rate-limited `PUT /api/v1/doctor/working-hours` (`30/minute`) with cache invalidation (`invalidate_slot_cache`) and structured telemetry logging (`doctor.working_hours_updated`). Added automated backend pytest suite (`backend/tests/test_working_hours_engine.py`) with 10 unit and migration tests (136/136 backend tests passing).
13. **Slot Generation Engine Harmonization (appointment_calender_plan.md Phase 2)**: Executed Phase 2 of `appointment_calender_plan.md`. Enhanced `generate_available_slots` in `backend/app/services/schedule_service.py` to enforce explicit schedule precedence over recurring shifts, fallback to doctor configured `working_hours` when no date-specific `AVAILABLE` entries exist, evaluate ISO weekday closure (`closed_days`), filter out expired intervals on the current date (`end_time <= now.time()`), and preserve subtraction of leaves, holidays, blocked windows, and booked appointments. Expanded test suite in `backend/tests/test_working_hours_engine.py` (15/15 tests passing, 141/141 full suite passing).
14. **Break Time Slot Standardization & Centralized String Architecture (Phase 12)**: Executed break time slot standardization and single-string architecture across calendar views and modals. Fully eliminated "lunch" and "rest" vocabulary across the codebase in favor of strictly "Break Time". Removed break display from the sidebar "Working Hours" card (`WorkingHoursCard.tsx`) so it strictly displays doctor active shifts. Established single source of truth string constants (`BREAK_TIME_LABEL`, `BREAK_TIME_BADGE`, `BREAK_TIME_SUBTITLE`) in `constants.ts` and unified formatter `formatBreakTimeTitle` in `calendarUtils.ts`. Updated `DayView.tsx` to match `WeekView.tsx` with a single-line horizontal card layout (`BREAK TIME (1:00 PM – 4:00 PM) • Clinic break interval (no patient booking)`), eliminating multi-line clutter and text repetition. Maintained dynamic break calculations in the "Customize Working Hours" modal (`EditWorkingHoursModal.tsx`). Verified via comprehensive automated test suite `scripts/test_break_time_suite.mjs` (16/16 passed, 100%).
15. **Complete Calendar Sidebar Quick Actions Card Elimination (Phase 13)**: Completely eliminated `QuickActionsCard` and its fast-action triggers ('Add Appointment' and 'Block Time / Leave') from the calendar sidebar. Removed component file `QuickActionsCard.tsx`. Pruned `QuickActionsCard` import, props (`onAddAppointment`, `onBlockTime`), and JSX rendering block from `CalendarSidebar.tsx`. Cleaned up `<CalendarSidebar />` invocation in `CalendarTab.tsx` by removing unused callback props and updating comments. Streamlined the calendar sidebar to strictly contain the Google Calendar `MiniCalendar` and active `WorkingHoursCard`. Validated via automated unit test suite `scripts/test_sidebar_quick_actions_clean.mjs` (11/11 passed, 100%) and TypeScript compiler check (`npx tsc --noEmit`, 0 errors).

---

## 2. Key Changes (Quick Actions Removal — Phase 4)

### 2a. Component Deletions & Refactoring
- **Deleted**: `components/dashboard/calendar/sidebar/QuickActionsCard.tsx` (38 lines).
- **`components/dashboard/calendar/sidebar/CalendarSidebar.tsx`**:
  - Removed `QuickActionsCard` import and `<QuickActionsCard />` rendering.
  - Tightened `interface CalendarSidebarProps` to strictly require `miniCalMonth`, `setMiniCalMonth`, `miniCalDays`, and `onSelectDate`.
  - Pruned `onAddAppointment` and `onBlockTime` props from interface and component parameter destructuring.
  - Preserved `MiniCalendar` and `WorkingHoursCard` in responsive layout (`xl:col-span-3 space-y-5`).
- **`components/dashboard/CalendarTab.tsx`**:
  - Removed `onAddAppointment` and `onBlockTime` props passed to `<CalendarSidebar>`.
  - Retained `<BlockTimeModal>` JSX, `openBlockModal`, `blockType`, `blockReason`, and `handleBlockSubmit` wiring intact to preserve backend blocking functionality for future UI surfaces.
  - Maintained primary patient booking pathways via `WeekView` (`onAvailableSlotClick={openAddAppointment}`) and `DayView` (`onBookPatient={() => openAddAppointment(selectedDate)}`).

### 2b. Documentation Updates
- **`CALENDAR_UI_DOCUMENTATION.md`**: Removed `QuickActionsCard.tsx` from file index table and component hierarchy diagram.
- **`README.md`**: Removed `QuickActionsCard.tsx` from calendar directory tree.

### 2c. Comprehensive Automated & Live Test Suites
- Added `scripts/test_quick_actions_removal.mjs`: 24 automated unit and AST assertion test cases covering:
  - T1: File deletion and complete elimination of `QuickActionsCard` imports and JSX tags.
  - T2: WeekView slot click wiring to `openAddAppointment`.
  - T3: DayView "Book Patient" button wiring to `openAddAppointment`.
  - T4: `BlockTimeModal` component preservation and `useCalendarModals` state hook retention.
  - T5: Strict `CalendarSidebarProps` interface type validation via TypeScript AST parser.
  - T6: Production build and clean bundle verification.
- Added `scripts/verify_quick_actions_live_ui.mjs`: 7 live end-to-end checks against running servers on ports 3000 and 8000:
  - Service health verification (`http://localhost:8000/docs`, `http://localhost:3000/dashboard`).
  - Doctor authentication with test credentials (`manual.doctor.test@clinic.local`) & CORS validation (`Access-Control-Allow-Origin: http://localhost:3000`).
  - Session verification via `/api/v1/auth/me`.
  - Live UI bundle verification confirming absence of `QuickActionsCard` and presence of `MiniCalendar` and `WorkingHoursCard`.
  - Doctor calendar unified scheduling API query (`/api/v1/doctor/calendar`).
- Updated `package.json`: Chained `node scripts/test_quick_actions_removal.mjs` into `npm test` and `npm run test:calendar`.

## 3. Key Changes (Google Calendar Removal — Phase 2)
- **Component Deletions**:
  - `components/dashboard/calendar/sidebar/GoogleCalendarCard.tsx`
  - `components/dashboard/calendar/modals/GoogleCalendarModal.tsx`
  - `components/dashboard/calendar/sidebar/SyncNotificationBanner.tsx`
- **Component & Hook Updates**:
  - `CalendarSidebar.tsx`: Pruned deleted card imports and unused props.
  - `useCalendarData.ts`: Removed `syncingGoogle` state and `handleSyncGoogle()` callback.
  - `useCalendarModals.ts`: Removed `showGoogleModal` state and `openGoogleModal()` callback.
  - `CalendarTab.tsx`: Removed `GoogleCalendarModal` import/rendering.

---

## 3. Key Changes (Phase 3 — Calendar Module Enhancement & Hardening)

### 2a. Types & API Layer (`lib/api.ts`)
- **`ScheduleType` Union**: Removed `"AVAILABLE"`, leaving `export type ScheduleType = "LEAVE" | "HOLIDAY" | "BLOCKED";`.
- **`CalendarEvent.type`**: Propagated to `ScheduleType | "APPOINTMENT"`, ensuring events can only be appointments, leaves, holidays, or blocked times.

### 2b. Calendar Infrastructure (`constants.ts`, `calendarUtils.ts`)
- **`constants.ts`**: Pruned all mock `{ type: "AVAILABLE", ... }` entries from `DEMO_WEEK_EVENTS`.
- **`calendarUtils.ts`**: Removed the `if (ev.type === "AVAILABLE") return false;` bypass in `findConflictingEvents`, as availability entries no longer exist and any non-appointment/non-leave slot is open.

### 2c. Modals & Hooks (`AddAvailabilityModal.tsx`, `useCalendarModals.ts`, `AddAppointmentModal.tsx`)
- **Deleted File**: `components/dashboard/calendar/modals/AddAvailabilityModal.tsx`.
- **`useCalendarModals.ts`**:
  - Removed state `showAddAvailabilityModal`, callback `openAddAvailability`, and submit handler `handleAddAvailabilitySubmit`.
  - Cleaned up the return object to omit all availability-related properties.
- **`AddAppointmentModal.tsx`**:
  - Removed `availableSlotsToday` memo (which filtered `type === "AVAILABLE"`).
  - Removed the "Available 30-min alternatives today" quick suggestion chip section.

### 2d. Calendar Views (`DayView.tsx`, `WeekView.tsx`, `MonthView.tsx`, `CalendarHeader.tsx`)
- **`DayView.tsx`**:
  - Removed `availCount` badge and its "Available Slots" card from summary KPI badges (converted to 2 columns).
  - Removed `isAvail` check and green visual slot styling branch.
- **`WeekView.tsx`**:
  - Removed `onAvailableSlotClick` prop from `WeekViewProps`.
  - Removed `isAvailable` boolean and the green "AVAILABLE 30-MINUTE SLOT" rendering block.
  - Updated empty 30-minute slot hover button to book an appointment directly (`title="Book appointment (...)"`).
- **`MonthView.tsx`**:
  - Removed `avails` slot counter and the green "{avails} Slots" badge from monthly calendar day cells.
- **`CalendarHeader.tsx`**:
  - Removed `onAddAvailability` prop from `CalendarHeaderProps`.
  - Removed "+ Add Availability" primary action button from the calendar header bar.

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

## 6. Key Changes (Phase 6 — Calendar Slot Details & Rescheduling Drawer with Full Patient Vitals & Leave Management)

### 6a. Right-Side Drawer Architecture & Accessibility (`CalendarDrawer.tsx`, `useCalendarDrawer.ts`, `CalendarTab.tsx`)
- **Slide-In Drawer Component** (`components/dashboard/calendar/panels/CalendarDrawer.tsx`):
  - Fixed-position overlay (`z-50`) with subtle backdrop blur (`bg-slate-900/30 backdrop-blur-[2px]`) preserving desktop calendar background visibility.
  - Smooth 300ms slide-in animation (`animate-in slide-in-from-right duration-300 ease-out`).
  - Full keyboard accessibility: traps focus, listens for `Escape` key to close, and disables body bounce on mobile.
  - Responsive sizing: full width on mobile (`w-screen`), standard 480px width on desktop (`md:max-w-lg lg:w-[480px]`).
  - Sticky glass header with title, subtitle (formatted date and 12-hour time), and category badge ("Patient Appointment" in blue or "Doctor Leave & Exclusion" in amber).
- **Drawer State Management Hook** (`components/dashboard/calendar/hooks/useCalendarDrawer.ts`):
  - Manages `drawerState`: `{ isOpen, type, mode, event, date, leaveId }`.
  - Type-safe slot dispatcher: categorizes clicked slots into `"appointment"`, `"leave"`, or `"blocked"`.
  - Provides `openEventDrawer(event, date)` and `closeDrawer()`.
- **CalendarTab Mounting** (`components/dashboard/CalendarTab.tsx`):
  - Replaced legacy modal event clicks with `onEventClick={openEventDrawer}` across both WeekView and DayView.
  - Mounted `CalendarDrawer` directly within `CalendarTab` without route changes or page reloads, ensuring zero loss of scroll position.

### 6b. Comprehensive Patient Details & Vitals Panel with IDs (`AppointmentDetailsPanel.tsx`, `constants.ts`)
- **Patient Profile & Contact Card**:
  - Displays Patient Initial Avatar, Patient Full Name, Appointment Status Badge (e.g. `BOOKED`).
  - Direct telephone (`tel:`) and mailto (`mailto:`) links with 1-click copy icons.
  - Residential Address with location marker icon.
- **Patient Demographics & Vitals Matrix**:
  - Clean 5-column responsive vitals grid: Age (`yrs`), Gender (`Male`/`Female`/`Other`), Blood Group (`A+`, `B+`, `O+`, `AB+`, etc.), Height (e.g. `165 cm`), and Weight (e.g. `58 kg`).
  - Gracefully hides missing optional vitals without awkward layout shifts.
- **Appointment Specifications & Copyable IDs Card**:
  - Displays Date and 12-Hour Time Window (`format12Hour`).
  - **Patient ID**: Displayed with 1-click clipboard copy button and checkmark confirmation.
  - **Doctor ID**: Displayed with 1-click clipboard copy button.
  - **Appointment ID**: Displayed with 1-click clipboard copy button.
  - **Booking Created Date**: Formatted into readable localized date and time.
- **Consultation Details Card**:
  - Prominent Visit Reason card and multi-line Additional Clinical Notes.
- **Background API Hydration**:
  - Fetches complete appointment record via `getAppointment(appointment_id)` upon drawer opening to populate full UUIDs and timestamps seamlessly.
- **Enriched Demo Data** (`constants.ts`):
  - Enriched `DEMO_WEEK_EVENTS` with realistic patient demographics, vitals, addresses, notes, and copyable UUIDs (`pat-demo-2001`, `doc-demo-1001`, `appt-demo-101`) for offline and demonstration fidelity.

### 6c. Inline Rescheduling Sub-panel & Conflict Guard (`AppointmentRescheduleForm.tsx`, `SlotSelectorGrid.tsx`, `RescheduleConfirmModal.tsx`)
- **Inline Flow Switching**: Clicking "Edit / Reschedule Appointment" switches the drawer content directly to the rescheduling form without navigating away or opening additional stacked modals.
- **Dynamic Slot Selector Grid** (`SlotSelectorGrid.tsx`):
  - Interactive date picker (allowing navigation up to 60 days forward).
  - Fetches backend available slots via `getDoctorAvailableSlots(date)` with local calculation fallback.
  - Enforces conflict detection: marks conflicting slots as unavailable with collision reasons (`APPOINTMENT`, `LEAVE`, `BLOCKED`, `HOLIDAY`).
  - Enforces doctor working hours shifts (morning & evening), disabling slots outside active operating shifts.
- **Confirmation Safety Modal** (`RescheduleConfirmModal.tsx`):
  - Displays patient name, original date/time, and proposed new date/time with arrow visual.
  - Clear confirmation warning before dispatching `rescheduleAppointment` API.
  - On success, triggers calendar stream reload and toast confirmation.

### 6d. Doctor Leave Details & Instant Availability Restoration (`LeaveDetailsPanel.tsx`)
- **Prominent Leave ID Presentation**:
  - Prominent amber banner displaying the Leave Schedule UUID with 1-click copy button.
  - Displays Doctor ID, Leave Date, 12-Hour Time Window, and Leave Reason.
- **Cancellation & Deletion Flow**:
  - Red-themed "Cancel Leave" button triggers confirmation dialog explaining that cancelling will immediately restore patient booking availability.
  - Calls `deleteDoctorSchedule(schedule_id)` API, shows toast confirmation, and refreshes the calendar stream immediately.

### 6e. Backend UUID Generation & Calendar Serialization
- **Automatic Patient ID Assignment** (`backend/app/services/appointment_service.py`):
  - Generates `patient_id = uuid.uuid4()` during appointment creation when not explicitly provided by a registered account, ensuring 100% of appointments possess a valid, non-null patient identifier.
- **Event Serialization** (`backend/app/schemas/calendar.py` & `backend/app/services/calendar_service.py`):
  - Serializes `patient_id`, `doctor_id`, and `created_at` in calendar appointment events.
  - Serializes `schedule_id` and `doctor_id` in calendar leave events.
- **TypeScript API Contracts** (`lib/api.ts`):
  - Added `patient_id`, `doctor_id`, `schedule_id`, `created_at`, `patient_height`, `patient_weight`, `patient_blood_group`, `patient_address` to `CalendarEvent`.

---

## 7. Key Changes (Phase 7 — Week Calendar UI Enhancements, Bold Slot Typography & Top Legend Bar)

### 7a. Bold Time Slot Typography (`WeekView.tsx`)
- Standardized all 24 time rows (9:00 AM – 8:30 PM) with bold monospace font (`font-mono font-bold tracking-tight text-[11px]`), ensuring half-hour (`:30`) slots are bold and clearly legible alongside full-hour (`:00`) slots.
- Formatted all event cards (Appointments, Available slots, Doctor Leaves, and Blocked periods) with bold start and end time intervals (`font-mono font-bold text-[9px]`).

### 7b. Zero-Scroll Responsive Full-Width Layout (`WeekView.tsx`)
- Removed `overflow-x-auto` and fixed `min-w-[920px]`.
- Implemented responsive full-width CSS grid: `w-full grid-cols-[68px_repeat(7,minmax(0,1fr))]`.
- The 68px time column and all 7 day columns (Monday through Sunday) now fit 100% within the calendar container without generating any horizontal scrollbar on any desktop resolution.

### 7c. Plus Icon Removal & Clean Empty Slot Affordance (`WeekView.tsx`)
- Removed all `<Plus />` icons across within-working-hours and outside-working-hours empty slot buttons.
- During active shifts, empty slots render a clean, dashed interactive container revealing `Book / Leave` on hover. Outside active shifts, empty cells reveal `Add Slot` on hover.

### 7d. Full 7-Day Grid Slot Visibility (`WeekView.tsx`)
- Removed the hardcoded `isSunday ? "Closed"` overlay from `WeekView.tsx`.
- Sunday now displays its standard 30-minute operational time rows and appointments alongside all other days.

### 7e. Top-Mounted Operational Legend Bar (`WeekView.tsx`)
- Repositioned the color-coded operational legend bar from the bottom of the grid to the top (placed right above the sticky Day Header row).
- Provides instant reference for Appointment (blue), Available Slot (emerald), Doctor Leave (amber), Blocked Period (purple), and Bookable Shift Slot (dashed blue), with the 30-minute interval indicator.

---

## 8. Key Changes (Phase 8 — Real Calendar Date Synchronization & Google Calendar Mini-Calendar Alignment)

### 8a. Timezone-Safe Date Mathematics (`calendarUtils.ts`, `useCalendarData.ts`)
- **UTC Offset Bug Remediation**: Previously, `new Date(year, month, i).toISOString().split("T")[0]` converted local midnight to UTC. In any positive UTC offset (e.g. UTC+05:30 in India), local midnight (00:00:00) converted to 18:30:00Z on the previous calendar day, shifting all mini-calendar date strings backward by 1 day (e.g. Day 1 resolved to `"2026-09-30"` instead of `"2026-10-01"`, and Day 23 resolved to `"2026-10-22"`).
- **Dedicated Local Date Helpers**: Introduced `formatDateToYYYYMMDD(d: Date): string` and `parseYYYYMMDD(dateStr: string): Date` to perform strict local date formatting and parsing without UTC drift across any timezone globally.
- **Enhanced `generateMiniCalDays`**:
  - Dynamically computes local `isToday` (`dateStr === todayStr`), `isInCurrentWeek` (bounds checking against active week start/end), and `hasEvents` (populating event indicator dots).
  - Pads cells to clean 35 or 42 cells (5 or 6 full weeks) to maintain a rock-solid, jitter-free grid layout across all months.
- **Enhanced `useCalendarData`**:
  - Initialized `selectedDate` dynamically to `formatDateToYYYYMMDD(new Date())` (today's real date) instead of a hardcoded date.
  - Initialized `miniCalMonth` to `new Date(now.getFullYear(), now.getMonth(), 1)`.
  - Added bi-directional month synchronization: navigating weeks across month boundaries (`handlePrevWeek`, `handleNextWeek`) automatically updates the mini-calendar's visible month.
  - Clicking trailing/leading dates in adjacent months automatically transitions the mini-calendar month.

### 8b. Google Calendar Mini-Calendar Alignment (`MiniCalendar.tsx`, `constants.ts`)
- **Single-Letter Day Column Headers**: Exported `MINI_CAL_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const` in `constants.ts`, providing Google Calendar's minimalist single-letter headers instead of cramped 3-letter abbreviations.
- **Google Calendar Circular Badges**:
  - **Real Current Date (Active/Selected)**: Distinctive solid Google blue circular badge with white text (`bg-blue-600 text-white font-bold shadow-xs scale-105`).
  - **Real Current Date (Unselected)**: Distinctive blue ring and tinted background (`border-2 border-blue-600 text-blue-600 font-extrabold bg-blue-50/50 shadow-2xs`).
  - **Selected Date (Not Current Date)**: Google Calendar's soft blue selection circle (`bg-blue-100 text-blue-800 font-bold hover:bg-blue-200/80 shadow-2xs`).
  - **Out-of-Month Days**: Muted gray font (`text-slate-400 hover:bg-slate-100 hover:text-slate-600`).
- **Appointment Dot Indicators**: Days with scheduled appointments render a subtle indicator dot beneath the date number (`w-1 h-1 rounded-full absolute bottom-0.5`).
- **Active Week Shading**: The 7 cells of the currently viewed week receive soft row shading (`bg-slate-50/60 first:rounded-l-full last:rounded-r-full`).

### 8c. Elimination of the "+ New Appointment" Create Button (`CalendarSidebar.tsx`)
- Completely removed the top floating `+ New Appointment` / `+ Create` button from `CalendarSidebar.tsx`.
- Prevents UI redundancy: doctors can book appointments directly by clicking any empty 30-minute operational slot in the calendar grid (`WeekView` / `SlotActionModal`) or via the existing Quick Actions card (`QuickActionsCard`), preserving a clean, uncluttered sidebar layout.

### 8d. Strict Omission of the Textual Word "Today" (`CalendarSidebar.tsx`, `MiniCalendar.tsx`, `MonthView.tsx`)
- Strictly removed all instances of the textual word "Today" from sidebar banners, headers, and buttons.
- Eliminated the verbose "Today / Real Date" text banner from `CalendarSidebar.tsx`.
- Removed textual "Today" jump buttons in the `MiniCalendar.tsx` header.
- Avoided textual "Today" labels in `MonthView.tsx` day cells, relying exclusively on Google Calendar's visual blue circular badge indicator to signify the current calendar day without text pollution.

### 8e. Clean Vertical Hierarchy & View Integration (`CalendarSidebar.tsx`, `MonthView.tsx`)
- Retained clean, focused vertical hierarchy: Google Calendar `MiniCalendar`, `WorkingHoursCard`, and `QuickActionsCard`.
- In `MonthView.tsx`, the real current date is highlighted with a circular blue badge (`w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs`).
- Maintained zero-scroll full-width responsive grid parity across Week, Day, and Month views.

---

## 9. Key Changes (Phase 9 — Clean Calendar Slots: Pure Patient Name Display, Empty Slot Uniformity & Zero Break Time Mention)

### 9a. Pure Patient Name Display in WeekView & Patient Name with Visit Reason in DayView
- **WeekView Filled Slot De-cluttering**: Inside booked appointment slot containers in `WeekView.tsx`, secondary lines containing start-end time ranges (`10:00 AM – 10:30 AM`) and visit reasons (`General Consultation`) were removed to prevent vertical text clipping in compact 30-minute cells. Only the patient's name (`event.patient_name || "Patient"`) is rendered inside the slot in high-contrast bold typography (`font-bold text-[11px] text-blue-950`). Full details remain accessible via hover tooltip and 1-click drawer.
- **DayView Patient Name with Visit Reason**: In `DayView.tsx`, appointment cards display the patient's name prominently alongside their visit reason (`{event.patient_name || "Patient"} • {event.reason || "General Visit"}`) in an expanded horizontal stream card with accurate 12-hour start and end bounds (`format12Hour(event.start) – format12Hour(event.end)`).
- **DayView Otherwise Empty Slots**: All unbooked operational intervals in `DayView.tsx` render as uniform empty slots (`border-dashed bg-slate-50/60`, title "Empty Slot — Click to book", and badge "EMPTY SLOT") with 1-click direct booking modal integration via `onEmptySlotClick`.

### 9b. Uniform Empty Slots Across All Unbooked Intervals (`WeekView.tsx`)
- **Elimination of Visual Noise**: Removed bulky green `AVAILABLE` badges, "Available" text labels, and distracting green borders from open calendar slots.
- **Clean Google Calendar Empty Slot Affordance**: All unbooked 30-minute intervals render as clean, spacious empty slots without default text clutter.
- **Interactive Hover & 1-Click Booking**: On hover, empty slots smoothly reveal a soft blue highlight (`hover:bg-blue-50/50`) and a subtle `+` affordance, with 1-click access to open the `SlotActionModal` or quick booking modal.

### 9c. Complete Omission of Break Time Slot Mentions (`WeekView.tsx`)
- **Zero Break Text/Badges**: Strictly ensured that no slot displays "Break", "Lunch Break", "Shift Break", or "Break Time".
- **Grid Continuity**: Operational gaps (such as between morning and evening shifts) render as standard, uniform empty slots without break banners, giving doctors an uninterrupted, clean visual view of the entire schedule.
- **Streamlined Top Legend Bar**: Updated the operational legend at the top of `WeekView.tsx` to highlight Appointment (Patient), Empty Slot (Click to Book), Doctor Leave, and Blocked Period, completely omitting any break time references.

---

## 10. Key Changes (Phase 10 — DayView Top Legend Bar Integration & Header "Book Patient" Button Removal)

### 10a. Edge-to-Edge Top Operational Legend Bar (`DayView.tsx`)
- Re-structured `DayView.tsx` with an outer full-width wrapper (`<div className="w-full select-none">`), hosting the operational legend bar as the topmost child directly inside the parent calendar card.
- Mounted edge-to-edge with `border-b border-slate-200 bg-slate-50/80 p-2.5`, creating pixel-perfect layout and style parity with `WeekView.tsx`.
- The existing Day Schedule header, summary count badges (Appointments, Empty Slots, Leaves), and 30-minute event stream cards are cleanly housed within the inner `p-6 space-y-5` container.

### 10b. Semantic Indicator & Design Token Parity (`DayView.tsx`, `WeekView.tsx`)
- **Appointment (Patient)**: Solid Google Blue indicator (`bg-blue-600 border border-blue-700`).
- **Empty Slot (Click to Book)**: Dashed border with white background (`border border-dashed border-slate-300 bg-white`).
- **Doctor Leave**: Warm amber indicator (`bg-amber-500 border border-amber-600`).
- **Blocked Period**: Sleek purple indicator (`bg-purple-500 border border-purple-600`).
- **Operating Interval Badge**: `30-Minute Operating Intervals` (`text-[11px] font-medium text-slate-500`).

### 10c. Removal of Redundant "Book Patient" Header Button (`DayView.tsx`)
- Removed the top-right `Book Patient` button and `Plus` icon from the Day Schedule header in `DayView.tsx`.
- Prevents UI redundancy: doctors book appointments by clicking directly on any 30-minute empty slot card in the Day Schedule stream (triggering `SlotActionModal`), or via the Quick Actions card in the sidebar, matching the clean Google Calendar workflow in WeekView.
- Streamlined the Day Schedule header to focus exclusively on the selected date and operational stream context.

### 10d. Automated Verification & Regression Guard (`verify_phase9_clean_slots.mjs`)
- Added check `V6: DayView renders operational legend bar on top` validating that all 4 semantic indicators and the interval label are present, and asserting that the legend bar is mounted prior to the Day Schedule header.
- Added check `V7: DayView eliminates redundant 'Book Patient' header button` ensuring no redundant booking button is rendered in the header.

---

## 11. Key Changes (Phase 11 — Exclusive Working Hours Slot Display in DayView & WeekView)

### 11a. Dynamic Working Hours Time Rows Utility (`calendarUtils.ts`)
- **Function**: `getWorkingHoursTimeRows(config?: WorkingHoursConfig, additionalEvents?: CalendarEvent[]): string[]`
  - Generates 30-minute time row labels (e.g. `"10:00 AM"`, `"10:30 AM"`) strictly corresponding to enabled doctor working shifts in `workingHoursConfig`.
  - For default shifts (Morning: 10:00 AM – 1:00 PM, Evening: 4:00 PM – 8:00 PM), it produces exactly 14 operational 30-minute intervals.
  - Automatically incorporates any off-shift intervals that contain booked patient appointments or leaves, ensuring that special or pre-existing appointments scheduled outside regular shifts are never hidden or omitted.
  - Sorts all intervals in ascending chronological order and formats them into standard 12-hour AM/PM labels.

### 11b. DayView Operational Stream Filtering (`DayView.tsx`, `CalendarTab.tsx`)
- **`DayView.tsx` Component**:
  - Added `workingHoursConfig?: WorkingHoursConfig` to `DayViewProps` interface.
  - Replaced the static, unfiltered `TIME_ROWS.map` iteration with dynamic `workingTimeRows.map` computed via `getWorkingHoursTimeRows(workingHoursConfig, events)`.
  - **Clean Empty Slot Display**: All unoccupied 30-minute slots within active clinic shifts now render as interactive dashed empty slot cards (`Empty Slot — Click to book` with `EMPTY SLOT` badge).
  - Clicking any empty slot immediately triggers `onEmptySlotClick(selectedDate, slotStart, slotEnd)` to launch `SlotActionModal` with the exact 30-minute window pre-selected.
  - **Summary Badge Recalculation**: Updated the 3-column KPI summary badges:
    - `Appointments (30m)`: Number of booked patient appointments.
    - `Empty Slots`: Exact count of remaining unbooked 30-minute intervals within active clinic shifts.
    - `Leaves / Exclusions`: Number of doctor leaves or holidays.
  - Non-working off-hours (9:00 AM – 10:00 AM, 1:00 PM – 4:00 PM inter-shift closure, and post-8:00 PM) are completely eliminated from the stream, removing dead space and booking confusion.
- **`CalendarTab.tsx` Integration**:
  - Connected `workingHoursConfig` state prop to `<DayView workingHoursConfig={workingHoursConfig} ... />`, enabling immediate schedule recalculation whenever the doctor edits their shifts via `EditWorkingHoursModal`.

### 11c. WeekView Grid Row Filtering (`WeekView.tsx`)
- **`WeekView.tsx` Component**:
  - Collected all events across visible week days (`allWeekEvents = currentWeekDays.flatMap(...)`).
  - Replaced static 24-row `TIME_ROWS` grid rendering with dynamic `workingTimeRows` generated from `getWorkingHoursTimeRows(workingHoursConfig, allWeekEvents)`.
  - Compacted the weekly calendar from 24 rows down to the doctor's active 14 shift rows (10:00 AM – 1:00 PM and 4:00 PM – 8:00 PM), entirely eliminating early morning, late evening, and 3-hour afternoon dead zones.
  - Unbooked cells within active working days render clean empty slot affordances with 1-click booking cues.

### 11d. Automated Verification & Regression Guard
- Verified via `scripts/verify_phase9_clean_slots.mjs` (7/7 passed, 100%).
- Verified via `scripts/test_calendar_utils.mjs` (32/32 passed, 100%).
- Verified via `scripts/verify_calendar_qa_scenarios.mjs` (8/8 passed, 100%).
- Verified via `scripts/test_quick_actions_removal.mjs` (24/24 passed, 100%).
- Verified TypeScript compilation: `npx tsc --noEmit` (0 errors).
- Verified ESLint: `npm run lint` (0 warnings, 0 errors).

---

## 12. Key Changes (Phase 12 — Database Migration & Doctor Working Hours Persistence — appointment_calender_plan.md Phase 1)

### 12a. Alembic Migration `009_add_working_hours_to_doctor.py`
- Added column `working_hours` of type `JSON` (nullable) to the `doctors` table using `op.batch_alter_table("doctors")`.
- Implemented safe bidirectional `upgrade()` and `downgrade()` routines.
- Seeded default shift configuration for existing doctor rows where `working_hours IS NULL`:
  ```json
  {
    "shifts": [
      {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": true},
      {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": true}
    ],
    "closed_days": [0]
  }
  ```
- Used parameter-bound SQL updates (`UPDATE doctors SET working_hours = :val WHERE working_hours IS NULL`) guaranteeing flawless compatibility in both online database transactions and offline static DDL generation (`alembic upgrade ... --sql`).

### 12b. SQLAlchemy Model & Pydantic Validation Schemas
- **SQLAlchemy Doctor Model (`backend/app/models/doctor.py`)**:
  - Imported `JSON` from `sqlalchemy`.
  - Added `working_hours: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)`.
- **Pydantic Validation Schemas (`backend/app/schemas/schedule.py`)**:
  - `WorkingHoursShift`: Validates shift `id`, `label`, `start`, `end`, and `enabled`. Enforces regex `^([01]\d|2[0-3]):[0-5]\d$`, strictly requires `start < end`, and verifies both start and end minute boundaries are multiples of 30 (`minute % 30 == 0`).
  - `DoctorWorkingHoursUpdate`: Validates list of shifts (`max_length=4`) and `closed_days` array. Enforces day index range (0–6), checks for duplicate closed days, and asserts that active (enabled) shifts do not chronologically overlap.
  - `DoctorWorkingHoursResponse`: Strongly-typed API response schema returning `shifts` and `closed_days`.
  - `DEFAULT_DOCTOR_WORKING_HOURS`: Centralized fallback constant providing the 2-shift default schedule (Morning 10:00–13:00, Evening 16:00–20:00, Sunday closed).

### 12c. Working Hours API Endpoints & Telemetry (`backend/app/api/routes/schedule.py`)
- `GET /api/v1/doctor/working-hours`: Returns current doctor's working shifts and closed days. If `working_hours` is null in the database, falls back gracefully to `DEFAULT_DOCTOR_WORKING_HOURS`.
- `PUT /api/v1/doctor/working-hours`:
  - Rate limited via `@limiter.limit("30/minute")`.
  - Validates payload against `DoctorWorkingHoursUpdate` (30m bounds, duration, overlaps, max 4 shifts).
  - Persists JSON configuration to `current_doctor.working_hours` and commits transaction.
  - Automatically invokes `invalidate_slot_cache(current_doctor.id)` to purge cached public slot availability.
  - Emits structured telemetry log event: `doctor.working_hours_updated` with doctor ID, shift count, enabled shift count, and closed days.

### 12d. Automated Pytest Test Suite (`backend/tests/test_working_hours_engine.py`)
- Added 10 automated backend tests covering:
  - T1: `GET /doctor/working-hours` returns default shifts for unconfigured doctor accounts.
  - T2: `PUT /doctor/working-hours` successfully stores and returns valid shift updates and persists to database.
  - T3: Inverted time ranges (`start >= end`) are rejected with 422 Unprocessable Entity.
  - T4: Zero-duration shifts (`start == end`) are rejected with 422 Unprocessable Entity.
  - T5: Non-30m step intervals (e.g., 10:15) are rejected with 422 Unprocessable Entity.
  - T6: Chronologically overlapping enabled shifts are rejected with 422 Unprocessable Entity.
  - T7: Overlapping disabled (draft) shifts are allowed without validation error.
  - T8: Payloads exceeding the 4-shift daily ceiling are rejected with 422 Unprocessable Entity.
  - T9: Cache invalidation verification confirming `invalidate_slot_cache` purges cached doctor dates on shift update.
  - T10: Alembic migration 009 bidirectional test (`upgrade head` -> `downgrade 008` -> `upgrade head`).

---

## 13. Key Changes (Phase 13 — Break Time Standardization, Sidebar Working Hours Cleanup & Single String Concept)

### 13a. Complete Vocabulary Standardization & Elimination of "Lunch" and "Rest"
- Fully eliminated the terms `"lunch"` and `"rest"` (including `"Lunch & Rest Break"`, `"Scheduled lunch & rest interval"`, `"Break Time (Rest)"`, `"Clinic rest interval"`) from the entire frontend codebase and logic.
- Standardized strictly on the clean, professional term **`"Break Time"`**.
- Configured default and dynamic break labels in `DEFAULT_WORKING_HOURS.breakTime.label` and `getDoctorBreakInterval` fallback to strictly `"Break Time"`.

### 13b. Centralized Single Source of Truth String Architecture (`constants.ts`, `calendarUtils.ts`)
- **Shared Constants (`constants.ts`)**:
  - Defined centralized, type-safe string constants to eliminate ad-hoc hardcoded strings:
    ```typescript
    export const BREAK_TIME_LABEL = "Break Time" as const;
    export const BREAK_TIME_BADGE = "BREAK TIME" as const;
    export const BREAK_TIME_SUBTITLE = "• Clinic break interval (no patient booking)" as const;
    ```
- **Unified Title Formatter Helper (`calendarUtils.ts`)**:
  - Implemented `formatBreakTimeTitle(startLabel: string, endLabel: string): string` returning `${BREAK_TIME_LABEL} (${startLabel} – ${endLabel})`.
  - Both `DayView.tsx` and `WeekView.tsx` consume this single helper, guaranteeing 100% string uniformity across calendar views.

### 13c. Sidebar "Working Hours" Card Cleanup (`WorkingHoursCard.tsx`)
- **Strict Working Shifts Focus**:
  - Removed the break interval card block from `WorkingHoursCard.tsx`.
  - The sidebar "Working Hours" card now strictly displays the doctor's active clinical working shifts (Morning Shift: 10:00 AM – 1:00 PM and Evening Shift: 4:00 PM – 8:00 PM).
  - Pruned unused icons (`Coffee`) and hook dependencies (`getDoctorBreakInterval`, `useMemo`), maintaining a clean, distraction-free sidebar.

### 13d. DayView Break Card Redesign for WeekView Parity (`DayView.tsx`)
- **Single String Concept / Horizontal Layout Parity**:
  - Replaced the previous multi-line stacked text (`<div><span>Break Time • Doctor On Break</span></div><div>Break Time (180 min)</div>`), which duplicated the words "Break Time" twice and caused visual clutter.
  - Implemented the streamlined single-line horizontal card layout:
    - **Time Column**: `1:00 PM – 4:00 PM` (bold monospace in `w-36`).
    - **Single Unified String**: `BREAK TIME (1:00 PM – 4:00 PM) • Clinic break interval (no patient booking)`.
    - **Badge**: Amber-styled `{BREAK_TIME_BADGE}` (`BREAK TIME`).
  - Legend indicator updated to `{BREAK_TIME_LABEL}`.

### 13e. Dynamic Break Preview in Working Hours Modal (`EditWorkingHoursModal.tsx`)
- **Popup-Only Break Configuration Preview**:
  - Preserved the interactive auto-calculated break time preview strictly within the "Customize Doctor Working Hours" modal popup.
  - Displays dynamic gap calculation between morning and evening shifts with `{BREAK_TIME_BADGE}` badge and `BREAK_TIME_LABEL` save payload.

### 13f. Comprehensive Automated Verification Suite (`test_break_time_suite.mjs`)
- Added `scripts/test_break_time_suite.mjs` executing 16 automated tests covering:
  - Dynamic break interval calculations (180 min default, custom shift gap calculations, explicit override).
  - `isSlotInBreak` slot boundary detection.
  - Working hours and break time booking guards (break slots cannot be booked; Sunday closed).
  - UI component structural integrity: DayView single-string parity, WeekView 7-column consolidated banner, MonthView break exclusion, WorkingHoursCard break omission, and EditWorkingHoursModal preview.

---

## 14. Decisions, Deviations & Assumptions
- **Decision (Doctor Working Hours JSON Column vs Normalized Relational Table)**: In `009_add_working_hours_to_doctor.py`, stored working hours shifts and closed days in a `JSON` column on `doctors` rather than creating a separate table.
  - *Reasoning*: Doctor recurring shift configurations are compact (typically 1–2 shifts, max 4), read frequently with doctor profile, and always updated as a single coherent document. JSON column avoids additional joins during slot generation and profile queries.
  - *Alternative Considered*: A `doctor_shifts` normalized table. Rejected as overengineered for max 4 rows per doctor and introduces complex cascade and foreign key overhead.
- **Decision (Literal Binding Compatibility in Migration 009)**: Used parameter-bound text SQL (`UPDATE doctors SET working_hours = :val WHERE working_hours IS NULL`) instead of raw Python dictionaries in `op.execute()`.
  - *Reasoning*: Alembic `--sql` offline migration mode cannot render Python dictionary literals with `sa.JSON()` without explicit string serialization. The serialized text approach works identically across both online execution and offline static SQL generation.
- **Decision (Patient ID Generation for Unregistered Bookings)**: In `appointment_service.py`, when a patient is booked through the clinic dashboard without a pre-existing patient account, `patient_id` is assigned a unique UUID (`uuid.uuid4()`) rather than left `None`.
  - *Reasoning*: Satisfies requirement that doctors can reliably identify, reference, and copy a Patient ID for every booked appointment slot.
- **Decision (Slide-in Drawer vs Stacked Modals)**: Replaced modal details with a fixed right-side slide-in drawer (`CalendarDrawer.tsx`).
  - *Reasoning*: Modals obscure the entire calendar grid and break context. The drawer allows doctors to inspect full clinical details and slot alternatives while keeping the operational calendar visible in the background.
- **Decision (1-Click Clipboard Copying)**: Added copy buttons for Patient ID, Doctor ID, Appointment ID, Leave ID, Phone, and Email.
  - *Reasoning*: High-volume clinic workflows require quickly pasting IDs into pharmacy, lab, and billing software.
- **Decision (Top-Mounted Operational Legend & Zero-Scroll Grid)**: Placed the color-coded legend at the top of WeekView and eliminated horizontal overflow.
  - *Reasoning*: Provides immediate visual semantics before the doctor scans the schedule, and removes disruptive horizontal scrollbars across all screen widths.
- **Decision (Google Calendar Mini-Calendar Aesthetics & Timezone Immunity)**: Adopted local date mathematics and single-letter headers (`M`, `T`, `W`, `T`, `F`, `S`, `S`) with clean circular day badges and no superfluous text labels.
  - *Reasoning*: Guarantees real date parity with zero timezone skew and gives doctors an intuitive, industry-standard calendar navigation experience.
- **Decision (Removal of Sidebar "+ New Appointment" Create Button)**: The sidebar header `+ New Appointment` button was removed to prevent UI redundancy and streamline focus to the mini-calendar navigation and operational schedule. Booking is natively supported on the calendar grid via shift slot clicking (`SlotActionModal`) and via `QuickActionsCard`.
- **Decision (Strict Omission of the Word "Today")**: Textual labels like "Today", "Today's Date", or "Go to Today" were omitted from the sidebar and mini-calendar. Instead, Google Calendar's visual badge conventions (solid blue circle or prominent blue ring) immediately signify the current day without unnecessary text clutter.
- **Decision (Only Patient Name in Filled Slots & Break Omission)**: In Phase 9, crowded text inside calendar slot boxes was stripped away in favor of displaying only the patient name. Open slots were simplified into clean empty slots, and break time labels were completely removed to present a clean, uninterrupted schedule.
- **Decision (DayView Top-Mounted Operational Legend Bar)**: In Phase 10, added the exact operational legend bar from `WeekView.tsx` to the top of `DayView.tsx` edge-to-edge.
- **Decision (Removal of DayView "Book Patient" Header Button)**: In Phase 10, removed the redundant "Book Patient" button from the `DayView.tsx` header.
- **Decision (Exclusive Working Hours Slot Display in DayView & WeekView)**: In Phase 11, restricted rendered slots across DayView and WeekView exclusively to active clinic working shifts (plus any special booked events).
  - *Reasoning*: Displaying non-working intervals (e.g. 9:00 AM – 10:00 AM, 1:00 PM – 4:00 PM afternoon break, 8:00 PM – 9:00 PM) created visual clutter and allowed unintentional bookings during closed hours. Filtering rows strictly to active shifts presents a compact, high-efficiency schedule aligned with actual clinic operating hours.
- **Decision (Elimination of "Lunch" and "Rest" Vocabulary — Phase 12)**: Standardized all break descriptions across the platform strictly to "Break Time".
  - *Reasoning*: Clinic schedules frequently utilize inter-shift gaps for administrative tasks, charting, inpatient rounds, or clinical transitions, not merely meals. "Break Time" is professional, concise, and universally applicable.
- **Decision (Sidebar Working Hours Shift Focus — Phase 12)**: Removed break interval display from `WorkingHoursCard.tsx`.
  - *Reasoning*: The "Working Hours" sidebar widget is designed to represent times when the clinic is open and working. Displaying non-working break times inside working hours caused visual ambiguity. Break details are managed inside the "Customize Working Hours" modal and displayed on Day/Week calendar grids.
- **Decision (Single String Concept & WeekView Parity for DayView Break Slot — Phase 12)**: Converted the DayView break slot from two stacked rows to a single horizontal line matching WeekView.
  - *Reasoning*: Prevents redundant text repetition ("Break Time" displayed twice in the same card) and ensures complete layout and string consistency across Day and Week views.
- **Deviations from Plan**: None.
- **Assumptions**: Unconfigured doctors default to the system standard shifts (10:00–13:00, 16:00–20:00, Sunday closed); leave cancellation requires doctor confirmation before freeing slots.

---

## 15. Verification Scorecard

| Suite / Check | Command | Result | Notes |
|---|---|---|---|
| **TypeScript Compilation** | `npx tsc --noEmit` | 🟢 PASS | 0 errors |
| **ESLint Validation** | `npm run lint` | 🟢 PASS | 0 warnings, 0 errors |
| **Full Backend Pytest Suite** | `pytest backend/tests` | 🟢 PASS | 136/136 passed (100%) |
| **Working Hours Engine Pytest Suite** | `pytest backend/tests/test_working_hours_engine.py` | 🟢 PASS | 10/10 passed (100%) |
| **Alembic Migration 009 Bidirectional Test** | `alembic downgrade -1 && alembic upgrade head` | 🟢 PASS | 009 upgrade & downgrade cleanly verified |
| **Alembic Static DDL SQL Generation** | `alembic upgrade 008:009 --sql` | 🟢 PASS | Clean PostgreSQL & SQLite compatible DDL generated |
| **Appointments Unit Suite** | `node scripts/test_appointments_comprehensive.mjs` | 🟢 PASS | 30/30 passed |
| **Calendar Utils Unit Suite** | `node scripts/test_calendar_utils.mjs` | 🟢 PASS | 32/32 passed (7/7 suites) |
| **Calendar Acceptance QA Suite (C1–C7 & D2)** | `node scripts/verify_calendar_qa_scenarios.mjs` | 🟢 PASS | 8/8 passed |
| **Empty Slot Acceptance Suite (E1–E5)** | `node scripts/verify_empty_slot_plan.mjs` | 🟢 PASS | 5/5 passed (100%) |
| **Calendar Drawer & Rescheduling Suite (S1–S5)** | `node scripts/verify_calendar_drawer_scenarios.mjs` | 🟢 PASS | 5/5 passed (100%) |
| **Real Date & Google Calendar Alignment Suite** | Timezone parity & layout audit | 🟢 PASS | `formatDateToYYYYMMDD` verified; no "Today" text; no "+ New Appointment" button |
| **Phase 9 & 10 Clean Slots, DayView Legend Bar & Header Cleanup Suite** | `node scripts/verify_phase9_clean_slots.mjs` | 🟢 PASS | 7/7 passed (100%) — pure patient name in WeekView, patient name with reason in DayView, clean empty slots, 0 break mentions, DayView top legend bar, no redundant Book Patient button |
| **Break Time Automated Suite (Phase 12)** | `node scripts/test_break_time_suite.mjs` | 🟢 PASS | 16/16 passed (100%) — dynamic gap calculation, booking guard, single string concept, WeekView parity, zero lunch/rest mentions |
| **Sidebar Quick Actions Cleanup Suite (Phase 13)** | `node scripts/test_sidebar_quick_actions_clean.mjs` | 🟢 PASS | 11/11 passed (100%) — QuickActionsCard eliminated, clean sidebar structure |
| **Live Working Hours API & Persistence (Agent-Executed)** | Live HTTP requests (`GET`/`PUT` `/api/v1/doctor/working-hours`) + SQLite DB check | 🟢 PASS | HTTP 200 persistence, 422 error boundaries (inverted ranges, non-30m step, overlaps), DB inspection verified |
| **Live Backend API & OpenAPI Docs** | `http://127.0.0.1:8000/docs`, `http://127.0.0.1:8000/openapi.json` | 🟢 PASS | HTTP 200 OK |


---

## 15. Manual Verification Guide & Acceptance
1. **Patient Appointment Slot Click & Full Details**:
   - In doctor dashboard, navigate to Appointment/Calendar tab.
   - Click on any booked appointment slot (e.g. "Neha Verma").
   - Verify right-side drawer slides in smoothly without page reload or scrolling jump.
   - Inspect Patient Name, Phone, Email, Address, Vitals (Age: 28 yrs, Gender: Female, Blood Group: B+, Height: 165 cm, Weight: 58 kg), Visit Reason, and Notes.
   - Verify Patient ID, Doctor ID, and Appointment ID each have functional copy buttons with checkmark feedback.
2. **Inline Appointment Rescheduling Flow**:
   - From the open appointment drawer, click **Edit / Reschedule Appointment**.
   - Verify the panel switches to the date picker and 30-minute slot grid.
   - Select a new date (e.g. tomorrow) and click an available 30-minute slot.
   - Verify conflicting slots (occupied by other appointments or leaves) are disabled.
   - Click "Review & Reschedule". Verify confirmation dialog displays original vs new date/time.
   - Click "Confirm Reschedule" and verify toast notification and updated calendar stream.
3. **Doctor Leave Slot Click & Prominent Leave ID**:
   - In WeekView, click on a leave slot (e.g. "Hospital Medical Conference").
   - Verify drawer opens with amber "Doctor Leave & Exclusion" badge.
   - Verify Leave ID is prominently displayed in the top amber card with a working copy button.
   - Verify Doctor ID, leave window, and leave reason are clearly rendered.
4. **Cancel Doctor Leave & Instant Availability Restoration**:
   - Click **Cancel Leave** at the bottom of the leave drawer.
   - In the confirmation modal, click "Confirm & Cancel Leave".
   - Verify toast confirmation "Leave schedule cancelled successfully".
   - Verify the calendar refreshes immediately and the slot becomes open/available for patient booking.
5. **Drawer Dismissal & Accessibility**:
   - Press the `Escape` key on the keyboard. Verify drawer slides closed.
   - Reopen drawer and click the darkened backdrop overlay. Verify drawer closes.
   - Reopen drawer and click the top-right `X` button. Verify drawer closes.
6. **Week Calendar UI, Bold Slots & Top Legend Bar**:
   - Inspect top of WeekView: Verify color legend bar appears at the top above the day header row.
   - Verify time column: All time rows (9:00 AM – 8:30 PM, hourly and half-hourly) are bold monospace text.
   - Verify horizontal layout: Entire week calendar (7 days + time column) fits within container with no horizontal scrollbar.
7. **Google Calendar Mini-Calendar & Real Date Parity (Phase 8)**:
   - **Single-Letter Headers**: Verify column headers show `M`, `T`, `W`, `T`, `F`, `S`, `S`.
   - **Real Date Calculation**: Verify day numbers accurately correspond to their local calendar dates without any 1-day offset skew (e.g. Day 23 resolves to `2026-10-23` in UTC+05:30).
   - **Google Calendar Badges**: Real current date renders a circular badge (solid blue when active, blue border/ring when unselected). Other selected days render soft blue background.
   - **No Superfluous Create Button**: Confirm that no `+ New Appointment` / `+ Create` button is present in `CalendarSidebar.tsx`.
   - **Zero "Today" Text Mentions**: Confirm that the textual word "Today" is not displayed anywhere in `CalendarSidebar.tsx` or `MiniCalendar.tsx` (visual circle indicator only).
   - **Cross-Month Navigation**: Click a trailing or leading date from adjacent months; verify selected date updates and mini-calendar navigates month smoothly.
8. **Clean Slots & Break Omission Verification (Phase 9)**:
   - **Only Patient Name**: Look at any filled slot (e.g., "Neha Verma", "Suresh Yadav"). Confirm that only the patient name is displayed in bold text inside the slot box (no time range or reason subtitles).
   - **Clean Empty Slots**: Confirm that all other slots without appointments are clean, empty slots without green "Available" badges or default text clutter.
   - **Click-to-Book**: Click on any empty slot and verify the `SlotActionModal` opens smoothly to book an appointment or mark leave.
9. **DayView Top Legend Bar & Header Cleanup (Phase 10)**:
   - In doctor dashboard, switch view mode to **Day**.
   - Verify that the operational legend bar is rendered at the very top of the day view card (above the Day Schedule header).
   - Confirm all 4 indicators are present: Appointment (Patient), Empty Slot (Click to Book), Doctor Leave, and Blocked Period, alongside "30-Minute Operating Intervals".
   - Confirm the Day Schedule header displays only the title and subtitle without any redundant "Book Patient" button.
   - Click any empty slot card in the day stream and verify the `SlotActionModal` opens with accurate 30-minute bounds.
10. **Exclusive Working Hours Slot Display in DayView & WeekView (Phase 11)**:
   - In both DayView and WeekView, confirm that rows render strictly for active working shifts (default: 10:00 AM – 1:00 PM and 4:00 PM – 8:00 PM, 14 slots total).
   - Confirm that off-shift closed hours (9:00 AM, 9:30 AM, 1:00 PM – 4:00 PM, and post-8:00 PM) are not rendered as empty rows.
   - Confirm that empty slots in DayView show `[Start] – [End] | Empty Slot — Click to book` with an `EMPTY SLOT` badge.
   - Click an empty slot in DayView or WeekView; verify the `SlotActionModal` opens pre-filled to that exact 30-minute window.
   - If an appointment exists outside regular shifts, verify that its row is dynamically included and rendered without loss.
11. **Doctor Working Hours Persistence & Fallback Verification (Phase 12)**:
   - Authenticate as a doctor via Bearer token.
   - Query `GET /api/v1/doctor/working-hours`. Confirm returns default 2 shifts (Morning 10:00–13:00, Evening 16:00–20:00, closed Sunday [0]).
   - Submit `PUT /api/v1/doctor/working-hours` with customized shifts (e.g. 09:00–12:00, 14:00–17:00, closed [0, 6]). Confirm HTTP 200 OK and database persistence.
   - Submit invalid payload with start >= end (e.g. 15:00–12:00). Confirm HTTP 422 Unprocessable Entity.
   - Submit invalid payload with non-30m step (e.g. 10:15–12:00). Confirm HTTP 422 Unprocessable Entity.
   - Confirm cached public slots are purged upon successful shift update.
12. **Break Time Standardization & Single String Concept (Phase 13)**:
   - In doctor dashboard, inspect WeekView and DayView break indicators.
   - In both views, verify the legend item displays strictly `Break Time` (without any `(Rest)` suffix).
   - In DayView, verify the break card displays a single clean horizontal string line: `BREAK TIME (1:00 PM – 4:00 PM) • Clinic break interval (no patient booking)` with the `BREAK TIME` badge, with no duplicate text or stacked rows.
   - In WeekView, verify the 7-day consolidated break banner displays `Break Time (1:00 PM – 4:00 PM) • Clinic break interval (no patient booking)` with the `BREAK TIME` badge.
   - Confirm complete absence of the words "lunch" or "rest" across all calendar views and modals.
   - Inspect the sidebar `Working Hours` card: verify that only active clinical shifts (Morning Shift and Evening Shift) are listed, and that no break banner is rendered in this widget.
   - Click "Edit Hours" on the sidebar card: verify that the "Customize Doctor Working Hours" popup modal renders the dynamic `Break Time` preview between shifts.
13. **Sidebar Quick Actions Card Elimination (Phase 14)**:
   - In doctor dashboard, inspect the right-side operational sidebar (`CalendarSidebar`).
   - Confirm that the `QuickActionsCard` widget (and its buttons "Add Appointment" and "Block Time / Leave") is completely removed.
   - Verify the sidebar renders solely two clean cards: the Google Calendar `MiniCalendar` and active `WorkingHoursCard`.
   - Verify appointment bookings remain fully operational by clicking any 30-minute empty slot in WeekView or DayView to launch `SlotActionModal`.
   - Run `node scripts/test_sidebar_quick_actions_clean.mjs` to ensure 100% automated structural verification.

---

## 16. Known Issues & Commitments
- **Pre-existing Failures**: None.
- **Regressions**: None detected across frontend and backend test suites.
- **Commitments & Constraints**:
  - Keep `CalendarSidebar.tsx` free of redundant create buttons (`+ New Appointment`) and fast action cards (`QuickActionsCard`).
  - Keep sidebar strictly focused on date navigation (`MiniCalendar`) and operating schedule (`WorkingHoursCard`).
  - Do not introduce the textual word "Today" in sidebar widgets or mini-calendar header; retain pure visual circular affordance.
  - Preserve timezone-immune local date calculations via `formatDateToYYYYMMDD` across all calendar utilities.
  - Maintain filled calendar slots showing only the patient name.
  - Maintain operational legend bar on top across both WeekView and DayView for UI parity.
  - Strictly use centralized constants `BREAK_TIME_LABEL`, `BREAK_TIME_BADGE`, and `BREAK_TIME_SUBTITLE` for all break time rendering; do not introduce "lunch" or "rest" vocabulary.
  - Keep the sidebar `WorkingHoursCard.tsx` strictly focused on working shifts without displaying break times.
  - Ensure doctor shift updates continue to invalidate cached public slot queries immediately.
- **Follow-ups**:
  - Phase 3: Add Complete and Cancel lifecycle transition buttons in `AppointmentDetailsPanel.tsx` and fix edit guard bug.
  - Phase 4: Dynamic public slot booking restoration in `app/[slug]/page.tsx` and kill split-brain working hours in UI.
  - Phase 5: Verification ast scripts and test runner integration.

---

## 17. Rollback & Migration Instructions
- **Code Rollback**: `git revert HEAD`
- **Database Rollback**:
  ```bash
  cd backend
  .venv/bin/alembic downgrade 008_add_patient_details_to_appointments
  ```
- **Data Implications**: Reverting migration `009_add_working_hours_to_doctor` safely drops the `working_hours` JSON column from the `doctors` table without affecting appointments, patients, schedules, tenants, or doctor authentication credentials. Reverting frontend code safely restores previous UI layouts without altering database records.

---

## 18. Branch Integration: Merge `calendar-ui` into `appointment-system`
- **Target Branch**: `appointment-system` (HEAD: `0ffe0af`)
- **Source Branch**: `calendar-ui` (HEAD: `f19b3a8`)
- **Merge Strategy**: 3-way merge (`git merge --no-commit calendar-ui`)
- **Merge Conflicts**: 0 conflicts; clean merge. All changes from `calendar-ui` successfully integrated into `appointment-system`.
- **Verification Results**:
  - `npm run test` (Comprehensive appointment test suite + calendar utils): 30/30 & 32/32 tests passed (100%).
  - `npm run test:shell` (Dashboard shell layout and responsive suites): 19/19 tests passed (100%).
  - `backend/.venv/bin/pytest backend/tests/`: 50/50 tests passed (100%).
  - Slot verification scripts (`verify_phase9_clean_slots.mjs`, `verify_calendar_drawer_scenarios.mjs`, `verify_calendar_qa_scenarios.mjs`, `verify_empty_slot_plan.mjs`): 25/25 checks passed (100%).
  - `npm run lint`: Clean (0 errors, 0 warnings).
  - `npm run build`: Production Next.js build compiled successfully (8/8 static pages prerendered).

---

## 19. Phase 2: Slot Generation Engine Harmonization (`appointment_calender_plan.md`)

- **Scope & Purpose**: Harmonized the core backend slot generation engine (`generate_available_slots`) in `schedule_service.py` to seamlessly blend explicit per-date schedule entries with doctor recurring working hours, ISO weekday closures, past-slot guards, and collision exclusions.
- **Files Modified**:
  - `backend/app/services/schedule_service.py`: Added explicit schedule precedence, shift fallback from `Doctor.working_hours`, ISO `closed_days` filtering, past-slot guard for `query_date == date.today()`, and optional `now: Optional[datetime] = None` testing parameter.
  - `backend/tests/test_working_hours_engine.py`: Added comprehensive unit test coverage covering shift slot generation, closed day suppression, explicit schedule override precedence, past-slot filtering, and exclusion subtraction.
- **Architectural Decisions**:
  - **Precedence Rule**: Explicit `Schedule(type="AVAILABLE")` entries are evaluated first; if present, recurring shifts are omitted for that day, giving doctors surgical control over specific days.
  - **Shift Fallback**: When no date-specific `AVAILABLE` records exist, the engine queries `Doctor.working_hours`. If configured, active enabled shifts are sliced into contiguous 30-minute intervals ($[t, t+30\text{m})$).
  - **ISO Weekday Closed Days**: Evaluates `query_date.weekday()` against `closed_days` (ISO: Monday=0 ... Sunday=6). Closed days immediately produce 0 candidate slots.
  - **Past-Slot Guard**: When querying the current date (`query_date == date.today()`), slots with `end_time <= datetime.now().time()` are filtered out before collision analysis.
  - **Optional Parameter for Determinism**: `generate_available_slots(doctor_id, query_date, db, now=None)` accepts an optional `now: Optional[datetime]` timestamp that defaults to `datetime.now()`, ensuring 100% backward compatibility while allowing exact deterministic clock simulations in unit tests.
- **Deviations from Plan**: None.
- **Verification Summary**:

| Step | Type | Command | Expected | Observed | Exit Code | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Shift Engine & Guard Tests** | Unit | `backend/.venv/bin/pytest backend/tests/test_working_hours_engine.py` | 15 tests pass | 15 passed in 2.79s | 0 | 🟢 PASS |
| **Legacy Slot Engine Tests** | Unit | `backend/.venv/bin/pytest backend/tests/test_slot_generation.py` | 14 tests pass | 14 passed in 1.74s | 0 | 🟢 PASS |
| **Full Backend Suite** | Regression | `backend/.venv/bin/pytest backend/tests` | 141 tests pass (Baseline: 136) | 141 passed in 70.26s | 0 | 🟢 PASS |
| **Frontend Calendar Suites** | Unit | `npm test` | 62 tests pass | 62 passed in 1.5s | 0 | 🟢 PASS |
| **Live API: Working Hours** | Manual/cURL | `GET & PUT /doctor/working-hours` | 200 OK, saved shifts & closed days | Verified 200 OK | 0 | 🟢 PASS |
| **Live API: Shift Fallback** | Manual/cURL | `GET /doctor/available-slots?date=2026-11-04` | 14 slots (10:00-13:00, 16:00-20:00) | 14 slots returned | 0 | 🟢 PASS |
| **Live API: Closed Day** | Manual/cURL | `GET /doctor/available-slots?date=2026-11-08` | `[]` (Sunday in closed_days=[6]) | `[]` returned | 0 | 🟢 PASS |
| **Live API: Precedence Override** | Manual/cURL | `POST /doctor/schedule` then `GET ...` | Explicit 08:00-09:00 overrides shifts | 2 slots returned (08:00, 08:30) | 0 | 🟢 PASS |
| **Live API: Public Practice** | Manual/cURL | `GET /public/tenants/{slug}/available-slots` | Public returns slots with TTL cache | 200 OK, slots verified | 0 | 🟢 PASS |
| **Live API: Past-Slot Guard** | Manual/cURL | `GET /doctor/available-slots?date=TODAY` | Expired intervals <= now filtered out | Only remaining evening slots | 0 | 🟢 PASS |

- **Manual Steps Pending**: None.

---

## 20. Phase 3: Appointment Lifecycle in Calendar Drawer (`appointment_calender_plan.md`)

- **Scope & Purpose**: Implemented full appointment lifecycle transitions directly within the calendar drawer panel (`AppointmentDetailsPanel.tsx`), fixed critical status edit guard bug, provided an accessible cancellation confirmation dialog, and added dynamic status badge color coding.
- **Plan Reference**: Phase 3 of `docs/feature/appointment/appointment_calender_plan.md` (Base Commit: `673e0e85ac3b835257933ee55038410e7a4864f7`).
- **Files Modified**:
  - `lib/api.ts`: Added optional `reason?: string` signature to `cancelAppointment` helper, preserving full backward compatibility.
  - `components/dashboard/calendar/panels/AppointmentDetailsPanel.tsx`:
    - Integrated `completeAppointment` with "Mark Completed" button (`CheckCircle`, emerald badge styling).
    - Integrated `cancelAppointment` with "Cancel Appointment" button (`XCircle`, rose styling) and confirmation modal dialog.
    - Added cancellation dialog with exact warning message (*"Cancelling this appointment will release this 30-minute slot for other patients."*), optional reason input, and accessible focus/escape handlers.
    - Fixed status guard bug on Edit/Reschedule button from `currentEvent.status !== "CANCELLED"` to `currentEvent.status !== "CANCELLED" && currentEvent.status !== "COMPLETED"`.
    - Added color-coded status badges: `BOOKED` (blue), `COMPLETED` (emerald), `CANCELLED` (rose), `NO_SHOW` (slate).
    - Added lifecycle transition async flows: `await ... -> onRefreshCalendar() -> showToast()`.
  - `scripts/verify_calendar_drawer_scenarios.mjs`: Added scenario S6 asserting drawer lifecycle helpers, status guard logic, warning modal text, status badges, and API functions.
- **Architectural Decisions**:
  - **In-Drawer Optimistic State Synchronization**: On successful completion or cancellation API call, `currentEvent.status` is updated in local state before or alongside `onRefreshCalendar()`. This guarantees immediate visual reflection (badge transitions to emerald/rose, edit/complete/cancel buttons gracefully disappear) while the background calendar stream refreshes.
  - **Medically Sealed Consultations Guard**: Completed consultations represent historical medical encounters and must not be rescheduled. Updating the guard to `currentEvent.status !== "CANCELLED" && currentEvent.status !== "COMPLETED"` ensures state invariants are strictly preserved in the UI.
  - **Non-Destructive Slot Release Warning**: Cancellation dialog clearly alerts doctors that confirming cancellation immediately releases the 30-minute booking window for other prospective patients via public booking.
- **Deviations from Plan**: None.
- **Verification Summary**:

| Step | Type | Command | Expected | Observed | Exit Code | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Drawer Scenarios (S1-S6)** | Unit/AST | `node scripts/verify_calendar_drawer_scenarios.mjs` | 6 scenarios pass (including S6 Lifecycle) | 6/6 passed (100%) | 0 | 🟢 PASS |
| **Frontend Calendar Suites** | Unit | `npm test` | 62 tests pass across 11 suites | 62 passed in 1.4s | 0 | 🟢 PASS |
| **TypeScript Typecheck** | Type Check | `npx tsc --noEmit` | Clean typecheck, 0 errors | Exited 0 with no errors | 0 | 🟢 PASS |
| **Frontend ESLint** | Linter | `npm run lint` | 0 errors, 0 warnings | Clean (0 warnings or errors) | 0 | 🟢 PASS |
| **Next.js Production Build** | Build | `npm run build` | 8/8 static pages prerendered | Compiled successfully | 0 | 🟢 PASS |
| **Backend Working Hours Engine** | Unit/Regression | `backend/.venv/bin/pytest backend/tests/test_working_hours_engine.py` | 15 tests pass | 15 passed in 6.07s | 0 | 🟢 PASS |

- **Manual Steps Pending**: None.

---

## 21. Phase 2 Harmonization: Open Working Hours Booking & Validation

- **Scope & Purpose**: Harmonized appointment booking validation ([`appointment_service.py:_validate_slot_against_schedule`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/appointment_service.py)) with recurring doctor working hours. Eliminated the obsolete requirement demanding manual per-date `AVAILABLE` records in the `schedules` table. Every 30-minute interval within active shifts is now bookable directly, while strictly blocking appointments on closed days, during inter-shift gaps, or when overlapping active `LEAVE`, `HOLIDAY`, or `BLOCKED` windows.
- **Plan Reference**: Phase 2 of [`docs/feature/appointment/appointment_calender_plan.md`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docs/feature/appointment/appointment_calender_plan.md) and [`unified_slot_architecture_plan.md`](file:///Users/mdaffanahmed/.gemini/antigravity/brain/c040044c-57c2-41a0-b682-aeb977fd93ce/unified_slot_architecture_plan.md) (Base Commit: `8ec50194e1e88ca3e21d00b5419869e8db1ca679`).
- **Files Modified**:
  - `backend/app/services/appointment_service.py`: Updated `_validate_slot_against_schedule` to check explicit `Schedule(type="AVAILABLE")` precedence first; if absent, validate against `doctor.working_hours` active shifts and `closed_days`. Preserved collision checks for `LEAVE`, `HOLIDAY`, and `BLOCKED`.
  - `backend/tests/test_working_hours_engine.py`: Added 5 new automated integration tests covering direct shift booking, break-time rejection, closed day rejection, leave blocking & cancellation slot restoration, and working hours rescheduling parity.
  - `docs/feature/appointment/appointment_calender_plan.md`: Updated Phase 2 plan deliverables to include validation harmonization.
  - `docs/feature/appointment/calendar-ui/calender-ui-progress.md`: Documented implementation and verification scorecard.
- **Architectural Decisions**:
  - **Explicit Available Schedule Precedence**: If per-date `Schedule(type="AVAILABLE")` rows exist, they are honored first. This preserves surgical ad-hoc override capabilities and ensures 100% backwards-compatibility with legacy unit tests.
  - **Direct Working Hours Fallback**: If no date-specific `AVAILABLE` rows exist, validation evaluates the slot against the doctor's recurring working shifts (`Doctor.working_hours`).
  - **Symmetric Leave Slot Mechanics**: When a doctor marks `LEAVE` on a slot via `SlotActionModal`, any appointment booking at that slot is blocked (`HTTP 400: Slot overlaps with LEAVE period`). Deleting/cancelling the leave via `LeaveDetailsPanel` immediately restores the slot as open and bookable.
- **Deviations from Plan**: None.
- **Verification Summary**:

| Step | Type | Command | Expected | Observed | Exit Code | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Shift Engine & Booking Tests** | Unit/Integration | `backend/.venv/bin/pytest backend/tests/test_working_hours_engine.py` | 20 tests pass (5 new) | 20 passed in 3.37s | 0 | 🟢 PASS |
| **Appointment Lifecycle Tests** | Regression | `backend/.venv/bin/pytest backend/tests/test_appointment_lifecycle.py` | 32 tests pass | 32 passed in 6.85s | 0 | 🟢 PASS |
| **Full Backend Suite** | Regression | `backend/.venv/bin/pytest backend/tests` | 146 tests pass (Baseline: 136) | 146 passed in 26.05s | 0 | 🟢 PASS |
| **Live Multi-Step Workflow** | Integration | Simulated direct booking, leave blocking & restoration | All 5 steps pass | 5/5 passed | 0 | 🟢 PASS |
| **Frontend Calendar Suites** | Unit | `npm test` | 62 tests pass | 62 passed in 1.4s | 0 | 🟢 PASS |
| **TypeScript Typecheck** | Type Check | `npx tsc --noEmit` | Clean typecheck, 0 errors | 0 errors | 0 | 🟢 PASS |
| **Frontend ESLint** | Linter | `npm run lint` | 0 errors, 0 warnings | Clean | 0 | 🟢 PASS |

- **Manual Steps Pending**: None.

