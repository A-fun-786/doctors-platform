import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 2 BEST PRACTICES FIXES");
console.log("============================================================");

const files = {
  miniCalendar: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/sidebar/MiniCalendar.tsx"),
    "utf-8"
  ),
  dayStrip: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/mobile/MobileHorizonDayStrip.tsx"),
    "utf-8"
  ),
  weekView: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/views/WeekView.tsx"),
    "utf-8"
  ),
  monthView: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/views/MonthView.tsx"),
    "utf-8"
  ),
  dayView: fs.readFileSync(
    path.join(projectRoot, "components/dashboard/calendar/views/DayView.tsx"),
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

// -----------------------------------------------------------------------------
// 1. Accessibility (a11y) Verification
// -----------------------------------------------------------------------------
test("MiniCalendar has aria-current='date' and aria-pressed on date buttons", () => {
  assert.ok(
    files.miniCalendar.includes('aria-current={item.isToday ? "date" : undefined}'),
    "MiniCalendar date button must announce aria-current='date' for today"
  );
  assert.ok(
    files.miniCalendar.includes("aria-pressed={item.isSelected}"),
    "MiniCalendar date button must include aria-pressed for selected state"
  );
  assert.ok(
    files.miniCalendar.includes('aria-hidden="true"'),
    "MiniCalendar event dot must have aria-hidden='true'"
  );
});

test("MobileHorizonDayStrip has aria-current, aria-pressed, and aria-hidden on indicator dots", () => {
  assert.ok(
    files.dayStrip.includes('aria-current={isToday ? "date" : undefined}'),
    "MobileHorizonDayStrip day button must announce aria-current='date' for today"
  );
  assert.ok(
    files.dayStrip.includes("aria-pressed={isSelected}"),
    "MobileHorizonDayStrip day button must include aria-pressed"
  );
  assert.ok(
    files.dayStrip.includes('aria-hidden="true"'),
    "MobileHorizonDayStrip activity indicators must have aria-hidden='true'"
  );
});

test("WeekView has accessible day headers and aria-hidden on Today and legend dots", () => {
  assert.ok(
    files.weekView.includes('aria-current={isToday ? "date" : undefined}'),
    "WeekView day header must announce aria-current='date' for today"
  );
  assert.ok(
    files.weekView.includes("aria-pressed={day.isSelected}"),
    "WeekView day header must include aria-pressed for selected state"
  );
  assert.ok(
    files.weekView.includes('role="button"'),
    "WeekView day header must include role='button'"
  );
  assert.ok(
    files.weekView.includes('title="Today"') && files.weekView.includes('aria-hidden="true"'),
    "WeekView Today indicator dot must have aria-hidden='true'"
  );
});

test("MonthView day cells include role='button', aria-current, and aria-pressed", () => {
  assert.ok(
    files.monthView.includes('role="button"'),
    "MonthView day cell must include role='button'"
  );
  assert.ok(
    files.monthView.includes('aria-current={cell.isToday ? "date" : undefined}'),
    "MonthView day cell must include aria-current='date' for today"
  );
  assert.ok(
    files.monthView.includes("aria-pressed={cell.isSelected}"),
    "MonthView day cell must include aria-pressed"
  );
});

test("DayView decorative dots have aria-hidden='true'", () => {
  assert.ok(
    files.dayView.includes('aria-hidden="true"'),
    "DayView must include aria-hidden='true' on decorative indicator dots"
  );
});

// -----------------------------------------------------------------------------
// 2. Styling & Design Token Consistency Verification (No Arbitrary Opacities)
// -----------------------------------------------------------------------------
test("MobileHorizonDayStrip eliminates arbitrary opacities (/60, /50)", () => {
  assert.ok(!files.dayStrip.includes("bg-brand-50/60"), "MobileHorizonDayStrip must not contain bg-brand-50/60");
  assert.ok(!files.dayStrip.includes("hover:bg-brand-100/50"), "MobileHorizonDayStrip must not contain hover:bg-brand-100/50");
  assert.ok(files.dayStrip.includes("bg-brand-50 text-brand-900 font-semibold hover:bg-brand-100"), "MobileHorizonDayStrip must use clean brand tokens");
});

test("MiniCalendar eliminates arbitrary opacities (/50, /60, /80)", () => {
  assert.ok(!files.miniCalendar.includes("bg-brand-50/50"), "MiniCalendar must not contain bg-brand-50/50");
  assert.ok(!files.miniCalendar.includes("hover:bg-brand-100/60"), "MiniCalendar must not contain hover:bg-brand-100/60");
  assert.ok(!files.miniCalendar.includes("hover:bg-brand-200/80"), "MiniCalendar must not contain hover:bg-brand-200/80");
  assert.ok(files.miniCalendar.includes("bg-brand-50 shadow-2xs hover:bg-brand-100"), "MiniCalendar must use standard brand tokens");
  assert.ok(files.miniCalendar.includes("hover:bg-brand-200 shadow-2xs"), "MiniCalendar must use standard hover:bg-brand-200 token");
});

test("MonthView eliminates arbitrary opacities (/60, /20)", () => {
  assert.ok(!files.monthView.includes("bg-brand-50/60"), "MonthView must not contain bg-brand-50/60");
  assert.ok(!files.monthView.includes("bg-brand-50/20"), "MonthView must not contain bg-brand-50/20");
  assert.ok(files.monthView.includes("bg-brand-50 border-brand-500 shadow-2xs"), "MonthView must use standard bg-brand-50 for selected state");
  assert.ok(files.monthView.includes("border-brand-300 bg-brand-50"), "MonthView must use standard bg-brand-50 for today state");
});

test("WeekView eliminates arbitrary opacities (/15, /30, /50, /70)", () => {
  assert.ok(!files.weekView.includes("bg-brand-50/15"), "WeekView must not contain bg-brand-50/15");
  assert.ok(!files.weekView.includes("bg-brand-50/70"), "WeekView must not contain bg-brand-50/70");
  assert.ok(!files.weekView.includes("hover:bg-brand-50/50"), "WeekView must not contain hover:bg-brand-50/50");
  assert.ok(files.weekView.includes("bg-brand-50 shadow-inner"), "WeekView must use standard bg-brand-50 for selected header");
  assert.ok(files.weekView.includes("bg-brand-50 hover:bg-brand-100"), "WeekView must use standard bg-brand-50 hover:bg-brand-100 for today header");
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
