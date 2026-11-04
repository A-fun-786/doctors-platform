import fs from "fs";
import path from "path";
import assert from "assert";

console.log("============================================================");
console.log("🗓️  CALENDAR VIEW SWITCHER (DAY / WEEK / MONTH) THEME TEST");
console.log("============================================================");

const calendarHeaderPath = path.resolve("components/dashboard/calendar/views/CalendarHeader.tsx");

// 1. File existence
assert.ok(fs.existsSync(calendarHeaderPath), "CalendarHeader.tsx must exist on disk");
console.log("  ✅ [PASS] CalendarHeader.tsx exists on disk");

const headerSrc = fs.readFileSync(calendarHeaderPath, "utf-8");

// 2. Zero legacy blue-* tokens check
assert.strictEqual(
  headerSrc.includes("blue-"),
  false,
  "CalendarHeader.tsx must have 0 legacy blue-* tokens"
);
console.log("  ✅ [PASS] CalendarHeader.tsx has 0 legacy blue-* classes");

// 3. Day, Week, Month Active Brand Token Assertions
assert.ok(
  headerSrc.includes('viewMode === "day"\n                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"') ||
  headerSrc.includes('viewMode === "day"\r\n                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"'),
  "Day button must use bg-brand-600 hover:bg-brand-700 for active state"
);
console.log("  ✅ [PASS] Day button uses active brand-600/700 emerald tokens");

assert.ok(
  headerSrc.includes('viewMode === "week"\n                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"') ||
  headerSrc.includes('viewMode === "week"\r\n                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"'),
  "Week button must use bg-brand-600 hover:bg-brand-700 for active state"
);
console.log("  ✅ [PASS] Week button uses active brand-600/700 emerald tokens");

assert.ok(
  headerSrc.includes('viewMode === "month"\n                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"') ||
  headerSrc.includes('viewMode === "month"\r\n                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"'),
  "Month button must use bg-brand-600 hover:bg-brand-700 for active state"
);
console.log("  ✅ [PASS] Month button uses active brand-600/700 emerald tokens");

// 4. Inactive Hover State Assertions
assert.ok(
  headerSrc.includes(': "text-slate-600 hover:text-brand-700 hover:bg-brand-50/70"'),
  "Inactive buttons must use soft mint hover: text-brand-700 hover:bg-brand-50/70"
);
console.log("  ✅ [PASS] Inactive buttons use clinical mint hover (text-brand-700, bg-brand-50/70)");

// 5. Accessibility Focus Ring Assertions
const focusMatches = headerSrc.match(/focus-visible:ring-brand-500/g);
assert.ok(
  focusMatches && focusMatches.length >= 3,
  "All 3 view switcher buttons (Day, Week, Month) must have focus-visible:ring-brand-500"
);
console.log("  ✅ [PASS] WCAG AA focus-visible rings (focus-visible:ring-brand-500) verified on all 3 buttons");

console.log("============================================================");
console.log("🎉 ALL CALENDAR VIEW SWITCHER THEME TESTS PASSED (100%)");
console.log("============================================================");

