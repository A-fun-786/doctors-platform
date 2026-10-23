#!/usr/bin/env node

/**
 * DocSpace Platform - QuickActionsCard Removal & Calendar UI Verification Suite
 * Exhaustive automated test suite validating the complete removal of QuickActionsCard,
 * interface tightening of CalendarSidebar, preservation of modal hooks/APIs,
 * slot-click appointment booking pathways, and edge cases.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
};

function describe(suiteName, fn) {
  stats.suites++;
  console.log(`\n============================================================`);
  console.log(`🧪 SUITE [${stats.suites}]: ${suiteName}`);
  console.log(`============================================================`);
  fn();
}

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    stats.failed++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// File paths
const quickActionsPath = path.join(projectRoot, "components", "dashboard", "calendar", "sidebar", "QuickActionsCard.tsx");
const calendarSidebarPath = path.join(projectRoot, "components", "dashboard", "calendar", "sidebar", "CalendarSidebar.tsx");
const calendarTabPath = path.join(projectRoot, "components", "dashboard", "CalendarTab.tsx");
const weekViewPath = path.join(projectRoot, "components", "dashboard", "calendar", "views", "WeekView.tsx");
const dayViewPath = path.join(projectRoot, "components", "dashboard", "calendar", "views", "DayView.tsx");
const blockTimeModalPath = path.join(projectRoot, "components", "dashboard", "calendar", "modals", "BlockTimeModal.tsx");
const useCalendarModalsPath = path.join(projectRoot, "components", "dashboard", "calendar", "hooks", "useCalendarModals.ts");

// ============================================================================
// SUITE 1: File Deletion & Component Tree Integrity
// ============================================================================
describe("File Deletion & Component Tree Integrity", () => {
  test("QuickActionsCard.tsx is completely deleted from sidebar directory", () => {
    assert.strictEqual(
      fs.existsSync(quickActionsPath),
      false,
      "QuickActionsCard.tsx should not exist on filesystem"
    );
  });

  test("CalendarSidebar.tsx has zero imports of QuickActionsCard", () => {
    const content = fs.readFileSync(calendarSidebarPath, "utf-8");
    assert.doesNotMatch(
      content,
      /import.*QuickActionsCard/i,
      "CalendarSidebar.tsx must not import QuickActionsCard"
    );
  });

  test("CalendarSidebar.tsx JSX does not contain <QuickActionsCard", () => {
    const content = fs.readFileSync(calendarSidebarPath, "utf-8");
    assert.doesNotMatch(
      content,
      /<QuickActionsCard/i,
      "CalendarSidebar.tsx JSX must not render <QuickActionsCard>"
    );
  });

  test("CalendarSidebar.tsx renders MiniCalendar and WorkingHoursCard exclusively", () => {
    const content = fs.readFileSync(calendarSidebarPath, "utf-8");
    assert.match(content, /<MiniCalendar/, "CalendarSidebar must render <MiniCalendar>");
    assert.match(content, /<WorkingHoursCard\s*\/>/, "CalendarSidebar must render <WorkingHoursCard />");
  });

  test("CalendarSidebar container styling maintains responsive grid layout", () => {
    const content = fs.readFileSync(calendarSidebarPath, "utf-8");
    assert.match(content, /className="xl:col-span-3 space-y-5"/);
  });
});

// ============================================================================
// SUITE 2: TypeScript Interface Tightening & CalendarSidebar Props
// ============================================================================
describe("CalendarSidebarProps Interface Tightening (T1 & T5)", () => {
  const content = fs.readFileSync(calendarSidebarPath, "utf-8");
  const sourceFile = ts.createSourceFile(
    "CalendarSidebar.tsx",
    content,
    ts.ScriptTarget.Latest,
    true
  );

  let interfaceMembers = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "CalendarSidebarProps") {
      interfaceMembers = node.members.map((m) => m.name?.getText(sourceFile));
    }
  });

  test("CalendarSidebarProps declares only expected props", () => {
    const expected = ["miniCalMonth", "setMiniCalMonth", "miniCalDays", "onSelectDate"];
    assert.deepStrictEqual(
      interfaceMembers.sort(),
      expected.sort(),
      `CalendarSidebarProps should contain exactly ${expected.join(", ")}, got: ${interfaceMembers.join(", ")}`
    );
  });

  test("CalendarSidebarProps strictly forbids onAddAppointment", () => {
    assert.strictEqual(
      interfaceMembers.includes("onAddAppointment"),
      false,
      "CalendarSidebarProps must not declare onAddAppointment"
    );
  });

  test("CalendarSidebarProps strictly forbids onBlockTime", () => {
    assert.strictEqual(
      interfaceMembers.includes("onBlockTime"),
      false,
      "CalendarSidebarProps must not declare onBlockTime"
    );
  });

  test("CalendarSidebar function signature does not destructure removed props", () => {
    assert.doesNotMatch(
      content,
      /onAddAppointment/,
      "CalendarSidebar component function must not mention onAddAppointment"
    );
    assert.doesNotMatch(
      content,
      /onBlockTime/,
      "CalendarSidebar component function must not mention onBlockTime"
    );
  });
});

// ============================================================================
// SUITE 3: CalendarTab Consumer Wiring
// ============================================================================
describe("CalendarTab.tsx Consumer Cleanliness & Layout Wiring", () => {
  const content = fs.readFileSync(calendarTabPath, "utf-8");

  test("CalendarTab does not pass onAddAppointment to CalendarSidebar", () => {
    const sidebarBlockMatch = content.match(/<CalendarSidebar[\s\S]*?\/>/);
    assert.ok(sidebarBlockMatch, "CalendarSidebar invocation must exist in CalendarTab");
    const sidebarBlock = sidebarBlockMatch[0];
    assert.doesNotMatch(
      sidebarBlock,
      /onAddAppointment/,
      "CalendarSidebar JSX invocation must not pass onAddAppointment"
    );
  });

  test("CalendarTab does not pass onBlockTime to CalendarSidebar", () => {
    const sidebarBlockMatch = content.match(/<CalendarSidebar[\s\S]*?\/>/);
    assert.ok(sidebarBlockMatch, "CalendarSidebar invocation must exist in CalendarTab");
    const sidebarBlock = sidebarBlockMatch[0];
    assert.doesNotMatch(
      sidebarBlock,
      /onBlockTime/,
      "CalendarSidebar JSX invocation must not pass onBlockTime"
    );
  });

  test("CalendarSidebar in CalendarTab receives only valid props", () => {
    const sidebarBlockMatch = content.match(/<CalendarSidebar[\s\S]*?\/>/);
    const sidebarBlock = sidebarBlockMatch[0];
    assert.match(sidebarBlock, /miniCalMonth=\{miniCalMonth\}/);
    assert.match(sidebarBlock, /setMiniCalMonth=\{setMiniCalMonth\}/);
    assert.match(sidebarBlock, /miniCalDays=\{miniCalDays\}/);
    assert.match(sidebarBlock, /onSelectDate=\{setSelectedDate\}/);
  });

  test("CalendarTab right sidebar column label updated cleanly", () => {
    assert.match(
      content,
      /{\/\*\s*Right Column:\s*Mini Calendar,\s*Working Hours\s*\*\/}/,
      "Comment should reflect removed Quick Actions"
    );
  });
});

// ============================================================================
// SUITE 4: Booking Pathways Continuity (T2 & T3)
// ============================================================================
describe("Appointment Booking Pathways Continuity (WeekView & DayView)", () => {
  const tabContent = fs.readFileSync(calendarTabPath, "utf-8");
  const weekContent = fs.readFileSync(weekViewPath, "utf-8");
  const dayContent = fs.readFileSync(dayViewPath, "utf-8");

  test("T2: WeekView available slot click connects to openAddAppointment in CalendarTab", () => {
    assert.match(
      tabContent,
      /onAvailableSlotClick=\{openAddAppointment\}/,
      "CalendarTab must pass openAddAppointment to WeekView.onAvailableSlotClick"
    );
    assert.match(
      weekContent,
      /onAvailableSlotClick:\s*\(date:\s*string,\s*start:\s*string,\s*end:\s*string\)\s*=>\s*void/,
      "WeekView interface must declare onAvailableSlotClick with (date, start, end)"
    );
  });

  test("T2: WeekView slot chip click triggers onAvailableSlotClick", () => {
    assert.match(
      weekContent,
      /onAvailableSlotClick\(day\.dateStr,\s*event\.start,\s*event\.end\)/,
      "WeekView event chip onClick must invoke onAvailableSlotClick with day.dateStr, event.start, event.end"
    );
  });

  test("T3: DayView 'Book Patient' button connects to openAddAppointment in CalendarTab", () => {
    assert.match(
      tabContent,
      /onBookPatient=\{\(\)\s*=>\s*openAddAppointment\(selectedDate\)\}/,
      "CalendarTab must pass () => openAddAppointment(selectedDate) to DayView.onBookPatient"
    );
    assert.match(
      dayContent,
      /onBookPatient:\s*\(\)\s*=>\s*void/,
      "DayView interface must declare onBookPatient callback"
    );
    assert.match(
      dayContent,
      /Book Patient/,
      "DayView must render 'Book Patient' button"
    );
  });

  test("T3: DayView connects onBookPatient and onEventClick in CalendarTab", () => {
    assert.match(
      dayContent,
      /onEventClick:\s*\(event:\s*CalendarEvent,\s*date:\s*string\)\s*=>\s*void/,
      "DayView interface must declare onEventClick callback"
    );
    assert.match(
      tabContent,
      /onEventClick=\{openEventDetails\}/,
      "CalendarTab must pass openEventDetails to DayView.onEventClick"
    );
  });
});

// ============================================================================
// SUITE 5: BlockTimeModal & Hook State Preservation (T4)
// ============================================================================
describe("BlockTimeModal & useCalendarModals Preservation (T4)", () => {
  const tabContent = fs.readFileSync(calendarTabPath, "utf-8");
  const modalsHookContent = fs.readFileSync(useCalendarModalsPath, "utf-8");
  const blockModalContent = fs.readFileSync(blockTimeModalPath, "utf-8");

  test("BlockTimeModal.tsx file exists and exports component intact", () => {
    assert.ok(fs.existsSync(blockTimeModalPath), "BlockTimeModal.tsx must exist");
    assert.match(
      blockModalContent,
      /export\s+default\s+function\s+BlockTimeModal/,
      "BlockTimeModal must export default component"
    );
  });

  test("CalendarTab renders <BlockTimeModal> with all required handlers", () => {
    assert.match(tabContent, /<BlockTimeModal[\s\S]*?isOpen=\{showBlockModal\}/);
    assert.match(tabContent, /onClose=\{\(\)\s*=>\s*setShowBlockModal\(false\)\}/);
    assert.match(tabContent, /onSubmit=\{\(e\)\s*=>\s*handleBlockSubmit/);
  });

  test("useCalendarModals retains block state, openBlockModal, and submit handler", () => {
    assert.match(modalsHookContent, /const\s+\[showBlockModal,\s*setShowBlockModal\]/);
    assert.match(modalsHookContent, /const\s+\[blockType,\s*setBlockType\]/);
    assert.match(modalsHookContent, /const\s+\[blockReason,\s*setBlockReason\]/);
    assert.match(modalsHookContent, /const\s+openBlockModal\s*=\s*useCallback/);
    assert.match(modalsHookContent, /const\s+handleBlockSubmit\s*=\s*useCallback/);
  });

  test("openBlockModal initializes date, start time, end time, and sets modal open", () => {
    assert.match(modalsHookContent, /setShowBlockModal\(true\)/);
    assert.match(modalsHookContent, /setBlockType\("BLOCKED"\)/);
    assert.match(modalsHookContent, /setModalDate\(date\)/);
    assert.match(modalsHookContent, /setModalStartTime\(start\)/);
    assert.match(modalsHookContent, /setModalEndTime\(end\)/);
  });

  test("BlockTimeModal supports blockType selection options", () => {
    assert.match(blockModalContent, /BLOCKED/);
    assert.match(blockModalContent, /LEAVE/);
    assert.match(blockModalContent, /HOLIDAY/);
  });
});

// ============================================================================
// SUITE 6: Documentation & Global Project Consistency
// ============================================================================
describe("Documentation & Global Project Consistency", () => {
  test("README.md does not reference QuickActionsCard in tree", () => {
    const readmeContent = fs.readFileSync(path.join(projectRoot, "README.md"), "utf-8");
    assert.doesNotMatch(
      readmeContent,
      /QuickActionsCard\.tsx/,
      "README.md component tree must not contain QuickActionsCard.tsx"
    );
  });

  test("CALENDAR_UI_DOCUMENTATION.md does not list QuickActionsCard as active widget", () => {
    const docContent = fs.readFileSync(
      path.join(projectRoot, "docs", "feature", "appointment", "calendar-ui", "CALENDAR_UI_DOCUMENTATION.md"),
      "utf-8"
    );
    assert.doesNotMatch(
      docContent,
      /QuickActionsCard\.tsx.*Sidebar Widget/,
      "CALENDAR_UI_DOCUMENTATION.md must not list QuickActionsCard as an active widget"
    );
    assert.doesNotMatch(
      docContent,
      /└── QuickActionsCard/,
      "CALENDAR_UI_DOCUMENTATION.md tree must not list QuickActionsCard"
    );
  });
});

// ============================================================================
// SUMMARY SCORECARD
// ============================================================================
console.log(`\n============================================================`);
console.log(`🏁 QUICK ACTIONS REMOVAL TEST SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Test Cases : ${stats.total}`);
console.log(`  Passed           : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed           : ${stats.failed}`);
console.log(`  Suites Executed  : ${stats.suites}/${stats.suites}`);
console.log(`============================================================\n`);

if (stats.failed > 0) {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
} else {
  console.log("🎉 ALL QUICK ACTIONS REMOVAL AND INTEGRITY TESTS PASSED PERFECTLY!\n");
  process.exit(0);
}
