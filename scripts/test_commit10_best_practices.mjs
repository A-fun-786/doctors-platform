import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 10 BEST PRACTICES FIXES");
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

const stringsXmlPath = path.join(
  projectRoot,
  "android-template/app/src/main/res/values/strings.xml"
);
const bookingCardPath = path.join(
  projectRoot,
  "android-template/app/src/main/kotlin/com/docspace/template/ui/components/AppointmentBookingCard.kt"
);
const cardScaffoldPath = path.join(
  projectRoot,
  "android-template/app/src/main/kotlin/com/docspace/template/ui/components/DocSpaceCardScaffold.kt"
);
const videoCardPath = path.join(
  projectRoot,
  "android-template/app/src/main/kotlin/com/docspace/template/ui/components/VideoConsultationCard.kt"
);
const medicineCardPath = path.join(
  projectRoot,
  "android-template/app/src/main/kotlin/com/docspace/template/ui/components/MedicineDeliveryCard.kt"
);
const labCardPath = path.join(
  projectRoot,
  "android-template/app/src/main/kotlin/com/docspace/template/ui/components/LabDiagnosticsCard.kt"
);
const progressPath = path.join(projectRoot, "docs/refactoring_progress.md");
const rootProgressPath = path.join(projectRoot, "refactoring_progress.md");

const stringsXml = fs.readFileSync(stringsXmlPath, "utf-8");
const bookingCardCode = fs.readFileSync(bookingCardPath, "utf-8");
const cardScaffoldCode = fs.readFileSync(cardScaffoldPath, "utf-8");
const videoCardCode = fs.readFileSync(videoCardPath, "utf-8");
const medicineCardCode = fs.readFileSync(medicineCardPath, "utf-8");
const labCardCode = fs.readFileSync(labCardPath, "utf-8");
const progressContent = fs.readFileSync(progressPath, "utf-8");

// -------------------------------------------------------------
// SECTION 1: String Localization & Parameterized Formatting
// -------------------------------------------------------------

test("1.1 strings.xml defines all patient details labels and placeholders", () => {
  const requiredKeys = [
    "lbl_patient_details",
    "lbl_full_name",
    "lbl_phone_number",
    "lbl_email_optional",
    "lbl_symptoms_optional",
    "placeholder_patient_name",
    "placeholder_phone_number",
    "placeholder_email",
    "placeholder_symptoms",
    "err_name_required",
    "err_phone_required",
    "msg_booking_reference",
  ];
  for (const key of requiredKeys) {
    assert.ok(
      stringsXml.includes(`name="${key}"`),
      `strings.xml must define string resource for '${key}'`
    );
  }
});

test("1.2 AppointmentBookingCard references all 5 patient detail labels via stringResource", () => {
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.lbl_patient_details)"),
    "Must reference R.string.lbl_patient_details"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.lbl_full_name)"),
    "Must reference R.string.lbl_full_name"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.lbl_phone_number)"),
    "Must reference R.string.lbl_phone_number"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.lbl_email_optional)"),
    "Must reference R.string.lbl_email_optional"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.lbl_symptoms_optional)"),
    "Must reference R.string.lbl_symptoms_optional"
  );
});

test("1.3 AppointmentBookingCard eliminates hardcoded placeholders and labels in OutlinedTextFields", () => {
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.placeholder_patient_name)"),
    "Patient name placeholder must be localized"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.placeholder_phone_number)"),
    "Phone placeholder must be localized"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.placeholder_email)"),
    "Email placeholder must be localized"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(R.string.placeholder_symptoms)"),
    "Symptoms placeholder must be localized"
  );
});

test("1.4 AppointmentBookingCard uses parameterized format string for booking reference", () => {
  assert.ok(
    stringsXml.includes('name="msg_booking_reference"') &&
      stringsXml.includes("%1$s") &&
      stringsXml.includes("%2$s"),
    "msg_booking_reference in strings.xml must support %1$s and %2$s arguments"
  );
  assert.ok(
    bookingCardCode.includes("stringResource(\n                        R.string.msg_booking_reference,\n                        bookingId,\n                        DoctorConfig.DOCTOR_NAME\n                    )") ||
      bookingCardCode.includes("stringResource(R.string.msg_booking_reference, bookingId, DoctorConfig.DOCTOR_NAME)") ||
      bookingCardCode.includes("R.string.msg_booking_reference"),
    "Must use parameterized stringResource(R.string.msg_booking_reference, ...)"
  );
  assert.ok(
    !bookingCardCode.includes('"Your booking reference is $bookingId'),
    "Must eliminate hardcoded string interpolation 'Your booking reference is $bookingId'"
  );
});

