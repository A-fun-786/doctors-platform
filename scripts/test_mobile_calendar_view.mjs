import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const bottomSheetPath = path.join(ROOT, "components", "dashboard", "calendar", "mobile", "MobileBottomSheet.tsx");
const statusCapsulePath = path.join(ROOT, "components", "dashboard", "calendar", "mobile", "MobileClinicStatusCapsule.tsx");
const dayStripPath = path.join(ROOT, "components", "dashboard", "calendar", "mobile", "MobileHorizonDayStrip.tsx");
const calendarTabPath = path.join(ROOT, "components", "dashboard", "CalendarTab.tsx");
const calendarSidebarPath = path.join(ROOT, "components", "dashboard", "calendar", "sidebar", "CalendarSidebar.tsx");

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     ${err.message}`);
  }
}

console.log("\n============================================================");
console.log("📱 SUITE: Mobile Calendar & Working Hours Integration Tests");
console.log("============================================================\n");

// Test 1: MobileBottomSheet component
runTest("T1: MobileBottomSheet.tsx exists and is readable", () => {
  assert.strictEqual(fs.existsSync(bottomSheetPath), true);
  const content = fs.readFileSync(bottomSheetPath, "utf-8");
  assert.ok(content.includes("fixed inset-0 z-50 xl:hidden"), "Must be hidden on xl desktop");
  assert.ok(content.includes("backdrop-blur"), "Includes backdrop blur");
  assert.ok(content.includes("role=\"dialog\""), "WCAG modal dialog role present");
  assert.ok(content.includes("document.body.style.overflow"), "Locks body scroll on mobile");
});

// Test 2: MobileClinicStatusCapsule component
runTest("T2: MobileClinicStatusCapsule.tsx exists and computes live shift statuses", () => {
  assert.strictEqual(fs.existsSync(statusCapsulePath), true);
  const content = fs.readFileSync(statusCapsulePath, "utf-8");
  assert.ok(content.includes("enabledShifts"), "Inspects active shift intervals");
  assert.ok(content.includes("animate-ping"), "Includes pulse animation for live shift");
  assert.ok(content.includes("onOpenHoursSheet"), "Has trigger to open bottom sheet");
});

// Test 3: MobileHorizonDayStrip component
runTest("T3: MobileHorizonDayStrip.tsx renders touch-friendly 7-day strip with dots", () => {
  assert.strictEqual(fs.existsSync(dayStripPath), true);
  const content = fs.readFileSync(dayStripPath, "utf-8");
  assert.ok(content.includes("grid-cols-7"), "7 day columns");
  assert.ok(content.includes("onOpenFullMonth"), "Button to open full month mini calendar");
  assert.ok(content.includes("hasAppointments"), "Appointment activity indicator dot");
  assert.ok(content.includes("hasLeave"), "Leave/blocked activity indicator dot");
});

// Test 4: CalendarSidebar is hidden on mobile
runTest("T4: CalendarSidebar.tsx hides on mobile with hidden xl:grid", () => {
  assert.strictEqual(fs.existsSync(calendarSidebarPath), true);
  const content = fs.readFileSync(calendarSidebarPath, "utf-8");
  assert.ok(content.includes("hidden xl:grid"), "Sidebar must be hidden on mobile/tablet viewports");
});

// Test 5: CalendarTab integrates all mobile components
runTest("T5: CalendarTab.tsx integrates mobile controls and bottom sheets", () => {
  assert.strictEqual(fs.existsSync(calendarTabPath), true);
  const content = fs.readFileSync(calendarTabPath, "utf-8");
  assert.ok(content.includes("MobileClinicStatusCapsule"), "Imports and renders status capsule");
  assert.ok(content.includes("MobileHorizonDayStrip"), "Imports and renders horizon day strip");
  assert.ok(content.includes("MobileBottomSheet"), "Imports and renders mobile bottom sheets");
  assert.ok(content.includes("showMobileMiniCal"), "State for full month mini calendar bottom sheet");
  assert.ok(content.includes("showMobileWorkingHours"), "State for working hours bottom sheet");
  assert.ok(content.includes("xl:hidden space-y-3"), "Mobile island is wrapped in xl:hidden");
});

console.log("\n============================================================");
console.log(`📊 RESULTS: ${passedCount} / ${totalCount} TESTS PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
console.log("============================================================\n");

if (passedCount !== totalCount) {
  process.exit(1);
}

