import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 7 BEST PRACTICES FIXES");
console.log("============================================================");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const bookingFormPath = path.join(projectRoot, "components/public-booking/AppointmentBookingForm.tsx");
const timeSlotPickerPath = path.join(projectRoot, "components/public-booking/TimeSlotPicker.tsx");
const apiPath = path.join(projectRoot, "lib/api.ts");
const scheduleRoutePath = path.join(projectRoot, "backend/app/api/routes/schedule.py");
const scheduleServicePath = path.join(projectRoot, "backend/app/services/schedule_service.py");
const planPath = path.join(projectRoot, "docs/REFACTORING_IMPLEMENTATION_PLAN.md");
const progressPath = path.join(projectRoot, "docs/refactoring_progress.md");

const bookingFormCode = fs.readFileSync(bookingFormPath, "utf-8");
const timeSlotPickerCode = fs.readFileSync(timeSlotPickerPath, "utf-8");
const apiCode = fs.readFileSync(apiPath, "utf-8");
const scheduleRouteCode = fs.readFileSync(scheduleRoutePath, "utf-8");
const scheduleServiceCode = fs.readFileSync(scheduleServicePath, "utf-8");
const planContent = fs.readFileSync(planPath, "utf-8");
const progressContent = fs.readFileSync(progressPath, "utf-8");

// 1. Timezone / UTC Drift Prevention
test("AppointmentBookingForm formats tomorrow's date with formatDateToYYYYMMDD (no toISOString UTC drift)", () => {
  assert.ok(
    !bookingFormCode.includes(".toISOString().split"),
    "Must not use toISOString().split('T')[0] for default date initialization"
  );
  assert.ok(
    bookingFormCode.includes("formatDateToYYYYMMDD(tomorrow)"),
    "Must use local formatDateToYYYYMMDD helper for tomorrow's date"
  );
});

test("TimeSlotPicker input type='date' enforces min date attribute", () => {
  assert.ok(
    timeSlotPickerCode.includes("min={effectiveMinDate}"),
    "TimeSlotPicker date input must enforce min date attribute"
  );
  assert.ok(
    bookingFormCode.includes("minDate={minDate}"),
    "AppointmentBookingForm must pass minDate to TimeSlotPicker"
  );
});

// 2. Structured Logging & Non-blocking Error UI
test("AppointmentBookingForm imports and uses structured logger from @/lib/logger", () => {
  assert.ok(
    bookingFormCode.includes('import { logger } from "@/lib/logger"'),
    "Must import structured logger"
  );
  assert.ok(
    bookingFormCode.includes('logger.error("PublicBooking"'),
    "Must record errors with structured logger under PublicBooking module"
  );
  assert.ok(
    bookingFormCode.includes('logger.action("PublicBooking"'),
    "Must track booking actions with logger.action"
  );
  assert.ok(
    !bookingFormCode.includes("console.error("),
    "Must not use raw console.error"
  );
});

test("AppointmentBookingForm eliminates blocking alert() dialogs in favor of inline error state", () => {
  assert.ok(
    !bookingFormCode.includes("alert("),
    "Must not invoke blocking window.alert()"
  );
  assert.ok(
    bookingFormCode.includes('role="alert"'),
    "Must render accessible inline error banner with role='alert'"
  );
  assert.ok(
    bookingFormCode.includes("setErrorMessage("),
    "Must manage inline error state via setErrorMessage"
  );
});

// 3. Accessibility (a11y) & Input Ergonomics
test("All form inputs in AppointmentBookingForm have explicit htmlFor / id associations", () => {
  assert.ok(
    bookingFormCode.includes('htmlFor="booking-patient-name"') && bookingFormCode.includes('id="booking-patient-name"'),
    "Patient Name input must have matching htmlFor and id"
  );
  assert.ok(
    bookingFormCode.includes('htmlFor="booking-patient-phone"') && bookingFormCode.includes('id="booking-patient-phone"'),
    "Patient Phone input must have matching htmlFor and id"
  );
  assert.ok(
    bookingFormCode.includes('htmlFor="booking-patient-email"') && bookingFormCode.includes('id="booking-patient-email"'),
    "Patient Email input must have matching htmlFor and id"
  );
  assert.ok(
    bookingFormCode.includes('htmlFor="booking-visit-notes"') && bookingFormCode.includes('id="booking-visit-notes"'),
    "Visit Notes textarea must have matching htmlFor and id"
  );
  assert.ok(
    timeSlotPickerCode.includes("htmlFor={dateInputId}") && timeSlotPickerCode.includes("id={dateInputId}"),
    "Date input in TimeSlotPicker must have matching htmlFor and id"
  );
});

