import fs from "fs";
import path from "path";
import assert from "assert";

console.log("============================================================");
console.log("🗓️  CALENDAR TODAY CURRENT DATE THEME VERIFICATION SUITE");
console.log("============================================================");

const weekViewPath = path.resolve("components/dashboard/calendar/views/WeekView.tsx");
const mobileStripPath = path.resolve("components/dashboard/calendar/mobile/MobileHorizonDayStrip.tsx");
const monthViewPath = path.resolve("components/dashboard/calendar/views/MonthView.tsx");

// 1. Files existence
assert.ok(fs.existsSync(weekViewPath), "WeekView.tsx must exist");
assert.ok(fs.existsSync(mobileStripPath), "MobileHorizonDayStrip.tsx must exist");
assert.ok(fs.existsSync(monthViewPath), "MonthView.tsx must exist");
console.log("  ✅ [PASS] All calendar view files exist on disk");

const weekViewSrc = fs.readFileSync(weekViewPath, "utf-8");
const mobileStripSrc = fs.readFileSync(mobileStripPath, "utf-8");
const monthViewSrc = fs.readFileSync(monthViewPath, "utf-8");

// 2. WeekView.tsx Date Header Brand Assertions
assert.ok(
  weekViewSrc.includes('border-2 border-brand-600 text-brand-600 bg-brand-50/50 font-black shadow-2xs hover:bg-brand-100/60'),
  "WeekView must use border-2 border-brand-600 text-brand-600 bg-brand-50/50 for today unselected state"
);
console.log("  ✅ [PASS] WeekView today unselected badge uses brand-600 border and brand-50 background");

assert.ok(
  weekViewSrc.includes('day.isSelected\n                      ? "bg-brand-600 text-white shadow-xs"') ||
  weekViewSrc.includes('day.isSelected\r\n                      ? "bg-brand-600 text-white shadow-xs"'),
  "WeekView must use bg-brand-600 text-white for selected date badge"
);
console.log("  ✅ [PASS] WeekView selected date badge uses solid brand-600 emerald");

assert.ok(
  weekViewSrc.includes('className="w-1.5 h-1.5 rounded-full bg-brand-600 inline-block shrink-0"'),
  "WeekView must use bg-brand-600 for today pulsing dot"
);
console.log("  ✅ [PASS] WeekView today indicator dot uses bg-brand-600");

assert.ok(
  weekViewSrc.includes('isToday\n                        ? "text-brand-600"') ||
  weekViewSrc.includes('isToday\r\n                        ? "text-brand-600"'),
  "WeekView must use text-brand-600 for today day name label"
);
console.log("  ✅ [PASS] WeekView day name label uses text-brand-600 for today");

assert.ok(
  weekViewSrc.includes('isToday\n                    ? "bg-brand-50/30 hover:bg-brand-50/60"') ||
  weekViewSrc.includes('isToday\r\n                    ? "bg-brand-50/30 hover:bg-brand-50/60"'),
  "WeekView must use bg-brand-50/30 for today header column tint"
);
console.log("  ✅ [PASS] WeekView today header column uses subtle brand-50 tint");

// 3. MobileHorizonDayStrip.tsx Brand Assertions
assert.ok(
  mobileStripSrc.includes('border border-brand-300 bg-brand-50/60 text-brand-900 font-semibold hover:bg-brand-100/50'),
  "MobileHorizonDayStrip must use border-brand-300 bg-brand-50/60 text-brand-900 for today chip"
);
console.log("  ✅ [PASS] MobileHorizonDayStrip today chip uses brand-300 border and brand-50 tint");

assert.ok(
  mobileStripSrc.includes('isToday\n                    ? "text-brand-600"') ||
  mobileStripSrc.includes('isToday\r\n                    ? "text-brand-600"'),
  "MobileHorizonDayStrip must use text-brand-600 for today label"
);
console.log("  ✅ [PASS] MobileHorizonDayStrip today label uses text-brand-600");

// 4. MonthView.tsx Brand Assertions
assert.ok(
  monthViewSrc.includes('cell.isToday\n                    ? "border-brand-300 bg-brand-50/30"') ||
  monthViewSrc.includes('cell.isToday\r\n                    ? "border-brand-300 bg-brand-50/30"'),
  "MonthView must use border-brand-300 bg-brand-50/30 for today cell"
);
console.log("  ✅ [PASS] MonthView today cell uses border-brand-300 and bg-brand-50/30");

assert.ok(
  monthViewSrc.includes('cell.isToday\n                        ? "w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold shadow-xs text-[11px] sm:text-xs"') ||
  monthViewSrc.includes('cell.isToday\r\n                        ? "w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold shadow-xs text-[11px] sm:text-xs"'),
  "MonthView must use bg-brand-600 text-white for today date circle"
);
console.log("  ✅ [PASS] MonthView today date circle uses bg-brand-600 text-white");

// 5. Preserved Calendar Slots Check
assert.ok(
  weekViewSrc.includes('prefStyles.apptBorder'),
  "WeekView must preserve slot shift themes and preference borders"
);
console.log("  ✅ [PASS] WeekView calendar slot appointment and shift themes are preserved intact");

console.log("============================================================");
console.log("🎉 ALL CALENDAR TODAY CURRENT DATE THEME TESTS PASSED (100%)");
console.log("============================================================");

