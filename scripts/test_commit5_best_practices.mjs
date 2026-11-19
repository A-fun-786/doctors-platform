import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 5 BEST PRACTICES FIXES");
console.log("============================================================");

const shellContent = fs.readFileSync(
  path.join(projectRoot, "components/dashboard/DashboardShell.tsx"),
  "utf-8"
);

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

// 1. Tailwind v3 Compatibility (No outline-hidden)
test("DashboardShell does NOT contain invalid outline-hidden (Tailwind v3 compatible)", () => {
  assert.ok(!shellContent.includes("outline-hidden"), "DashboardShell should not contain outline-hidden");
  assert.ok(shellContent.includes("focus-visible:outline-none"), "DashboardShell should use focus-visible:outline-none");
});

test("All interactive buttons in DashboardShell utilize focus-visible:outline-none", () => {
  const outlineMatches = shellContent.match(/focus-visible:outline-none/g);
  assert.ok(outlineMatches && outlineMatches.length >= 8, `Expected at least 8 focus-visible:outline-none instances, found ${outlineMatches ? outlineMatches.length : 0}`);
});

// 2. Accessibility (a11y) & WCAG Compliance
test("Active tab pulsing indicator dot includes aria-hidden='true'", () => {
  assert.ok(
    shellContent.includes('animate-pulse" aria-hidden="true"'),
    "Pulsing dot in active view header must have aria-hidden='true'"
  );
});

test("Decorative navigation icons include aria-hidden='true'", () => {
  assert.ok(
    shellContent.includes('className={`w-5 h-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true"'),
    "Mobile drawer nav icons must include aria-hidden='true'"
  );
  assert.ok(
    shellContent.includes('className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} aria-hidden="true"'),
    "Desktop sidebar nav icons must include aria-hidden='true'"
  );
  assert.ok(
    shellContent.includes('className={`w-5 h-5 transition-transform ${') && shellContent.includes('aria-hidden="true"'),
    "Mobile bottom nav icons must include aria-hidden='true'"
  );
});

test("Navigation buttons announce active page state via aria-current", () => {
  const ariaCurrentMatches = shellContent.match(/aria-current=\{isActive \? "page" : undefined\}/g);
  assert.ok(
    ariaCurrentMatches && ariaCurrentMatches.length >= 3,
    "Navigation buttons across drawer, sidebar, and bottom bar must include aria-current"
  );
});

test("Doctor name display is standardized to formattedDoctorName across views", () => {
  const normalized = shellContent.replace(/\r\n/g, "\n");
  assert.ok(
    normalized.includes("<p className=\"text-sm font-bold text-slate-900 truncate\">\n                  {formattedDoctorName}"),
    "Drawer doctor display name must use formattedDoctorName for consistency"
  );
  assert.ok(
    shellContent.includes("{formattedDoctorName}"),
    "DashboardShell must use formattedDoctorName"
  );
});

// 3. Desktop Header Simplification & Redundancy Elimination
test("Desktop tab header has no duplicate profile pill or logout button", () => {
  assert.ok(
    !shellContent.includes("Doctor Profile Pill"),
    "Desktop tab header should not contain duplicate profile pill"
  );
  // Verify top bar profile remains intact
  assert.ok(
    shellContent.includes("DESKTOP TOP BAR (>= md)") &&
    shellContent.includes("Profile Name, Icon & Logout at Top Right"),
    "Floating desktop top bar must maintain doctor profile and logout"
  );
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
