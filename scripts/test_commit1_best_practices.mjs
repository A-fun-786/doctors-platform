import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 1 BEST PRACTICES FIXES");
console.log("============================================================");

const files = {
  capsule: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/mobile/MobileClinicStatusCapsule.tsx"),
    "utf-8"
  ),
  modal: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/modals/EditWorkingHoursModal.tsx"),
    "utf-8"
  ),
  card: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/sidebar/WorkingHoursCard.tsx"),
    "utf-8"
  ),
  header: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/views/CalendarHeader.tsx"),
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

// 1. Tailwind v3 Compatibility (No outline-hidden)
test("CalendarHeader does NOT use outline-hidden (Tailwind v3 compatible)", () => {
  assert.ok(!files.header.includes("outline-hidden"), "CalendarHeader should not contain outline-hidden");
  assert.ok(files.header.includes("focus-visible:outline-none"), "CalendarHeader should use focus-visible:outline-none");
});

test("EditWorkingHoursModal does NOT use outline-hidden (Tailwind v3 compatible)", () => {
  assert.ok(!files.modal.includes("outline-hidden"), "EditWorkingHoursModal should not contain outline-hidden");
  assert.ok(files.modal.includes("focus:outline-none"), "EditWorkingHoursModal should use focus:outline-none");
  assert.ok(files.modal.includes("peer-focus:outline-none"), "Toggle switch should use peer-focus:outline-none");
});

// 2. Accessibility (a11y)
test("MobileClinicStatusCapsule has aria-hidden='true' on decorative pulsing dots", () => {
  assert.ok(
    files.capsule.includes('aria-hidden="true"'),
    "Pulsing indicator in MobileClinicStatusCapsule must have aria-hidden='true'"
  );
});

test("WorkingHoursCard has aria-hidden='true' on decorative indicator dots", () => {
  assert.ok(
    files.card.includes('aria-hidden="true"'),
    "Decorative dots in WorkingHoursCard must have aria-hidden='true'"
  );
});

test("EditWorkingHoursModal toggle switches include accessible aria-label", () => {
  assert.ok(
    files.modal.includes("aria-label={`Enable ${shift.label"),
    "Toggle switch checkbox must have an explicit aria-label"
  );
});

// 3. Design Token Consistency (No ad-hoc teal tokens in brand components)
test("MobileClinicStatusCapsule strictly adheres to brand tokens without ad-hoc teal-50", () => {
  assert.ok(!files.capsule.includes("via-teal-50"), "MobileClinicStatusCapsule must not use via-teal-50");
  assert.ok(files.capsule.includes("via-brand-50"), "MobileClinicStatusCapsule must use brand gradient token");
});

test("EditWorkingHoursModal strictly adheres to brand tokens without ad-hoc teal-50", () => {
  assert.ok(!files.modal.includes("via-teal-50"), "EditWorkingHoursModal capacity banner must not use via-teal-50");
  assert.ok(files.modal.includes("via-brand-50"), "EditWorkingHoursModal must use brand gradient token");
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
