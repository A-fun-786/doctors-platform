#!/usr/bin/env node

/**
 * DocSpace Platform - Calendar Schedule & Break-Removal Automated Test Suite
 * Validates:
 * 1. Schedule Interval Engine (Operating shifts without forced break entities)
 * 2. Working Hours Enforcement (Non-scheduled gap non-bookability)
 * 3. UI Structure Verification (DayView, WeekView, MonthView, Sidebar & Modal Break-free integrity)
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const calendarUtilsPath = path.join(projectRoot, "components", "dashboard", "calendar", "calendarUtils.ts");
const dayViewPath = path.join(projectRoot, "components", "dashboard", "calendar", "views", "DayView.tsx");
const weekViewPath = path.join(projectRoot, "components", "dashboard", "calendar", "views", "WeekView.tsx");
const monthViewPath = path.join(projectRoot, "components", "dashboard", "calendar", "views", "MonthView.tsx");
const workingHoursCardPath = path.join(projectRoot, "components", "dashboard", "calendar", "sidebar", "WorkingHoursCard.tsx");
const editWorkingHoursModalPath = path.join(projectRoot, "components", "dashboard", "calendar", "modals", "EditWorkingHoursModal.tsx");

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

// Load and transpile calendarUtils.ts dynamically
const rawTs = fs.readFileSync(calendarUtilsPath, "utf-8");
const cleanTs = rawTs
  .replace(/import\s*\{\s*CalendarEvent\s*\}\s*from\s*"@\/lib\/api";/, "")
  .replace(/import\s*\{\s*WeekDayItem[^}]*\}\s*from\s*"\.\/types";/, "")
  .replace(/import\s*\{[^}]*\}\s*from\s*"\.\/constants";/, "const DAY_NAMES = [\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\"]; const BREAK_TIME_LABEL = \"Break Time\";");

const jsCode = ts.transpileModule(cleanTs, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const encodedUri = "data:text/javascript;base64," + Buffer.from(jsCode).toString("base64");
const utils = await import(encodedUri);

const {
  DEFAULT_WORKING_HOURS,
  getDoctorBreakInterval,
  isSlotInBreak,
  isSlotWithinWorkingHours,
} = utils;

// ============================================================================
// SUITE 1: Break Removal Engine Logic
// ============================================================================
describe("Schedule Engine (Operating Windows Without Forced Breaks)", () => {
  test("getDoctorBreakInterval safely returns null (breaks removed per specification)", () => {
    const breakInfo = getDoctorBreakInterval(DEFAULT_WORKING_HOURS);
    assert.strictEqual(breakInfo, null, "Break info must be null as breaks are removed");
  });

  test("isSlotInBreak consistently returns false", () => {
    assert.strictEqual(isSlotInBreak("13:00", "13:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotInBreak("14:00", "15:00", DEFAULT_WORKING_HOURS), false);
  });
});

// ============================================================================
// SUITE 2: isSlotWithinWorkingHours Operating Shift Guard
// ============================================================================
describe("Operating Hours Booking Guard (Start to End Time Boundaries)", () => {
  test("Slots within active Schedule 1 (10:00 - 13:00) are permitted on weekday", () => {
    const monday = "2026-10-19";
    assert.strictEqual(isSlotWithinWorkingHours(monday, "10:00", "10:30", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "12:30", "13:00", DEFAULT_WORKING_HOURS), true);
  });

  test("Slots within active Schedule 2 (16:00 - 20:00) are permitted on weekday", () => {
    const monday = "2026-10-19";
    assert.strictEqual(isSlotWithinWorkingHours(monday, "16:00", "16:30", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "19:30", "20:00", DEFAULT_WORKING_HOURS), true);
  });

  test("Slots in gap outside active schedules (e.g. 13:00 - 16:00) are naturally REJECTED", () => {
    const monday = "2026-10-19";
    assert.strictEqual(isSlotWithinWorkingHours(monday, "13:00", "13:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "14:00", "14:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "15:30", "16:00", DEFAULT_WORKING_HOURS), false);
  });

  test("Sunday slots are strictly REJECTED when closed_days contains Sunday", () => {
    const sunday = "2026-10-25";
    assert.strictEqual(isSlotWithinWorkingHours(sunday, "10:00", "10:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotWithinWorkingHours(sunday, "16:00", "16:30", DEFAULT_WORKING_HOURS), false);
  });
});

// ============================================================================
// SUITE 3: UI Structure Verification (DayView, WeekView, MonthView, Modal)
// ============================================================================
describe("UI Component Break-Free Structural Integrity", () => {
  test("DayView.tsx does NOT render intrusive break cards or break banners", () => {
    const dayViewSrc = fs.readFileSync(dayViewPath, "utf-8");
    assert.strictEqual(dayViewSrc.includes("break-time-slot-card"), false, "DayView must NOT have break-time-slot-card");
    assert.strictEqual(dayViewSrc.includes("renderBreakSlotCard"), false, "DayView must NOT call renderBreakSlotCard");
    assert.strictEqual(dayViewSrc.includes("BREAK_TIME_LABEL"), false, "DayView must NOT import BREAK_TIME_LABEL");
  });

  test("WeekView.tsx does NOT render 7-day break row banner", () => {
    const weekViewSrc = fs.readFileSync(weekViewPath, "utf-8");
    assert.strictEqual(weekViewSrc.includes("week-break-time-row"), false, "WeekView must NOT have week-break-time-row");
    assert.strictEqual(weekViewSrc.includes("renderWeekBreakRow"), false, "WeekView must NOT call renderWeekBreakRow");
    assert.strictEqual(weekViewSrc.includes("BREAK_TIME_LABEL"), false, "WeekView must NOT import BREAK_TIME_LABEL");
  });

  test("MonthView.tsx does NOT render break slots or break icons", () => {
    const monthViewSrc = fs.readFileSync(monthViewPath, "utf-8");
    assert.strictEqual(monthViewSrc.includes("break-time"), false, "MonthView must NOT render break time slots");
    assert.strictEqual(monthViewSrc.includes("getDoctorBreakInterval"), false, "MonthView must NOT query break intervals");
  });

  test("WorkingHoursCard.tsx renders operating shifts cleanly without break icons", () => {
    const cardSrc = fs.readFileSync(workingHoursCardPath, "utf-8");
    assert.strictEqual(cardSrc.includes("getDoctorBreakInterval"), false, "WorkingHoursCard must NOT query break intervals");
    assert.strictEqual(cardSrc.includes("Coffee"), false, "WorkingHoursCard must NOT include Coffee icon");
  });

  test("EditWorkingHoursModal.tsx provides '+ Add Another Schedule Window' and has NO breakTime preview", () => {
    const modalSrc = fs.readFileSync(editWorkingHoursModalPath, "utf-8");
    assert.strictEqual(modalSrc.includes("calculatedBreak"), false, "EditWorkingHoursModal must NOT compute calculatedBreak");
    assert.strictEqual(modalSrc.includes("Break Time:"), false, "EditWorkingHoursModal must NOT display Break Time banner");
    assert.ok(modalSrc.includes("handleAddSchedule"), "EditWorkingHoursModal must support adding schedules");
    assert.ok(modalSrc.includes("+ Add Another Schedule Window"), "EditWorkingHoursModal must include Add Another Schedule CTA");
  });
});

console.log(`\n============================================================`);
console.log(`🏁 SCHEDULE ENGINE TEST SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Test Cases : ${stats.total}`);
console.log(`  Passed           : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed           : ${stats.failed}`);
console.log(`  Suites Executed  : ${stats.suites}/${stats.suites}`);

if (stats.failed > 0) {
  process.exit(1);
}
