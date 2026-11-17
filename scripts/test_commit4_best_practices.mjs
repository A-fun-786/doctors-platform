import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 4 BEST PRACTICES FIXES");
console.log("============================================================");

const files = {
  toast: fs.readFileSync(path.join(projectRoot, "components/ui/Toast.tsx"), "utf-8"),
  patientPortal: fs.readFileSync(path.join(projectRoot, "app/[slug]/page.tsx"), "utf-8"),
  badge: fs.readFileSync(path.join(projectRoot, "components/ui/Badge.tsx"), "utf-8"),
  globalError: fs.readFileSync(path.join(projectRoot, "app/global-error.tsx"), "utf-8"),
  bookingForm: fs.readFileSync(
    path.join(projectRoot, "components/public-booking/AppointmentBookingForm.tsx"),
    "utf-8"
  ),
  confirmationCard: fs.readFileSync(
    path.join(projectRoot, "components/public-booking/BookingConfirmationCard.tsx"),
    "utf-8"
  ),
  slotPicker: fs.readFileSync(
    path.join(projectRoot, "components/public-booking/TimeSlotPicker.tsx"),
    "utf-8"
  ),
};

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

// 1. Toast Semantic Status Token Integrity
test("Toast info alert uses semantic text-sky-400 (not brand/emerald)", () => {
  assert.ok(files.toast.includes("text-sky-400"), "Toast info variant must use text-sky-400");
  assert.ok(
    !files.toast.includes("text-brand-400"),
    "Toast info variant must not conflate info status with text-brand-400"
  );
});

// 2. Patient Portal: Design Token Integrity & Purple Elimination
test("Patient portal reports banner uses brand-600 to brand-800 gradient", () => {
  assert.ok(
    files.patientPortal.includes("from-brand-600 to-brand-800"),
    "Reports banner must use from-brand-600 to-brand-800 gradient"
  );
  assert.ok(
    !files.patientPortal.includes("from-purple-700 to-slate-900"),
    "Untokenized purple banner gradient must be eliminated"
  );
});

test("Patient portal contains zero residual purple tokens", () => {
  const purpleMatch = files.patientPortal.match(/purple-\d+/g);
  assert.equal(
    purpleMatch,
    null,
    `Patient portal still contains purple tokens: ${purpleMatch ? purpleMatch.join(", ") : ""}`
  );
});

test("Patient portal diagnostic card and pillar icons use brand-100/700 tokens", () => {
  assert.ok(
    files.patientPortal.includes("bg-brand-100 text-brand-700"),
    "Service cards and commitment pillars must use bg-brand-100 text-brand-700"
  );
});

test("Diagnostic report form inputs utilize focus:ring-brand-500", () => {
  assert.ok(
    files.patientPortal.includes("focus:ring-brand-500"),
    "Report inputs must use focus:ring-brand-500"
  );
  assert.ok(
    !files.patientPortal.includes("focus:ring-purple-500"),
    "Report inputs must not contain focus:ring-purple-500"
  );
});

// 3. Accessibility (a11y) in Public Portal Forms
test("Diagnostic report form associates labels with inputs via htmlFor & id", () => {
  assert.ok(
    files.patientPortal.includes('htmlFor="rep-patient-name"') &&
      files.patientPortal.includes('id="rep-patient-name"'),
    "Patient name label must link to input via htmlFor/id"
  );
  assert.ok(
    files.patientPortal.includes('htmlFor="rep-contact-phone"') &&
      files.patientPortal.includes('id="rep-contact-phone"'),
    "Contact phone label must link to input via htmlFor/id"
  );
  assert.ok(
    files.patientPortal.includes('htmlFor="rep-category"') &&
      files.patientPortal.includes('id="rep-category"'),
    "Category label must link to select via htmlFor/id"
  );
  assert.ok(
    files.patientPortal.includes('htmlFor="rep-notes"') &&
      files.patientPortal.includes('id="rep-notes"'),
    "Notes label must link to textarea via htmlFor/id"
  );
});

test("Diagnostic file input includes accessible aria-label", () => {
  assert.ok(
    files.patientPortal.includes('aria-label="Upload Diagnostic File"'),
    "File input must provide accessible aria-label"
  );
});

// 4. Monolith De-duplication Verification (Phase 2 Decoupling)
test("Modular public-booking components exist and are decoupled from page.tsx", () => {
  assert.ok(files.bookingForm.length > 0, "AppointmentBookingForm component must exist");
  assert.ok(files.confirmationCard.length > 0, "BookingConfirmationCard component must exist");
  assert.ok(files.slotPicker.length > 0, "TimeSlotPicker component must exist");
});

// 5. Shared UI Globals Conformance
test("Badge default variant uses brand tokens", () => {
  assert.ok(
    files.badge.includes("bg-brand-50 text-brand-700 border-brand-200"),
    "Badge default variant must use brand tokens"
  );
});

test("global-error reload button uses brand-600 CTA", () => {
  assert.ok(
    files.globalError.includes("bg-brand-600"),
    "Root error boundary button must use bg-brand-600"
  );
});

console.log("------------------------------------------------------------");
console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
