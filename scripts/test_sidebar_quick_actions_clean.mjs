import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=================================================");
console.log("🧪 CALENDAR SIDEBAR QUICK ACTIONS CLEANUP TEST SUITE");
console.log("=================================================\n");

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const ROOT = process.cwd();
const quickActionsPath = path.join(ROOT, "components", "dashboard", "calendar", "sidebar", "QuickActionsCard.tsx");
const sidebarPath = path.join(ROOT, "components", "dashboard", "calendar", "sidebar", "CalendarSidebar.tsx");
const calendarTabPath = path.join(ROOT, "components", "dashboard", "CalendarTab.tsx");
const miniCalPath = path.join(ROOT, "components", "dashboard", "calendar", "sidebar", "MiniCalendar.tsx");
const workingHoursPath = path.join(ROOT, "components", "dashboard", "calendar", "sidebar", "WorkingHoursCard.tsx");

// Test 1: QuickActionsCard.tsx is deleted
runTest("T1: QuickActionsCard.tsx does not exist in filesystem", () => {
  const exists = fs.existsSync(quickActionsPath);
  assert.strictEqual(exists, false, "QuickActionsCard.tsx still exists in filesystem!");
});

// Test 2: CalendarSidebar.tsx exists
runTest("T2: CalendarSidebar.tsx exists and is readable", () => {
  assert.strictEqual(fs.existsSync(sidebarPath), true, "CalendarSidebar.tsx is missing!");
});

const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

// Test 3: CalendarSidebar does not import QuickActionsCard
runTest("T3: CalendarSidebar.tsx does not import QuickActionsCard", () => {
  assert.strictEqual(
    sidebarContent.includes("QuickActionsCard"),
    false,
    "CalendarSidebar.tsx still mentions QuickActionsCard!"
  );
});

// Test 4: CalendarSidebarProps does not declare onAddAppointment or onBlockTime
runTest("T4: CalendarSidebarProps interface does not declare onAddAppointment or onBlockTime", () => {
  assert.strictEqual(
    sidebarContent.includes("onAddAppointment?:"),
    false,
    "CalendarSidebarProps still contains onAddAppointment!"
  );
  assert.strictEqual(
    sidebarContent.includes("onBlockTime?:"),
    false,
    "CalendarSidebarProps still contains onBlockTime!"
  );
});

// Test 5: CalendarSidebar parameters do not destructure onAddAppointment or onBlockTime
runTest("T5: CalendarSidebar component parameters do not destructure onAddAppointment or onBlockTime", () => {
  const funcDecl = sidebarContent.slice(sidebarContent.indexOf("export default function CalendarSidebar"));
  const paramsBlock = funcDecl.slice(0, funcDecl.indexOf("{"));
  assert.strictEqual(
    paramsBlock.includes("onAddAppointment"),
    false,
    "CalendarSidebar parameters still destructure onAddAppointment!"
  );
  assert.strictEqual(
    paramsBlock.includes("onBlockTime"),
    false,
    "CalendarSidebar parameters still destructure onBlockTime!"
  );
});

// Test 6: CalendarSidebar JSX does not render QuickActionsCard
runTest("T6: CalendarSidebar JSX does not render <QuickActionsCard>", () => {
  assert.strictEqual(
    sidebarContent.includes("<QuickActionsCard"),
    false,
    "CalendarSidebar JSX still renders <QuickActionsCard>!"
  );
});

// Test 7: CalendarSidebar preserves MiniCalendar and WorkingHoursCard
runTest("T7: CalendarSidebar preserves MiniCalendar and WorkingHoursCard rendering", () => {
  assert.strictEqual(
    sidebarContent.includes("<MiniCalendar"),
    true,
    "CalendarSidebar missing MiniCalendar rendering!"
  );
  assert.strictEqual(
    sidebarContent.includes("<WorkingHoursCard"),
    true,
    "CalendarSidebar missing WorkingHoursCard rendering!"
  );
});

// Test 8: CalendarTab.tsx exists and is readable
runTest("T8: CalendarTab.tsx exists and is readable", () => {
  assert.strictEqual(fs.existsSync(calendarTabPath), true, "CalendarTab.tsx is missing!");
});

const calendarTabContent = fs.readFileSync(calendarTabPath, "utf-8");

// Test 9: CalendarTab does not pass onAddAppointment or onBlockTime to CalendarSidebar
runTest("T9: CalendarTab does not pass onAddAppointment or onBlockTime to <CalendarSidebar>", () => {
  const sidebarCallMatch = calendarTabContent.match(/<CalendarSidebar[\s\S]*?\/>/);
  assert.ok(sidebarCallMatch, "Could not find <CalendarSidebar ... /> in CalendarTab.tsx");
  const sidebarCall = sidebarCallMatch[0];
  assert.strictEqual(
    sidebarCall.includes("onAddAppointment"),
    false,
    "<CalendarSidebar /> in CalendarTab.tsx still has onAddAppointment prop!"
  );
  assert.strictEqual(
    sidebarCall.includes("onBlockTime"),
    false,
    "<CalendarSidebar /> in CalendarTab.tsx still has onBlockTime prop!"
  );
});

// Test 10: CalendarTab comment updated
runTest("T10: CalendarTab comment updated to reflect clean sidebar structure", () => {
  assert.strictEqual(
    calendarTabContent.includes("Mini Calendar & Working Hours Schedule"),
    true,
    "CalendarTab does not contain updated clean sidebar comment!"
  );
});

// Test 11: MiniCalendar and WorkingHoursCard components exist
runTest("T11: Sibling sidebar components (MiniCalendar, WorkingHoursCard) intact", () => {
  assert.strictEqual(fs.existsSync(miniCalPath), true, "MiniCalendar.tsx missing!");
  assert.strictEqual(fs.existsSync(workingHoursPath), true, "WorkingHoursCard.tsx missing!");
});

console.log("\n=================================================");
console.log(`📊 RESULTS: ${passedCount} / ${totalCount} TESTS PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
console.log("=================================================\n");

if (passedCount !== totalCount) {
  process.exit(1);
}
