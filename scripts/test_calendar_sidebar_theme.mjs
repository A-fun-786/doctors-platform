#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🗓️  CALENDAR SIDEBAR THEME MIGRATION VERIFICATION SUITE");
console.log("============================================================");

const miniCalPath = path.join(projectRoot, "components", "dashboard", "calendar", "sidebar", "MiniCalendar.tsx");
const workingHoursPath = path.join(projectRoot, "components", "dashboard", "calendar", "sidebar", "WorkingHoursCard.tsx");
const calendarSidebarPath = path.join(projectRoot, "components", "dashboard", "calendar", "sidebar", "CalendarSidebar.tsx");
const docPlanPath = path.join(projectRoot, "docs", "calendar_sidebar_theme_plan.md");

// 1. File existence checks
assert.ok(fs.existsSync(miniCalPath), "MiniCalendar.tsx must exist");
assert.ok(fs.existsSync(workingHoursPath), "WorkingHoursCard.tsx must exist");
assert.ok(fs.existsSync(calendarSidebarPath), "CalendarSidebar.tsx must exist");
assert.ok(fs.existsSync(docPlanPath), "calendar_sidebar_theme_plan.md must exist");
console.log("  ✅ [PASS] All calendar sidebar component files & docs exist on disk");

const miniCalSrc = fs.readFileSync(miniCalPath, "utf-8");
const workingHoursSrc = fs.readFileSync(workingHoursPath, "utf-8");
const calendarSidebarSrc = fs.readFileSync(calendarSidebarPath, "utf-8");
const docPlanSrc = fs.readFileSync(docPlanPath, "utf-8");

// Helper: Assert that a file contains an array of class tokens without relying on brittle single-string concatenation
function assertHasClasses(source, classes, context) {
  for (const cls of classes) {
    assert.ok(
      source.includes(cls),
      `${context} must include class token '${cls}'`
    );
  }
}

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

// 3. Stale comment checks in MiniCalendar.tsx
assert.strictEqual(
  miniCalSrc.toLowerCase().includes("google blue"),
  false,
  "MiniCalendar.tsx must not retain stale 'Google blue' comments"
);
console.log("  ✅ [PASS] MiniCalendar.tsx has no stale 'Google blue' comments");

// 4. MiniCalendar.tsx Brand Token Assertions (Non-brittle per-token verification)
assert.ok(
  miniCalSrc.includes('let dotColor = "bg-brand-600";'),
  "MiniCalendar must define default dotColor as bg-brand-600"
);
assertHasClasses(
  miniCalSrc,
  ["bg-brand-600", "text-white", "font-bold", "scale-105"],
  "MiniCalendar (Today & Selected state)"
);
assertHasClasses(
  miniCalSrc,
  ["border-brand-600", "text-brand-600", "bg-brand-50/50", "hover:bg-brand-100/60"],
  "MiniCalendar (Today unselected state)"
);
assertHasClasses(
  miniCalSrc,
  ["bg-brand-100", "text-brand-800", "hover:bg-brand-200/80"],
  "MiniCalendar (Selected other dates)"
);
assert.ok(
  miniCalSrc.includes('dotColor = "bg-brand-700";'),
  "MiniCalendar must set dotColor to bg-brand-700 for selected other dates"
);
console.log("  ✅ [PASS] MiniCalendar.tsx correctly uses all brand theme tokens");

// 5. WorkingHoursCard.tsx Brand Token Assertions & Harmonization
// Check zero hardcoded emerald classes (harmonized to brand-*)
const emeraldMatches = workingHoursSrc.match(/emerald-[0-9]{2,3}/g) || [];
assert.strictEqual(
  emeraldMatches.length,
  0,
  `WorkingHoursCard.tsx must not mix hardcoded emerald tokens; found: ${emeraldMatches.join(", ")}`
);
console.log("  ✅ [PASS] WorkingHoursCard.tsx has 0 unharmonized emerald-* tokens");

assertHasClasses(
  workingHoursSrc,
  ["bg-brand-50", "text-brand-600", "border-brand-100"],
  "WorkingHoursCard header clock icon"
);
assertHasClasses(
  workingHoursSrc,
  ["text-brand-600", "bg-brand-500", "animate-pulse"],
  "WorkingHoursCard active shifts indicator badge"
);
assertHasClasses(
  workingHoursSrc,
  ["text-brand-700", "hover:text-brand-800", "bg-brand-50/80", "hover:bg-brand-100/80", "border-brand-200"],
  "WorkingHoursCard Edit CTA button"
);
assertHasClasses(
  workingHoursSrc,
  ["hover:bg-brand-50/30", "hover:border-brand-200"],
  "WorkingHoursCard shift item hover"
);
assertHasClasses(
  workingHoursSrc,
  ["bg-brand-50", "text-brand-800", "border-brand-200"],
  "WorkingHoursCard slot count pill"
);
assert.ok(
  workingHoursSrc.includes("bg-brand-500"),
  "WorkingHoursCard total capacity dot must use bg-brand-500"
);
console.log("  ✅ [PASS] WorkingHoursCard.tsx correctly uses all brand theme tokens");

// 6. CalendarSidebar.tsx Structure Assertions
assert.ok(
  calendarSidebarSrc.includes('import MiniCalendar from "./MiniCalendar";'),
  "CalendarSidebar must import MiniCalendar"
);
assert.ok(
  calendarSidebarSrc.includes('import WorkingHoursCard from "./WorkingHoursCard";'),
  "CalendarSidebar must import WorkingHoursCard"
);
console.log("  ✅ [PASS] CalendarSidebar.tsx integration & imports verified");

// 7. Docs relative link verification
assert.strictEqual(
  docPlanSrc.includes("file:///"),
  false,
  "calendar_sidebar_theme_plan.md must have 0 local file:/// links"
);
assert.ok(
  docPlanSrc.includes("../config/theme.config.ts"),
  "calendar_sidebar_theme_plan.md must use relative link to theme.config.ts"
);
console.log("  ✅ [PASS] Documentation uses portable relative links without hardcoded file:/// URLs");

console.log("============================================================");
console.log("🎉 ALL CALENDAR SIDEBAR THEME TESTS PASSED (100%)");
console.log("============================================================");
