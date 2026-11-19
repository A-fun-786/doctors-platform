import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 8 BEST PRACTICES FIXES");
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
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const calendarUtilsPath = path.join(projectRoot, "components/dashboard/calendar/calendarUtils.ts");
const dayViewPath = path.join(projectRoot, "components/dashboard/calendar/views/DayView.tsx");
const weekViewPath = path.join(projectRoot, "components/dashboard/calendar/views/WeekView.tsx");
const cardPath = path.join(projectRoot, "components/ui/Card.tsx");
const badgePath = path.join(projectRoot, "components/ui/Badge.tsx");
const statusBadgePath = path.join(projectRoot, "components/ui/StatusBadge.tsx");
const utilsPath = path.join(projectRoot, "lib/utils.ts");
const packageJsonPath = path.join(projectRoot, "package.json");

const calendarUtilsCode = fs.readFileSync(calendarUtilsPath, "utf-8");
const dayViewCode = fs.readFileSync(dayViewPath, "utf-8");
const weekViewCode = fs.readFileSync(weekViewPath, "utf-8");
const cardCode = fs.readFileSync(cardPath, "utf-8");
const badgeCode = fs.readFileSync(badgePath, "utf-8");
const statusBadgeCode = fs.readFileSync(statusBadgePath, "utf-8");
const utilsCode = fs.readFileSync(utilsPath, "utf-8");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

// -------------------------------------------------------------
// SECTION 1: Multi-Doctor Concurrency in resolveCellEvents
// -------------------------------------------------------------

test("1.1 calendarUtils exports ResolvedCellEvents with apptEvents: CalendarEvent[] array", () => {
  assert.ok(
    calendarUtilsCode.includes("apptEvents: CalendarEvent[];"),
    "ResolvedCellEvents interface must include apptEvents: CalendarEvent[]"
  );
  assert.ok(
    calendarUtilsCode.includes("apptEvent?: CalendarEvent;"),
    "ResolvedCellEvents interface must retain apptEvent?: CalendarEvent for backward compatibility"
  );
});

test("1.2 resolveCellEvents filters all appointments using .filter() (no dropped concurrent bookings)", () => {
  assert.ok(
    calendarUtilsCode.includes('cellEvents.filter((ev) => ev.type === "APPOINTMENT")'),
    "Must filter all concurrent appointments using cellEvents.filter"
  );
  assert.ok(
    calendarUtilsCode.includes("apptEvents[0]"),
    "Must retain apptEvent as first item of apptEvents for backward compatibility"
  );
});

test("1.3 DayView renders all concurrent appointments via apptEvents.map", () => {
  assert.ok(
    dayViewCode.includes("apptEvents && apptEvents.length > 0"),
    "DayView must guard on apptEvents array length"
  );
  assert.ok(
    dayViewCode.includes("apptEvents.map("),
    "DayView must map over all apptEvents to avoid dropping concurrent appointments"
  );
});

test("1.4 WeekView renders all concurrent appointments via apptEvents.map", () => {
  assert.ok(
    weekViewCode.includes("apptEvents && apptEvents.length > 0"),
    "WeekView must guard on apptEvents array length"
  );
  assert.ok(
    weekViewCode.includes("apptEvents.map("),
    "WeekView must map over all apptEvents to render concurrent practitioner appointments"
  );
});

// -------------------------------------------------------------
// SECTION 2: Tailwind Specificity Collisions & Card Primitives
// -------------------------------------------------------------

test("2.1 Dependencies contain clsx and tailwind-merge in package.json", () => {
  assert.ok(
    packageJson.dependencies["clsx"] || packageJson.devDependencies["clsx"],
    "clsx must be present in package.json"
  );
  assert.ok(
    packageJson.dependencies["tailwind-merge"] || packageJson.devDependencies["tailwind-merge"],
    "tailwind-merge must be present in package.json"
  );
});

