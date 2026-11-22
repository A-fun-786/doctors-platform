import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 3 BEST PRACTICES FIXES");
console.log("============================================================");

const files = {
  addModal: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/modals/AddAppointmentModal.tsx"),
    "utf-8"
  ),
  blockModal: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/modals/BlockTimeModal.tsx"),
    "utf-8"
  ),
  eventModal: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/modals/EventDetailsModal.tsx"),
    "utf-8"
  ),
  slotActionModal: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/modals/SlotActionModal.tsx"),
    "utf-8"
  ),
  slotSelector: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/panels/SlotSelectorGrid.tsx"),
    "utf-8"
  ),
  rescheduleForm: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/panels/AppointmentRescheduleForm.tsx"),
    "utf-8"
  ),
  rescheduleConfirm: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/panels/RescheduleConfirmModal.tsx"),
    "utf-8"
  ),
  apptDetails: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/panels/AppointmentDetailsPanel.tsx"),
    "utf-8"
  ),
  leaveDetails: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/panels/LeaveDetailsPanel.tsx"),
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

// 1. Tailwind v3 Compatibility (Zero outline-hidden)
test("SlotActionModal does NOT use outline-hidden (Tailwind v3 compatible)", () => {
  assert.ok(!files.slotActionModal.includes("outline-hidden"), "SlotActionModal should not contain outline-hidden");
});

test("AppointmentDetailsPanel does NOT use outline-hidden (Tailwind v3 compatible)", () => {
  assert.ok(!files.apptDetails.includes("outline-hidden"), "AppointmentDetailsPanel should not contain outline-hidden");
});

// 2. Accessibility: Toggle and Tab Semantics
test("BlockTimeModal all-day checkbox includes aria-label", () => {
  assert.ok(
    files.blockModal.includes('aria-label="Full Day Exclusion"'),
    "BlockTimeModal toggle switch must have aria-label='Full Day Exclusion'"
  );
});

test("SlotActionModal tab switcher includes role='tablist' and role='tab'", () => {
  assert.ok(files.slotActionModal.includes('role="tablist"'), "SlotActionModal should define role='tablist'");
  assert.ok(files.slotActionModal.includes('role="tab"'), "SlotActionModal buttons should define role='tab'");
  assert.ok(files.slotActionModal.includes('aria-selected='), "SlotActionModal buttons should define aria-selected");
});

// 3. Accessibility: SlotSelectorGrid
test("SlotSelectorGrid candidate slots include aria-pressed and aria-label", () => {
  assert.ok(files.slotSelector.includes("aria-pressed={isSelected}"), "Candidate slot buttons must have aria-pressed");
  assert.ok(files.slotSelector.includes("aria-label="), "Candidate slot buttons must include descriptive aria-label");
});

// 4. Accessibility: Form Labels & IDs
test("AddAppointmentModal links labels to inputs via htmlFor/id", () => {
  assert.ok(files.addModal.includes('htmlFor="add-patient-name"'), "AddAppointmentModal must use htmlFor for patient name");
  assert.ok(files.addModal.includes('id="add-patient-name"'), "AddAppointmentModal input must have matching id");
  assert.ok(files.addModal.includes('htmlFor="add-appointment-date"'), "AddAppointmentModal must use htmlFor for date");
});

test("BlockTimeModal links labels to inputs via htmlFor/id", () => {
  assert.ok(files.blockModal.includes('htmlFor="block-date"'), "BlockTimeModal must use htmlFor for date");
  assert.ok(files.blockModal.includes('id="block-date"'), "BlockTimeModal input must have matching id");
});

// 5. Strict Design System Tokens (No rogue teal or arbitrary opacities)
test("AppointmentDetailsPanel strictly adheres to brand tokens without ad-hoc teal-50", () => {
  assert.ok(!files.apptDetails.includes("via-teal-50"), "AppointmentDetailsPanel should not contain rogue teal-50");
  assert.ok(files.apptDetails.includes("from-brand-50"), "AppointmentDetailsPanel should use from-brand-50");
});

test("SlotSelectorGrid eliminates arbitrary opacities (/80, /30)", () => {
  assert.ok(!files.slotSelector.includes("border-brand-200/80"), "SlotSelectorGrid should not contain border-brand-200/80");
  assert.ok(!files.slotSelector.includes("ring-brand-500/30"), "SlotSelectorGrid should not contain ring-brand-500/30");
  assert.ok(files.slotSelector.includes("border-brand-200"), "SlotSelectorGrid should use border-brand-200");
});

test("LeaveDetailsPanel eliminates arbitrary opacities in reassurance card", () => {
  assert.ok(!files.leaveDetails.includes("border-brand-200/80 text-xs text-brand-950"), "LeaveDetailsPanel reassurance card should not use border-brand-200/80");
  assert.ok(files.leaveDetails.includes("border-brand-200 text-xs text-brand-950"), "LeaveDetailsPanel should use border-brand-200");
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
