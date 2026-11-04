import fs from "fs";
import path from "path";
import assert from "assert";

console.log("============================================================");
console.log("🗓️  CALENDAR SIDEBAR THEME MIGRATION VERIFICATION SUITE");
console.log("============================================================");

const miniCalPath = path.resolve("components/dashboard/calendar/sidebar/MiniCalendar.tsx");
const workingHoursPath = path.resolve("components/dashboard/calendar/sidebar/WorkingHoursCard.tsx");
const calendarSidebarPath = path.resolve("components/dashboard/calendar/sidebar/CalendarSidebar.tsx");

// 1. File existence checks
assert.ok(fs.existsSync(miniCalPath), "MiniCalendar.tsx must exist");
assert.ok(fs.existsSync(workingHoursPath), "WorkingHoursCard.tsx must exist");
assert.ok(fs.existsSync(calendarSidebarPath), "CalendarSidebar.tsx must exist");
console.log("  ✅ [PASS] All calendar sidebar component files exist on disk");

const miniCalSrc = fs.readFileSync(miniCalPath, "utf-8");
const workingHoursSrc = fs.readFileSync(workingHoursPath, "utf-8");
const calendarSidebarSrc = fs.readFileSync(calendarSidebarPath, "utf-8");

// 2. Zero legacy blue-* tokens check
assert.strictEqual(
  miniCalSrc.includes("blue-"),
  false,
  "MiniCalendar.tsx must have 0 legacy blue-* tokens"
);
console.log("  ✅ [PASS] MiniCalendar.tsx has 0 legacy blue-* styles");

assert.strictEqual(
  workingHoursSrc.includes("blue-"),
  false,
  "WorkingHoursCard.tsx must have 0 legacy blue-* tokens"
);
console.log("  ✅ [PASS] WorkingHoursCard.tsx has 0 legacy blue-* styles");

assert.strictEqual(
  calendarSidebarSrc.includes("blue-"),
  false,
  "CalendarSidebar.tsx must have 0 legacy blue-* tokens"
);
console.log("  ✅ [PASS] CalendarSidebar.tsx has 0 legacy blue-* styles");

// 3. MiniCalendar.tsx Brand Token Assertions
assert.ok(
  miniCalSrc.includes('let dotColor = "bg-brand-600";'),
  "MiniCalendar must define default dotColor as bg-brand-600"
);
assert.ok(
  miniCalSrc.includes('bg-brand-600 text-white font-bold shadow-xs scale-105'),
  "MiniCalendar must use bg-brand-600 for today & selected state"
);
assert.ok(
  miniCalSrc.includes('border-2 border-brand-600 text-brand-600 font-extrabold bg-brand-50/50 shadow-2xs hover:bg-brand-100/60'),
  "MiniCalendar must use border-brand-600 text-brand-600 bg-brand-50/50 for today unselected state"
);
assert.ok(
  miniCalSrc.includes('bg-brand-100 text-brand-800 font-bold hover:bg-brand-200/80 shadow-2xs'),
  "MiniCalendar must use bg-brand-100 text-brand-800 for selected other dates"
);
assert.ok(
  miniCalSrc.includes('dotColor = "bg-brand-700";'),
  "MiniCalendar must use bg-brand-700 dotColor for selected other dates"
);
console.log("  ✅ [PASS] MiniCalendar.tsx correctly uses all brand theme tokens");

// 4. WorkingHoursCard.tsx Brand Token Assertions
assert.ok(
  workingHoursSrc.includes('bg-brand-50 text-brand-600') && workingHoursSrc.includes('border border-brand-100'),
  "WorkingHoursCard header clock icon container must use bg-brand-50 text-brand-600 border border-brand-100"
);
assert.ok(
  workingHoursSrc.includes('text-brand-700 hover:text-brand-800 bg-brand-50/80 hover:bg-brand-100/80') &&
  workingHoursSrc.includes('border border-brand-200'),
  "WorkingHoursCard Edit CTA button must use brand-700/800 and brand-50/80/brand-100/80 with border-brand-200"
);
assert.ok(
  workingHoursSrc.includes('hover:bg-brand-50/30') && workingHoursSrc.includes('hover:border-brand-200'),
  "WorkingHoursCard shift item must use hover:bg-brand-50/30 hover:border-brand-200"
);
assert.ok(
  workingHoursSrc.includes('bg-brand-50 text-brand-800 border border-brand-200'),
  "WorkingHoursCard slot count pill must use bg-brand-50 text-brand-800 border border-brand-200"
);
assert.ok(
  workingHoursSrc.includes('bg-brand-500'),
  "WorkingHoursCard total capacity dot must use bg-brand-500"
);
console.log("  ✅ [PASS] WorkingHoursCard.tsx correctly uses all brand theme tokens");

// 5. CalendarSidebar.tsx Structure Assertions
assert.ok(
  calendarSidebarSrc.includes('import MiniCalendar from "./MiniCalendar";'),
  "CalendarSidebar must import MiniCalendar"
);
assert.ok(
  calendarSidebarSrc.includes('import WorkingHoursCard from "./WorkingHoursCard";'),
  "CalendarSidebar must import WorkingHoursCard"
);
console.log("  ✅ [PASS] CalendarSidebar.tsx integration & imports verified");

console.log("============================================================");
console.log("🎉 ALL CALENDAR SIDEBAR THEME TESTS PASSED (100%)");
console.log("============================================================");