test("1.5 Accessibility content descriptions in all cards are localized through stringResource", () => {
  const cdKeys = [
    "cd_in_clinic_card_icon",
    "cd_video_card_icon",
    "cd_pharmacy_card_icon",
    "cd_lab_card_icon",
    "cd_date_icon",
    "cd_name_icon",
    "cd_phone_icon",
    "cd_email_icon",
    "cd_confirm_icon",
    "cd_success_icon",
  ];
  for (const key of cdKeys) {
    assert.ok(
      stringsXml.includes(`name="${key}"`),
      `strings.xml must define accessibility content description '${key}'`
    );
  }
  assert.ok(
    videoCardCode.includes("stringResource(R.string.cd_video_card_icon)"),
    "VideoConsultationCard must localize iconContentDescription"
  );
  assert.ok(
    medicineCardCode.includes("stringResource(R.string.cd_pharmacy_card_icon)"),
    "MedicineDeliveryCard must localize iconContentDescription"
  );
  assert.ok(
    labCardCode.includes("stringResource(R.string.cd_lab_card_icon)"),
    "LabDiagnosticsCard must localize iconContentDescription"
  );
});

// -------------------------------------------------------------
// SECTION 2: State Preservation & Configuration Changes
// -------------------------------------------------------------

test("2.1 AppointmentBookingCard imports rememberSaveable", () => {
  assert.ok(
    bookingCardCode.includes("import androidx.compose.runtime.saveable.rememberSaveable"),
    "Must import rememberSaveable from androidx.compose.runtime.saveable"
  );
});

test("2.2 Form and submission states use rememberSaveable to survive configuration changes", () => {
  const expectedSavedStates = [
    "selectedSlot",
    "patientName",
    "patientPhone",
    "patientEmail",
    "symptomsNotes",
    "isSubmitted",
    "bookingId",
    "nameError",
    "phoneError",
  ];
  for (const stateName of expectedSavedStates) {
    assert.ok(
      bookingCardCode.includes(`var ${stateName} by rememberSaveable`),
      `State '${stateName}' must use rememberSaveable { mutableStateOf(...) }`
    );
  }
});

// -------------------------------------------------------------
// SECTION 3: Form Validation on Submission
// -------------------------------------------------------------

test("3.1 AppointmentBookingCard validates required patientName and patientPhone on submit", () => {
  assert.ok(
    bookingCardCode.includes("patientName.isNotBlank()"),
    "Must validate patientName isNotBlank"
  );
  assert.ok(
    bookingCardCode.includes("patientPhone.isNotBlank()"),
    "Must validate patientPhone isNotBlank"
  );
  assert.ok(
    bookingCardCode.includes("if (hasName && hasPhone)"),
    "Must only transition isSubmitted = true when both required fields are valid"
  );
});

test("3.2 OutlinedTextField provides error indicator and localized supportingText", () => {
  assert.ok(
    bookingCardCode.includes("isError = nameError"),
    "Patient name field must bind isError = nameError"
  );
  assert.ok(
    bookingCardCode.includes("isError = phoneError"),
    "Patient phone field must bind isError = phoneError"
  );
  assert.ok(
    bookingCardCode.includes("R.string.err_name_required"),
    "Must render localized err_name_required on validation error"
  );
  assert.ok(
    bookingCardCode.includes("R.string.err_phone_required"),
    "Must render localized err_phone_required on validation error"
  );
});

test("3.3 Form reset handler cleanly resets errors alongside form fields", () => {
  assert.ok(
    bookingCardCode.includes("nameError = false"),
    "Reset handler must reset nameError to false"
  );
  assert.ok(
    bookingCardCode.includes("phoneError = false"),
    "Reset handler must reset phoneError to false"
  );
});

