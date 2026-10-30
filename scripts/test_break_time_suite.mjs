#!/usr/bin/env node

/**
 * DocSpace Platform - Calendar Break Time Feature Automated Test Suite
 * Validates:
 * 1. Break Interval Calculations (Dynamic shift gap & custom override)
 * 2. Slot In Break Detection & Conflict Prevention
 * 3. Working Hours Enforcement (Break slot non-bookability)
 * 4. UI Structure Verification (DayView, WeekView, MonthView exclusion, Sidebar & Modal)
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
  timeToMinutes,
  format12Hour,
} = utils;

// ============================================================================
// SUITE 1: Break Interval Calculation Logic
// ============================================================================
describe("Break Interval Calculation Logic (A/C Working Hours)", () => {
  test("Default working hours calculates break interval between 1:00 PM and 4:00 PM (180 min)", () => {
    const breakInfo = getDoctorBreakInterval(DEFAULT_WORKING_HOURS);
    assert.ok(breakInfo, "Break info should not be null");
    assert.strictEqual(breakInfo.enabled, true);
    assert.strictEqual(breakInfo.start, "13:00");
    assert.strictEqual(breakInfo.end, "16:00");
    assert.strictEqual(breakInfo.startLabel, "1:00 PM");
    assert.strictEqual(breakInfo.endLabel, "4:00 PM");
    assert.strictEqual(breakInfo.durationMinutes, 180);
    assert.strictEqual(breakInfo.label, "Break Time");
  });

  test("Calculates break interval dynamically when shifts are customized", () => {
    const customConfig = {
      shifts: [
        { id: "morning", label: "Morning", start: "09:00", end: "12:00", enabled: true },
        { id: "evening", label: "Evening", start: "17:00", end: "21:00", enabled: true },
      ],
    };
    const breakInfo = getDoctorBreakInterval(customConfig);
    assert.ok(breakInfo);
    assert.strictEqual(breakInfo.start, "12:00");
    assert.strictEqual(breakInfo.end, "17:00");
    assert.strictEqual(breakInfo.startLabel, "12:00 PM");
    assert.strictEqual(breakInfo.endLabel, "5:00 PM");
    assert.strictEqual(breakInfo.durationMinutes, 300);
  });

  test("Explicit breakTime overrides shift gap if explicitly configured", () => {
    const customWithBreak = {
      shifts: [
        { id: "morning", label: "Morning", start: "10:00", end: "13:00", enabled: true },
        { id: "evening", label: "Evening", start: "16:00", end: "20:00", enabled: true },
      ],
      breakTime: {
        enabled: true,
        start: "13:30",
        end: "14:30",
        label: "Midday Power Nap",
      },
    };
    const breakInfo = getDoctorBreakInterval(customWithBreak);
    assert.ok(breakInfo);
    assert.strictEqual(breakInfo.start, "13:30");
    assert.strictEqual(breakInfo.end, "14:30");
    assert.strictEqual(breakInfo.label, "Midday Power Nap");
    assert.strictEqual(breakInfo.durationMinutes, 60);
  });

  test("Returns null when only 1 shift is enabled and no explicit break is set", () => {
    const singleShiftConfig = {
      shifts: [
        { id: "morning", label: "Morning", start: "10:00", end: "18:00", enabled: true },
        { id: "evening", label: "Evening", start: "19:00", end: "21:00", enabled: false },
      ],
    };
    const breakInfo = getDoctorBreakInterval(singleShiftConfig);
    assert.strictEqual(breakInfo, null, "Should return null when no shift gap exists");
  });
});

// ============================================================================
// SUITE 2: isSlotInBreak Detection
// ============================================================================
describe("isSlotInBreak Detection", () => {
  test("Slots before break return false", () => {
    assert.strictEqual(isSlotInBreak("10:00", "10:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotInBreak("12:00", "12:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotInBreak("12:30", "13:00", DEFAULT_WORKING_HOURS), false);
  });

  test("Slots completely or partially within break return true", () => {
    assert.strictEqual(isSlotInBreak("13:00", "13:30", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotInBreak("14:00", "14:30", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotInBreak("15:30", "16:00", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotInBreak("12:45", "13:15", DEFAULT_WORKING_HOURS), true); // partial boundary overlap
  });

  test("Slots after break return false", () => {
    assert.strictEqual(isSlotInBreak("16:00", "16:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotInBreak("19:30", "20:00", DEFAULT_WORKING_HOURS), false);
  });
});

// ============================================================================
// SUITE 3: isSlotWithinWorkingHours Enforcement & Hard-Block
// ============================================================================
describe("Working Hours & Break Time Booking Guard", () => {
  test("Valid morning slot is permitted on weekday", () => {
    const monday = "2026-10-19";
    assert.strictEqual(isSlotWithinWorkingHours(monday, "10:00", "10:30", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "12:30", "13:00", DEFAULT_WORKING_HOURS), true);
  });

  test("Valid evening slot is permitted on weekday", () => {
    const monday = "2026-10-19";
    assert.strictEqual(isSlotWithinWorkingHours(monday, "16:00", "16:30", DEFAULT_WORKING_HOURS), true);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "19:30", "20:00", DEFAULT_WORKING_HOURS), true);
  });

  test("Slot during break time is strictly REJECTED (cannot book)", () => {
    const monday = "2026-10-19";
    assert.strictEqual(isSlotWithinWorkingHours(monday, "13:00", "13:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "14:00", "14:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotWithinWorkingHours(monday, "15:30", "16:00", DEFAULT_WORKING_HOURS), false);
  });

  test("Sunday slots are strictly REJECTED regardless of time", () => {
    const sunday = "2026-10-25";
    assert.strictEqual(isSlotWithinWorkingHours(sunday, "10:00", "10:30", DEFAULT_WORKING_HOURS), false);
    assert.strictEqual(isSlotWithinWorkingHours(sunday, "16:00", "16:30", DEFAULT_WORKING_HOURS), false);
  });
});

// ============================================================================
// SUITE 4: UI Structure Verification (DayView, WeekView, MonthView exclusion)
// ============================================================================
describe("UI Component Structural Integrity", () => {
  test("DayView.tsx matches WeekView format with shared formatBreakTimeTitle and BREAK_TIME constants", () => {
    const dayViewSrc = fs.readFileSync(dayViewPath, "utf-8");
    assert.ok(dayViewSrc.includes("break-time-slot-card"), "DayView must have break-time-slot-card key");
    assert.ok(dayViewSrc.includes("getDoctorBreakInterval"), "DayView must call getDoctorBreakInterval");
    assert.ok(dayViewSrc.includes("BREAK_TIME_LABEL"), "DayView must use BREAK_TIME_LABEL constant");
    assert.ok(dayViewSrc.includes("formatBreakTimeTitle"), "DayView must use formatBreakTimeTitle helper (WeekView parity)");
    assert.ok(dayViewSrc.includes("BREAK_TIME_SUBTITLE"), "DayView must use BREAK_TIME_SUBTITLE constant");
    assert.ok(dayViewSrc.includes("BREAK_TIME_BADGE"), "DayView must use BREAK_TIME_BADGE constant");
    assert.strictEqual(dayViewSrc.includes("lunch"), false, "DayView must NOT include 'lunch'");
    assert.strictEqual(dayViewSrc.includes("Rest"), false, "DayView must NOT include 'Rest'");
    assert.strictEqual(dayViewSrc.includes("Doctor On Break"), false, "DayView must NOT contain duplicate 'Doctor On Break'");
    assert.ok(dayViewSrc.includes("Coffee"), "DayView must include Coffee icon");
  });

  test("WeekView.tsx includes consolidated Option A break row with shared formatBreakTimeTitle and constants", () => {
    const weekViewSrc = fs.readFileSync(weekViewPath, "utf-8");
    assert.ok(weekViewSrc.includes("week-break-time-row"), "WeekView must have week-break-time-row key");
    assert.ok(weekViewSrc.includes("getDoctorBreakInterval"), "WeekView must call getDoctorBreakInterval");
    assert.ok(weekViewSrc.includes("BREAK_TIME_LABEL"), "WeekView must use BREAK_TIME_LABEL constant");
    assert.ok(weekViewSrc.includes("formatBreakTimeTitle"), "WeekView must use formatBreakTimeTitle helper");
    assert.ok(weekViewSrc.includes("BREAK_TIME_SUBTITLE"), "WeekView must use BREAK_TIME_SUBTITLE constant");
    assert.ok(weekViewSrc.includes("BREAK_TIME_BADGE"), "WeekView must use BREAK_TIME_BADGE constant");
    assert.strictEqual(weekViewSrc.includes("lunch"), false, "WeekView must NOT include 'lunch'");
    assert.strictEqual(weekViewSrc.includes("rest"), false, "WeekView must NOT include 'rest'");
    assert.ok(weekViewSrc.includes("col-span-7"), "WeekView break row must span all 7 day columns");
  });

  test("MonthView.tsx does NOT render break slots or break icons", () => {
    const monthViewSrc = fs.readFileSync(monthViewPath, "utf-8");
    assert.strictEqual(monthViewSrc.includes("break-time"), false, "MonthView must NOT render break time slots");
    assert.strictEqual(monthViewSrc.includes("getDoctorBreakInterval"), false, "MonthView must NOT query break intervals");
    assert.strictEqual(monthViewSrc.includes("BREAK TIME"), false, "MonthView must NOT display BREAK TIME");
  });

  test("WorkingHoursCard.tsx does NOT render break time, only working shifts", () => {
    const cardSrc = fs.readFileSync(workingHoursCardPath, "utf-8");
    assert.strictEqual(cardSrc.includes("getDoctorBreakInterval"), false, "WorkingHoursCard must NOT query break intervals");
    assert.strictEqual(cardSrc.includes("Coffee"), false, "WorkingHoursCard must NOT include Coffee icon");
    assert.strictEqual(cardSrc.includes("breakInfo"), false, "WorkingHoursCard must NOT display breakInfo");
  });

  test("EditWorkingHoursModal.tsx calculates dynamic break and displays Break Time preview in popup", () => {
    const modalSrc = fs.readFileSync(editWorkingHoursModalPath, "utf-8");
    assert.ok(modalSrc.includes("calculatedBreak"), "EditWorkingHoursModal must compute calculatedBreak");
    assert.ok(modalSrc.includes("breakTime"), "EditWorkingHoursModal must include breakTime in save");
    assert.ok(modalSrc.includes("Break Time:"), "EditWorkingHoursModal must display Break Time preview");
    assert.strictEqual(modalSrc.includes("Lunch & Rest Break"), false, "EditWorkingHoursModal must NOT contain 'Lunch & Rest Break'");
  });
});

console.log(`\n============================================================`);
console.log(`🏁 BREAK TIME TEST SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Test Cases : ${stats.total}`);
console.log(`  Passed           : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed           : ${stats.failed}`);
console.log(`  Suites Executed  : ${stats.suites}/${stats.suites}`);
console.log(`============================================================\n`);

if (stats.failed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ALL BREAK TIME AUTOMATED TEST CASES PASSED WITH 100% SUCCESS!\n`);
}
