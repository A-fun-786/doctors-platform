#!/usr/bin/env node

/**
 * DocSpace Platform - Calendar Module & Utilities Verification Suite
 * Tests 30-minute slot granularity, time arithmetic, boundary conditions,
 * conflict detection, modal validation enforcement, and dead code elimination.
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
const modalsHookPath = path.join(projectRoot, "components", "dashboard", "calendar", "hooks", "useCalendarModals.ts");

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
  .replace(/import\s*\{[^}]*\}\s*from\s*"\.\/types";/, "")
  .replace(/import\s*\{[^}]*\}\s*from\s*"\.\/constants";/, "const DAY_NAMES = [\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\"];\nconst BREAK_TIME_LABEL = \"Break Time\";");

const jsCode = ts.transpileModule(cleanTs, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const encodedUri = "data:text/javascript;base64," + Buffer.from(jsCode).toString("base64");
const utils = await import(encodedUri);

const {
  format12Hour,
  timeToMinutes,
  minutesToTime24,
  addMinutesToTime,
  getSlot30MinKey,
  getTimeRowRange,
  isIntervalOverlapping,
  doesEventOverlapSlot,
  findConflictingEvents,
  DEFAULT_WORKING_HOURS,
  calculateShiftSlotCount,
  isSlotWithinWorkingHours,
  formatPatientClinicalNotes,
} = utils;

// ============================================================================
// SUITE 1: Dead Code Removal & Export Integrity
// ============================================================================
describe("Dead Code Removal & Export Integrity", () => {
  test("Legacy getSlotHourKey is eliminated from exports", () => {
    assert.strictEqual(utils.getSlotHourKey, undefined, "getSlotHourKey should not be exported");
  });

  test("calendarUtils.ts source does not contain getSlotHourKey definition", () => {
    assert.strictEqual(rawTs.includes("getSlotHourKey"), false, "getSlotHourKey should not exist in source code");
  });

  test("All 8 active calendar utilities are exported as functions", () => {
    const expectedFns = [
      format12Hour,
      timeToMinutes,
      minutesToTime24,
      addMinutesToTime,
      getSlot30MinKey,
      getTimeRowRange,
      isIntervalOverlapping,
      doesEventOverlapSlot,
      findConflictingEvents,
    ];
    for (const fn of expectedFns) {
      assert.strictEqual(typeof fn, "function", `Expected function but got ${typeof fn}`);
    }
  });
});

// ============================================================================
// SUITE 2: timeToMinutes & minutesToTime24 Edge Cases & Clamping
// ============================================================================
describe("timeToMinutes & minutesToTime24 Edge Cases", () => {
  test("timeToMinutes handles midnight (00:00) and end-of-day (23:59)", () => {
    assert.strictEqual(timeToMinutes("00:00"), 0);
    assert.strictEqual(timeToMinutes("23:59"), 23 * 60 + 59);
  });

  test("timeToMinutes handles empty string and malformed input gracefully", () => {
    assert.strictEqual(timeToMinutes(""), 0);
    assert.strictEqual(timeToMinutes(null), 0);
    assert.strictEqual(timeToMinutes("invalid"), 0);
    assert.strictEqual(timeToMinutes("abc:def"), 0);
  });

  test("timeToMinutes parses single-digit hour correctly (9:00)", () => {
    assert.strictEqual(timeToMinutes("9:00"), 540);
    assert.strictEqual(timeToMinutes("09:30"), 570);
  });

  test("minutesToTime24 converts 0 and 1439 (23:59)", () => {
    assert.strictEqual(minutesToTime24(0), "00:00");
    assert.strictEqual(minutesToTime24(1439), "23:59");
    assert.strictEqual(minutesToTime24(570), "09:30");
  });

  test("minutesToTime24 clamps negative values to 00:00", () => {
    assert.strictEqual(minutesToTime24(-1), "00:00");
    assert.strictEqual(minutesToTime24(-100), "00:00");
  });

  test("minutesToTime24 clamps overflow past 1440 to 23:59 (no silent midnight rollover)", () => {
    assert.strictEqual(minutesToTime24(1440), "23:59");
    assert.strictEqual(minutesToTime24(1500), "23:59");
    assert.strictEqual(minutesToTime24(9999), "23:59");
  });
});

// ============================================================================
// SUITE 3: addMinutesToTime & format12Hour / getSlot30MinKey
// ============================================================================
describe("addMinutesToTime, format12Hour, and getSlot30MinKey", () => {
  test("addMinutesToTime defaults to +30 minutes", () => {
    assert.strictEqual(addMinutesToTime("09:00"), "09:30");
    assert.strictEqual(addMinutesToTime("10:30"), "11:00");
  });

  test("addMinutesToTime supports custom minutes (+15, +60, +90)", () => {
    assert.strictEqual(addMinutesToTime("10:00", 15), "10:15");
    assert.strictEqual(addMinutesToTime("10:00", 60), "11:00");
    assert.strictEqual(addMinutesToTime("10:00", 90), "11:30");
  });

  test("addMinutesToTime past 23:30 clamps at 23:59 without wrapping to 00:xx", () => {
    assert.strictEqual(addMinutesToTime("23:45", 30), "23:59");
    assert.strictEqual(addMinutesToTime("23:50", 15), "23:59");
  });

  test("format12Hour formats morning, afternoon, noon, and midnight correctly", () => {
    assert.strictEqual(format12Hour("09:30"), "9:30 AM");
    assert.strictEqual(format12Hour("12:00"), "12:00 PM");
    assert.strictEqual(format12Hour("14:30"), "2:30 PM");
    assert.strictEqual(format12Hour("00:00"), "12:00 AM");
    assert.strictEqual(format12Hour(""), "");
  });

  test("getSlot30MinKey matches 30-minute row format", () => {
    assert.strictEqual(getSlot30MinKey("09:30"), "9:30 AM");
    assert.strictEqual(getSlot30MinKey("17:00"), "5:00 PM");
    assert.strictEqual(getSlot30MinKey(""), "");
  });
});

// ============================================================================
// SUITE 4: getTimeRowRange & Interval Overlap Logic
// ============================================================================
describe("getTimeRowRange & isIntervalOverlapping", () => {
  test("getTimeRowRange parses standard 12-hour row labels accurately", () => {
    assert.deepStrictEqual(getTimeRowRange("9:00 AM"), { start: "09:00", end: "09:30" });
    assert.deepStrictEqual(getTimeRowRange("9:30 AM"), { start: "09:30", end: "10:00" });
    assert.deepStrictEqual(getTimeRowRange("12:00 PM"), { start: "12:00", end: "12:30" });
    assert.deepStrictEqual(getTimeRowRange("12:30 PM"), { start: "12:30", end: "13:00" });
    assert.deepStrictEqual(getTimeRowRange("8:30 PM"), { start: "20:30", end: "21:00" });
    assert.deepStrictEqual(getTimeRowRange("12:30 AM"), { start: "00:30", end: "01:00" });
  });

  test("isIntervalOverlapping returns false for adjacent non-overlapping slots", () => {
    assert.strictEqual(isIntervalOverlapping("09:00", "09:30", "09:30", "10:00"), false);
    assert.strictEqual(isIntervalOverlapping("09:30", "10:00", "09:00", "09:30"), false);
  });

  test("isIntervalOverlapping detects overlapping, subset, and identical intervals", () => {
    // Overlapping partially
    assert.strictEqual(isIntervalOverlapping("09:00", "10:00", "09:30", "10:30"), true);
    // Sub-interval
    assert.strictEqual(isIntervalOverlapping("09:00", "11:00", "09:30", "10:00"), true);
    // Superset
    assert.strictEqual(isIntervalOverlapping("09:30", "10:00", "09:00", "11:00"), true);
    // Identical
    assert.strictEqual(isIntervalOverlapping("09:30", "10:00", "09:30", "10:00"), true);
  });

  test("isIntervalOverlapping handles inverted or zero ranges safely", () => {
    // If end <= start, fallback treats end as 24:00 (1440)
    assert.strictEqual(isIntervalOverlapping("10:00", "09:00", "11:00", "12:00"), true);
  });
});

// ============================================================================
// SUITE 5: doesEventOverlapSlot & findConflictingEvents
// ============================================================================
describe("doesEventOverlapSlot & findConflictingEvents", () => {
  const sampleEvents = [
    { id: "1", title: "Patient A", start: "09:00", end: "09:30", type: "APPOINTMENT", status: "BOOKED" },
    { id: "3", title: "Conference", start: "14:00", end: "16:00", type: "LEAVE", status: "CONFIRMED" },
    { id: "4", title: "Blocked Meeting", start: "11:00", end: "12:00", type: "BLOCKED", status: "CONFIRMED" },
    { id: "5", title: "Clinic Holiday", start: "00:00", end: "23:59", type: "HOLIDAY", status: "CONFIRMED" },
    { id: "6", title: "Cancelled Appt", start: "10:00", end: "10:30", type: "APPOINTMENT", status: "CANCELLED" },
  ];

  test("doesEventOverlapSlot returns true only when event hits slot window", () => {
    const appt = sampleEvents[0];
    assert.strictEqual(doesEventOverlapSlot(appt, "09:00", "09:30"), true);
    assert.strictEqual(doesEventOverlapSlot(appt, "09:30", "10:00"), false);
    assert.strictEqual(doesEventOverlapSlot(appt, "08:30", "09:00"), false);
  });

  test("findConflictingEvents ignores CANCELLED slots", () => {
    // Checking 10:00 - 10:30 which has CANCELLED (id 6)
    const noHolidayEvents = sampleEvents.filter((e) => e.type !== "HOLIDAY");
    const subConflicts = findConflictingEvents("10:00", "10:30", noHolidayEvents);
    assert.strictEqual(subConflicts.length, 0, "CANCELLED events should not trigger conflicts");
  });

  test("findConflictingEvents detects APPOINTMENT, LEAVE, BLOCKED, and HOLIDAY conflicts", () => {
    const noHolidayEvents = sampleEvents.filter((e) => e.type !== "HOLIDAY");

    // Collides with APPOINTMENT
    const c1 = findConflictingEvents("09:15", "09:45", noHolidayEvents);
    assert.strictEqual(c1.length, 1);
    assert.strictEqual(c1[0].id, "1");

    // Collides with BLOCKED
    const c2 = findConflictingEvents("11:30", "12:00", noHolidayEvents);
    assert.strictEqual(c2.length, 1);
    assert.strictEqual(c2[0].id, "4");

    // Collides with LEAVE
    const c3 = findConflictingEvents("14:30", "15:00", noHolidayEvents);
    assert.strictEqual(c3.length, 1);
    assert.strictEqual(c3[0].id, "3");

    // HOLIDAY collides with any time
    const c4 = findConflictingEvents("16:00", "16:30", sampleEvents);
    assert.strictEqual(c4.some((e) => e.type === "HOLIDAY"), true);
  });

  test("findConflictingEvents returns empty array on empty input", () => {
    assert.deepStrictEqual(findConflictingEvents("09:00", "09:30", []), []);
  });
});

// ============================================================================
// SUITE 6: Modal Hard-Block Validation Logic
// ============================================================================
describe("Modal Hard-Block Validation Logic", () => {
  const hookSource = fs.readFileSync(modalsHookPath, "utf-8");

  test("useCalendarModals enforces hard block on appointment conflicts", () => {
    assert.strictEqual(
      hookSource.includes("Cannot book appointment: Time slot conflicts with"),
      true,
      "useCalendarModals must hard block booking on conflicts"
    );
  });

  test("useCalendarModals cleanly removed availability state and handlers", () => {
    assert.strictEqual(
      hookSource.includes("showAddAvailabilityModal"),
      false,
      "showAddAvailabilityModal must be removed"
    );
    assert.strictEqual(
      hookSource.includes("handleAddAvailabilitySubmit"),
      false,
      "handleAddAvailabilitySubmit must be removed"
    );
  });

  test("useCalendarModals enforces hard block when blocking time overlaps booked appointments", () => {
    assert.strictEqual(
      hookSource.includes("Cannot block time:"),
      true,
      "useCalendarModals must hard block time exclusions on existing appointments"
    );
  });

  test("useCalendarModals enforces end > start time selection", () => {
    assert.strictEqual(
      hookSource.includes("Invalid time selection: End time must be after start time"),
      true
    );
  });
});

// ============================================================================
// SUITE 7: Editable Working Hours & Clinical Notes
// ============================================================================
describe("Editable Working Hours & Clinical Notes", () => {
  const hookSource = fs.readFileSync(modalsHookPath, "utf-8");

  test("DEFAULT_WORKING_HOURS contains enabled morning and evening shifts", () => {
    assert.ok(DEFAULT_WORKING_HOURS.shifts.length >= 2);
    const morning = DEFAULT_WORKING_HOURS.shifts.find((s) => s.id === "morning");
    const evening = DEFAULT_WORKING_HOURS.shifts.find((s) => s.id === "evening");
    assert.strictEqual(morning?.start, "10:00");
    assert.strictEqual(morning?.end, "13:00");
    assert.strictEqual(morning?.enabled, true);
    assert.strictEqual(evening?.start, "16:00");
    assert.strictEqual(evening?.end, "20:00");
    assert.strictEqual(evening?.enabled, true);
  });

  test("calculateShiftSlotCount computes 30-minute intervals correctly", () => {
    assert.strictEqual(calculateShiftSlotCount("10:00", "13:00"), 6); // 3 hrs = 6 slots
    assert.strictEqual(calculateShiftSlotCount("16:00", "20:00"), 8); // 4 hrs = 8 slots
    assert.strictEqual(calculateShiftSlotCount("09:00", "12:30"), 7); // 3.5 hrs = 7 slots
    assert.strictEqual(calculateShiftSlotCount("12:00", "12:00"), 0); // 0 hrs = 0 slots
    assert.strictEqual(calculateShiftSlotCount("14:00", "10:00"), 0); // inverted = 0 slots
  });

  test("isSlotWithinWorkingHours respects default doctor operating hours and Sunday closure", () => {
    // 2026-10-19 is Monday
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "10:00", "10:30"), true);
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "12:30", "13:00"), true);
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "16:00", "16:30"), true);
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "19:30", "20:00"), true);
    // Afternoon break (13:00 - 16:00)
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "14:00", "14:30"), false);
    // Early morning
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "08:00", "08:30"), false);
    // 2026-10-18 is Sunday (Closed)
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-18", "10:00", "10:30"), false);
  });

  test("isSlotWithinWorkingHours respects dynamic customized shifts and disabled shifts", () => {
    const customConfig = {
      shifts: [
        { id: "morning", label: "Morning", start: "09:00", end: "12:30", enabled: true },
        { id: "evening", label: "Evening", start: "17:00", end: "21:00", enabled: false }, // disabled
      ],
    };
    // 09:00-09:30 is now within morning shift
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "09:00", "09:30", customConfig), true);
    // 12:30-13:00 is outside new morning shift (which ends at 12:30)
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "12:30", "13:00", customConfig), false);
    // Evening shift is disabled, so evening slots return false
    assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "17:00", "17:30", customConfig), false);
  });

  test("formatPatientClinicalNotes formats vitals, address, and notes properly", () => {
    const formatted = formatPatientClinicalNotes({
      gender: "Female",
      age: 28,
      bloodGroup: "B+",
      height: "165 cm",
      weight: "58 kg",
      address: "Flat 402, Green Valley",
      shortNotes: "Routine follow-up required",
    });
    assert.ok(formatted.includes("[Patient Vitals] Gender: Female | Age: 28 | Blood Group: B+ | Height: 165 cm | Weight: 58 kg"));
    assert.ok(formatted.includes("[Address] Flat 402, Green Valley"));
    assert.ok(formatted.includes("[Notes] Routine follow-up required"));
  });

  test("useCalendarModals integrates slot action modal and editable working hours", () => {
    assert.ok(hookSource.includes("openSlotActionModal"), "Must expose openSlotActionModal");
    assert.ok(hookSource.includes("handleSlotBookingSubmit"), "Must expose handleSlotBookingSubmit");
    assert.ok(hookSource.includes("handleSlotLeaveSubmit"), "Must expose handleSlotLeaveSubmit");
    assert.ok(hookSource.includes("openEditWorkingHours"), "Must expose openEditWorkingHours");
    assert.ok(hookSource.includes("workingHoursConfig"), "Must expose workingHoursConfig");
  });
});

// ============================================================================
// SCORECARD & EXIT
// ============================================================================
console.log(`\n============================================================`);
console.log(`🏁 CALENDAR UTILITIES TEST SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Test Cases : ${stats.total}`);
console.log(`  Passed           : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed           : ${stats.failed}`);
console.log(`  Suites Executed  : ${stats.suites}/${stats.suites}`);
console.log(`============================================================\n`);

if (stats.failed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ALL CALENDAR UTILITIES AND HARD-BLOCK TESTS PASSED PERFECTLY!\n`);
  process.exit(0);
}
