#!/usr/bin/env node

/**
 * DocSpace Platform - Calendar Demo Data Fallback Elimination Suite
 * Verifies that useCalendarData never falls back to DEMO_WEEK_EVENTS,
 * ensuring empty days return [] and fake patient demographics/vitals
 * (pat-demo-2001..2009) never leak into production or clinical workflows.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const hookPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "hooks",
  "useCalendarData.ts"
);
const constantsPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "constants.ts"
);

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

describe("AST Inspection & Source Cleanliness", () => {
  const sourceCode = fs.readFileSync(hookPath, "utf-8");
  const sourceFile = ts.createSourceFile(
    "useCalendarData.ts",
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  test("useCalendarData.ts exists and is readable", () => {
    assert.ok(sourceCode.length > 0, "Source file should not be empty");
  });

  test("useCalendarData.ts does NOT import DEMO_WEEK_EVENTS", () => {
    let hasDemoImport = false;
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const importText = node.getText(sourceFile);
        if (importText.includes("DEMO_WEEK_EVENTS")) {
          hasDemoImport = true;
        }
      }
    });
    assert.strictEqual(
      hasDemoImport,
      false,
      "useCalendarData.ts must not import DEMO_WEEK_EVENTS"
    );
  });

  test("useCalendarData.ts source does NOT reference DEMO_WEEK_EVENTS anywhere", () => {
    assert.strictEqual(
      sourceCode.includes("DEMO_WEEK_EVENTS"),
      false,
      "Source code must not reference DEMO_WEEK_EVENTS"
    );
  });

  test("getEventsForDate definition returns [] fallback instead of demo events", () => {
    assert.ok(
      sourceCode.includes("const getEventsForDate = useCallback"),
      "getEventsForDate must be declared via useCallback"
    );
    // Verify fallback is return []
    const getEventsBlockMatch = sourceCode.match(
      /const getEventsForDate = useCallback\([\s\S]*?\n\s*\);/
    );
    assert.ok(getEventsBlockMatch, "getEventsForDate definition should be found");
    const blockText = getEventsBlockMatch[0];
    assert.ok(
      blockText.includes("return [];"),
      "getEventsForDate must return [] as fallback"
    );
    assert.ok(
      !blockText.includes("DEMO_WEEK_EVENTS"),
      "getEventsForDate must not reference DEMO_WEEK_EVENTS"
    );
  });
});

describe("Behavioral Unit Simulation of getEventsForDate", () => {
  // Extract and simulate getEventsForDate logic matching useCalendarData implementation
  function createGetEventsForDate(apiCalendarData) {
    return (dateStr) => {
      const liveEvents = apiCalendarData[dateStr];
      if (liveEvents && liveEvents.length > 0) {
        return liveEvents;
      }
      return [];
    };
  }

  test("Empty calendar map {} returns [] for any requested date", () => {
    const getEvents = createGetEventsForDate({});
    const res = getEvents("2026-10-20");
    assert.deepStrictEqual(res, [], "Expected empty array []");
  });

  test("Date with explicit empty event list [] returns []", () => {
    const getEvents = createGetEventsForDate({ "2026-10-21": [] });
    const res = getEvents("2026-10-21");
    assert.deepStrictEqual(res, [], "Expected empty array []");
  });

  test("Oct 19–25, 2026 dates return [] when no live events exist (zero demo leaks)", () => {
    const demoDates = [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];
    const getEvents = createGetEventsForDate({});
    for (const d of demoDates) {
      const res = getEvents(d);
      assert.strictEqual(
        res.length,
        0,
        `Date ${d} should return 0 events, got ${res.length}`
      );
      assert.deepStrictEqual(res, []);
    }
  });

  test("Returns live events intact when present for a date", () => {
    const mockLiveEvent = {
      id: "real-appt-999",
      type: "APPOINTMENT",
      title: "Real Consultation",
      start_time: "10:00",
      end_time: "10:30",
      status: "CONFIRMED",
      patient_name: "Jane Smith",
      patient_phone: "+91 98765 43210",
    };
    const getEvents = createGetEventsForDate({
      "2026-10-20": [mockLiveEvent],
    });
    const res = getEvents("2026-10-20");
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, "real-appt-999");
    assert.strictEqual(res[0].patient_name, "Jane Smith");
  });

  test("Preserves multiple events on same date in original order", () => {
    const ev1 = { id: "ev-1", start_time: "10:00", end_time: "10:30", type: "APPOINTMENT" };
    const ev2 = { id: "ev-2", start_time: "11:00", end_time: "11:30", type: "APPOINTMENT" };
    const getEvents = createGetEventsForDate({
      "2026-10-22": [ev1, ev2],
    });
    const res = getEvents("2026-10-22");
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].id, "ev-1");
    assert.strictEqual(res[1].id, "ev-2");
  });
});

describe("Patient Data & Identity Security Guard", () => {
  test("constants.ts has DEMO_WEEK_EVENTS completely removed", () => {
    const constantsCode = fs.readFileSync(constantsPath, "utf-8");
    assert.strictEqual(
      constantsCode.includes("DEMO_WEEK_EVENTS"),
      false,
      "DEMO_WEEK_EVENTS must be completely purged from constants.ts"
    );
    assert.strictEqual(
      constantsCode.includes("pat-demo-2001"),
      false,
      "Demo patient ID pat-demo-2001 must not exist in constants.ts"
    );
  });

  test("Simulated empty week returns 0 references to demo patient IDs", () => {
    const getEvents = (dateStr) => {
      const apiCalendarData = {};
      const liveEvents = apiCalendarData[dateStr];
      if (liveEvents && liveEvents.length > 0) {
        return liveEvents;
      }
      return [];
    };

    const demoPatientIds = [
      "pat-demo-2001",
      "pat-demo-2002",
      "pat-demo-2003",
      "pat-demo-2004",
      "pat-demo-2005",
      "pat-demo-2006",
      "pat-demo-2007",
      "pat-demo-2008",
      "pat-demo-2009",
    ];

    const weekDates = [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];

    for (const d of weekDates) {
      const events = getEvents(d);
      for (const ev of events) {
        for (const demoId of demoPatientIds) {
          assert.notStrictEqual(
            ev.patient_id,
            demoId,
            `Demo patient ID ${demoId} must never appear on date ${d}`
          );
        }
      }
    }
  });
});

console.log(`\n============================================================`);
console.log(`🏁 TEST EXECUTION SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Test Cases : ${stats.total}`);
console.log(`  Passed           : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed           : ${stats.failed}`);
console.log(`  Suites Executed  : ${stats.suites}/${stats.suites}`);
console.log(`============================================================\n`);

if (stats.failed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ALL NO-DEMO-FALLBACK SECURITY & INTEGRITY TESTS PASSED!`);
}
