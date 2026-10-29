#!/usr/bin/env node

/**
 * Test Suite: DayView Mobile Layout & Summary KPI Verification
 * Verifies:
 * 1. Summary KPI cards match OverviewTab pattern (3-column single row on mobile & desktop, icon container, tabular numbers, uppercase labels)
 * 2. Slot cards keep text in the same row on mobile screens (flex items-center justify-between, shrink-0 time, min-w-0 flex-1 truncate details, self-center badge)
 * 3. All 5 slot card variations (Appointment, Empty, Leave, Blocked, Break) adhere to the single-row contract
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const dayViewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "views",
  "DayView.tsx"
);
const dayView = fs.readFileSync(dayViewPath, "utf-8");

const overviewTabPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "OverviewTab.tsx"
);
const overviewTab = fs.readFileSync(overviewTabPath, "utf-8");

console.log("\n============================================================");
console.log("🧪 SUITE: DayView Mobile Single-Row Layout & Summary KPI Cards");
console.log("============================================================");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     ${err.message}`);
  }
}

// -------------------------------------------------------------
// SECTION 1: Summary KPI Cards Verification (Matching OverviewTab)
// -------------------------------------------------------------

test("1.1 Summary KPI grid uses 3-column layout on both mobile and desktop (grid-cols-3)", () => {
  assert.ok(
    dayView.includes("grid grid-cols-3 gap-2 sm:gap-4"),
    "Summary KPI grid must use grid-cols-3 so all 3 cards stay in 1 row on mobile"
  );
  assert.ok(
    !dayView.includes("grid-cols-1 xs:grid-cols-3"),
    "Legacy vertical stacking grid-cols-1 must be removed"
  );
});

test("1.2 Summary KPI cards use OverviewTab styling pattern (white card, border, shadow, padding)", () => {
  assert.ok(
    dayView.includes(
      "bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs p-2.5 sm:p-5 flex flex-col items-center text-center gap-1 sm:gap-2"
    ),
    "DayView KPI cards must match OverviewTab card styles"
  );
});

test("1.3 Summary KPI cards feature icon containers matching OverviewTab", () => {
  assert.ok(
    dayView.includes("w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600"),
    "Appointments card must feature blue icon capsule"
  );
  assert.ok(
    dayView.includes("w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600"),
    "Empty Slots card must feature emerald icon capsule"
  );
  assert.ok(
    dayView.includes("w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600"),
    "Leaves card must feature amber icon capsule"
  );
});

test("1.4 Summary KPI numbers and labels use OverviewTab typography", () => {
  assert.ok(
    dayView.includes("text-lg sm:text-3xl font-bold text-slate-900 tabular-nums leading-none"),
    "Metrics must use bold tabular-nums leading-none typography"
  );
  assert.ok(
    dayView.includes("text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-tight line-clamp-2"),
    "Labels must use uppercase tracking-wide styling matching OverviewTab"
  );
});

// -------------------------------------------------------------
// SECTION 2: Slot Cards Mobile Same-Row Layout
// -------------------------------------------------------------

test("2.1 Slot cards container does NOT collapse into flex-col on mobile", () => {
  // Check that legacy flex-col sm:flex-row is completely removed from slot cards
  assert.ok(
    !dayView.includes("flex flex-col sm:flex-row sm:items-center justify-between"),
    "No slot card container should use flex-col on mobile"
  );
  assert.ok(
    !dayView.includes("self-start sm:self-auto"),
    "Badges should not use self-start on mobile (which causes them to drop to a new line)"
  );
});

test("2.2 Booked Appointment slot card keeps time, patient details and badge on the same row", () => {
  assert.ok(
    dayView.includes("border-blue-200 bg-blue-50/30 hover:border-blue-400 hover:shadow-xs"),
    "Appointment card styling exists"
  );
  assert.ok(
    dayView.includes("font-mono text-[11px] sm:text-xs font-bold text-slate-800 w-24 sm:w-36 shrink-0 truncate"),
    "Time column has fixed shrink-0 width to prevent wrapping"
  );
  assert.ok(
    dayView.includes("font-semibold text-xs text-blue-950 flex items-center gap-1.5 truncate"),
    "Patient name and reason use flex items-center with truncate on a single line"
  );
});

test("2.3 Empty slot card keeps time, empty label and badge on the same row", () => {
  assert.ok(
    dayView.includes("border border-dashed border-slate-200 bg-slate-50/60 hover:bg-blue-50/40"),
    "Empty slot card exists"
  );
  assert.ok(
    dayView.includes("font-mono text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-blue-700 w-24 sm:w-36 shrink-0 truncate"),
    "Empty slot time column has fixed shrink-0 width"
  );
  assert.ok(
    dayView.includes("font-medium text-xs text-slate-600 flex items-center gap-1.5 sm:gap-2 truncate"),
    "Empty slot text stays in single row"
  );
});

test("2.4 Doctor Leave and Clinic Holiday slot card keeps text on the same row", () => {
  assert.ok(
    dayView.includes("border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-xs"),
    "Leave slot card exists"
  );
  assert.ok(
    dayView.includes("font-semibold text-xs text-amber-950 flex items-center gap-1.5 truncate"),
    "Leave text stays on a single line with truncate"
  );
});

test("2.5 Blocked Period slot card keeps text on the same row", () => {
  assert.ok(
    dayView.includes("border-purple-200 bg-purple-50/40 hover:border-purple-400 hover:shadow-xs"),
    "Blocked slot card exists"
  );
  assert.ok(
    dayView.includes("font-semibold text-xs text-purple-950 flex items-center gap-1.5 truncate"),
    "Blocked text stays on a single line with truncate"
  );
});

test("2.6 Break Time slot card keeps coffee icon, time, title and badge on the same row", () => {
  assert.ok(
    dayView.includes("key=\"break-time-slot-card\""),
    "Break slot card exists"
  );
  assert.ok(
    dayView.includes("font-mono text-[11px] sm:text-xs font-bold text-amber-950 w-24 sm:w-36 shrink-0 truncate"),
    "Break time column has fixed shrink-0 width"
  );
  assert.ok(
    dayView.includes("flex items-center gap-1.5 min-w-0 flex-1 truncate"),
    "Break title stays on a single line with truncate"
  );
});

console.log("\n============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================\n");

if (passed !== total) {
  process.exit(1);
}