// -------------------------------------------------------------
// SECTION 4: DRY Slot Grid, Reusable Composable & Theme Tokens
// -------------------------------------------------------------

test("4.1 AppointmentBookingCard defines reusable TimeSlotChip composable", () => {
  assert.ok(
    bookingCardCode.includes("private fun RowScope.TimeSlotChip"),
    "Must define reusable TimeSlotChip composable with RowScope"
  );
});

test("4.2 AppointmentBookingCard renders time slots using timeSlots.chunked(3)", () => {
  assert.ok(
    bookingCardCode.includes("timeSlots.chunked(3).forEach"),
    "Must use timeSlots.chunked(3) to render grid rows dynamically"
  );
  assert.ok(
    !bookingCardCode.includes("timeSlots.take(3).forEach") &&
      !bookingCardCode.includes("timeSlots.drop(3).take(3).forEach"),
    "Must eliminate duplicate take(3) and drop(3).take(3) blocks"
  );
});

test("4.3 All feature cards utilize theme tokens instead of hardcoded hex values", () => {
  assert.ok(
    bookingCardCode.includes("gradientColors = listOf(Brand600, Brand700)"),
    "AppointmentBookingCard must use Brand600, Brand700 tokens"
  );
  assert.ok(
    !bookingCardCode.includes("Color(0xFF2563EB)") &&
      !bookingCardCode.includes("Color(0xFF1D4ED8)"),
    "AppointmentBookingCard must not hardcode 0xFF2563EB or 0xFF1D4ED8"
  );

  assert.ok(
    videoCardCode.includes("gradientColors = listOf(Indigo600, Indigo700)"),
    "VideoConsultationCard must use Indigo600, Indigo700 tokens"
  );
  assert.ok(
    !videoCardCode.includes("Color(0xFF4338CA)"),
    "VideoConsultationCard must not hardcode 0xFF4338CA"
  );

  assert.ok(
    medicineCardCode.includes("gradientColors = listOf(Emerald600, Emerald700)"),
    "MedicineDeliveryCard must use Emerald600, Emerald700 tokens"
  );
  assert.ok(
    !medicineCardCode.includes("Color(0xFF047857)"),
    "MedicineDeliveryCard must not hardcode 0xFF047857"
  );

  assert.ok(
    labCardCode.includes("gradientColors = listOf(Purple600, Purple700)"),
    "LabDiagnosticsCard must use Purple600, Purple700 tokens"
  );
  assert.ok(
    !labCardCode.includes("Color(0xFF7E22CE)"),
    "LabDiagnosticsCard must not hardcode 0xFF7E22CE"
  );
});

test("4.4 DocSpaceCardScaffold guards against < 2 gradient colors to prevent IllegalArgumentException", () => {
  assert.ok(
    cardScaffoldCode.includes("safeGradientColors") ||
      cardScaffoldCode.includes("gradientColors.size < 2") ||
      cardScaffoldCode.includes("gradientColors.isEmpty()"),
    "DocSpaceCardScaffold must implement safe gradient color fallback"
  );
  assert.ok(
    cardScaffoldCode.includes("safeGradientColors = remember(gradientColors)"),
    "safeGradientColors should be memoized with remember(gradientColors)"
  );
  assert.ok(
    cardScaffoldCode.includes("Brush.horizontalGradient(safeGradientColors)"),
    "Brush.horizontalGradient must use safeGradientColors"
  );
});

// -------------------------------------------------------------
// SECTION 5: Architecture & Progress Tracker Integrity
// -------------------------------------------------------------

test("5.1 docs/refactoring_progress.md documents Commit 10 Review Resolution", () => {
  assert.ok(
    progressContent.includes("Commit 10"),
    "refactoring_progress.md must reference Commit 10 review resolution"
  );
  assert.ok(
    progressContent.includes("test_commit10_best_practices.mjs"),
    "refactoring_progress.md must link to test_commit10_best_practices.mjs"
  );
});

test("5.2 No duplicate refactoring_progress.md exists in repository root", () => {
  assert.ok(
    !fs.existsSync(rootProgressPath),
    "Duplicate refactoring_progress.md must not exist in repository root"
  );
  assert.ok(
    fs.existsSync(progressPath),
    "docs/refactoring_progress.md must exist as canonical progress log"
  );
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