test("2.2 lib/utils.ts exports cn helper integrating clsx and tailwind-merge", () => {
  assert.ok(
    utilsCode.includes("import { twMerge } from \"tailwind-merge\""),
    "lib/utils.ts must import twMerge"
  );
  assert.ok(
    utilsCode.includes("export function cn("),
    "lib/utils.ts must export cn function"
  );
});

test("2.3 Card primitives utilize cn to resolve class specificity collisions", () => {
  assert.ok(
    cardCode.includes('import { cn } from "@/lib/utils"'),
    "Card.tsx must import cn from @/lib/utils"
  );
  assert.ok(
    cardCode.includes("cn("),
    "Card.tsx must use cn to merge class names"
  );
  assert.ok(
    !cardCode.includes("`${className}`"),
    "Card.tsx must not use raw string interpolation for classes"
  );
});

test("2.4 twMerge correctly resolves mobile vs desktop rounded and padding collisions", () => {
  // Test runtime behavior of twMerge + clsx (exact logic in lib/utils.ts)
  const cn = (...inputs) => twMerge(clsx(inputs));
  
  // Card base collision resolution: consumer rounded-xl sm:rounded-2xl overrides base rounded-2xl
  const mergedCard = cn("bg-white rounded-2xl border border-slate-200 shadow-xs", "rounded-xl sm:rounded-2xl");
  assert.ok(
    !mergedCard.includes("rounded-2xl rounded-xl"),
    "Conflicting rounded classes must not coexist"
  );
  assert.ok(
    mergedCard.includes("rounded-xl sm:rounded-2xl"),
    "Consumer override must take precedence"
  );

  // CardHeader base collision resolution: consumer p-5 sm:p-6 md:p-7 overrides base p-4 sm:p-6
  const mergedHeader = cn("p-4 sm:p-6", "p-5 sm:p-6 md:p-7 border-b border-slate-100");
  assert.ok(
    !mergedHeader.includes("p-4"),
    "Base p-4 must be overridden by consumer p-5"
  );
  assert.ok(
    mergedHeader.includes("p-5 sm:p-6 md:p-7"),
    "Consumer padding overrides must be preserved cleanly"
  );
});

// -------------------------------------------------------------
// SECTION 3: TypeScript Union Widening & Primitive Composition
// -------------------------------------------------------------

test("3.1 StatusBadge preserves literal union autocomplete with (string & {}) idiom", () => {
  assert.ok(
    statusBadgeCode.includes("(string & {})"),
    "StatusType union must use (string & {}) to prevent compiler widening to naked string"
  );
});

test("3.2 StatusBadge composes Badge primitive and reuses design system tokens", () => {
  assert.ok(
    statusBadgeCode.includes('import Badge') && statusBadgeCode.includes('from "./Badge"'),
    "StatusBadge must import and compose Badge component"
  );
  assert.ok(
    statusBadgeCode.includes("<Badge"),
    "StatusBadge must render <Badge /> primitive internally"
  );
  assert.ok(
    statusBadgeCode.includes("VARIANT_STYLES"),
    "StatusBadge must reuse shared VARIANT_STYLES from Badge.tsx"
  );
});

test("3.3 StatusBadge exports getStatusBadgeVariant and getStatusBadgeStyles for compatibility", () => {
  assert.ok(
    statusBadgeCode.includes("export function getStatusBadgeVariant("),
    "Must export getStatusBadgeVariant"
  );
  assert.ok(
    statusBadgeCode.includes("export function getStatusBadgeStyles("),
    "Must export backward-compatible getStatusBadgeStyles"
  );
});

// -------------------------------------------------------------
// SECTION 4: Repository Hygiene & Atomic Scope
// -------------------------------------------------------------

test("4.1 No duplicate refactoring_progress.md exists in repository root", () => {
  const rootProgress = path.join(projectRoot, "refactoring_progress.md");
  assert.strictEqual(
    fs.existsSync(rootProgress),
    false,
    "refactoring_progress.md must not exist in project root; canonical path is docs/refactoring_progress.md"
  );
});

// -------------------------------------------------------------
// SCORECARD
// -------------------------------------------------------------

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================\n");

if (passed !== total) {
  process.exit(1);
}