test("TimeSlotPicker slot buttons implement aria-pressed", () => {
  assert.ok(
    timeSlotPickerCode.includes("aria-pressed={isSelected}"),
    "Slot buttons must announce active state with aria-pressed"
  );
});

test("AppointmentBookingForm submit button implements aria-busy", () => {
  assert.ok(
    bookingFormCode.includes("aria-busy={submitting}"),
    "Submit button must announce pending state with aria-busy"
  );
});

test("Input fields adhere to standard input ergonomics (h-10 pl-11 pr-3.5)", () => {
  assert.ok(
    bookingFormCode.includes("h-10 pl-11 pr-3.5"),
    "Patient info inputs must use standard h-10 pl-11 pr-3.5 sizing"
  );
  assert.ok(
    timeSlotPickerCode.includes("h-10 px-3.5"),
    "Date picker must use standard h-10 height and px-3.5 padding"
  );
});

// 4. Multi-Practitioner Extensibility
test("AppointmentBookingFormProps supports optional staffId / staff_id", () => {
  assert.ok(
    bookingFormCode.includes("staffId?: string") || bookingFormCode.includes("staff_id?: string"),
    "AppointmentBookingFormProps must include optional practitioner identifier"
  );
  assert.ok(
    bookingFormCode.includes("getPublicAvailableSlots(slug, date, activeStaffId)"),
    "Must forward activeStaffId to getPublicAvailableSlots"
  );
});

test("lib/api.ts supports staff_id in AppointmentBookingPayload and getPublicAvailableSlots", () => {
  assert.ok(
    apiCode.includes("staff_id?: string;"),
    "AppointmentBookingPayload must define optional staff_id"
  );
  assert.ok(
    /getPublicAvailableSlots\s*\(\s*slug:\s*string,\s*date:\s*string,\s*staffId\?:\s*string/m.test(apiCode),
    "getPublicAvailableSlots must accept optional staffId parameter"
  );
});

test("Backend schedule route and service accept optional staff_id parameter", () => {
  assert.ok(
    scheduleRouteCode.includes("staff_id: Optional[str] = Query(None"),
    "get_public_available_slots must accept optional staff_id query param"
  );
  assert.ok(
    scheduleServiceCode.includes("staff_id: Optional[str] = None"),
    "generate_available_slots must accept optional staff_id argument"
  );
});

// 5. Documentation Hygiene & Link Cleanliness
test("docs/REFACTORING_IMPLEMENTATION_PLAN.md has zero machine-specific local paths", () => {
  assert.ok(
    !planContent.includes("file:///d:"),
    "Must not contain machine-specific file:///d: absolute paths"
  );
  assert.ok(
    planContent.includes("docs/refactoring_progress.md"),
    "Must link to refactoring_progress.md with clean relative link"
  );
});

test("docs/refactoring_progress.md has zero machine-specific local paths", () => {
  assert.ok(
    !progressContent.includes("file:///d:"),
    "Must not contain machine-specific file:///d: absolute paths"
  );
});

test("Project root does NOT contain duplicate refactoring_progress.md", () => {
  const rootPath = path.join(projectRoot, "refactoring_progress.md");
  assert.ok(!fs.existsSync(rootPath), "refactoring_progress.md must remain safely deleted from project root");
});

console.log("------------------------------------------------------------");
console.log(`Results: ${passed} / ${total} tests passed.`);
if (passed === total) {
  console.log("🎉 ALL COMMIT 7 BEST PRACTICE VERIFICATIONS PASSED!");
  process.exit(0);
} else {
  console.error("❌ Some checks failed.");
  process.exit(1);
}
