import fs from "fs";
import path from "path";
import assert from "assert";

console.log("============================================================");
console.log("🗓️  CALENDAR LEGEND THEME VERIFICATION SUITE");
console.log("============================================================");

const weekViewPath = path.resolve("components/dashboard/calendar/views/WeekView.tsx");
const dayViewPath = path.resolve("components/dashboard/calendar/views/DayView.tsx");

// 1. Files existence
assert.ok(fs.existsSync(weekViewPath), "WeekView.tsx must exist");
assert.ok(fs.existsSync(dayViewPath), "DayView.tsx must exist");
console.log("  ✅ [PASS] Calendar view files exist on disk");

const weekViewSrc = fs.readFileSync(weekViewPath, "utf-8");
const dayViewSrc = fs.readFileSync(dayViewPath, "utf-8");

// 2. WeekView Legend Indicator Dot Assertions
assert.ok(
  weekViewSrc.includes('bg-brand-600 border border-brand-700'),
  "WeekView appointment legend indicator dot must use bg-brand-600 border border-brand-700"
);
assert.ok(
  !weekViewSrc.includes('bg-blue-600 border border-blue-700'),
  "WeekView must not contain legacy bg-blue-600 border border-blue-700 for legend"
);
console.log("  ✅ [PASS] WeekView appointment legend dot correctly uses Clinical Emerald (brand-600)");

// 3. DayView Legend Patient Dot Assertions
assert.ok(
  dayViewSrc.includes('rounded-full bg-brand-500'),
  "DayView patient appointment legend dot must use bg-brand-500"
);
console.log("  ✅ [PASS] DayView patient appointment legend dot correctly uses Diagnostic Mint (brand-500)");

// 4. DayView KPI Summary Card Preservation Verification
assert.ok(
  dayViewSrc.includes('bg-blue-50 text-blue-600'),
  "DayView KPI summary card icon must be preserved as bg-blue-50 text-blue-600"
);
console.log("  ✅ [PASS] DayView Summary KPI Icon strictly preserved as bg-blue-50 text-blue-600 per specification");

console.log("============================================================");
console.log("🎉 ALL CALENDAR LEGEND THEME TESTS PASSED (100%)");
console.log("============================================================");

