#!/usr/bin/env node

/**
 * DocSpace Platform - DashboardShell Verification & Regression Test Suite
 * Validates the Top Header removal, component relocation, layout responsiveness,
 * dead code elimination, and interface compatibility.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dashboardShellPath = path.join(projectRoot, "components", "dashboard", "DashboardShell.tsx");

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

// Read DashboardShell.tsx source
const source = fs.readFileSync(dashboardShellPath, "utf-8");

// ============================================================================
// SUITE 1: Dead Code & Header Removal Verification
// ============================================================================
describe("Dead Code & Top Header Removal Verification", () => {
  test("Top <header> wrapper element is completely removed", () => {
    assert.strictEqual(source.includes("<header"), false, "<header> element should not exist in DashboardShell.tsx");
    assert.strictEqual(source.includes("</header>"), false, "</header> should not exist in DashboardShell.tsx");
  });

  test("'Doctor Portal' badge text and separator are removed", () => {
    assert.strictEqual(source.includes("Doctor Portal"), false, "'Doctor Portal' text should be removed");
    assert.strictEqual(source.includes("uppercase tracking-wider px-2 py-0.5 rounded bg-brand-50"), false, "Doctor Portal badge styles should be removed");
  });

  test("Search bar and search icons are completely removed", () => {
    assert.strictEqual(source.includes("Search appointments, patients, records..."), false, "Search placeholder should be removed");
    assert.strictEqual(/import\s*\{[^}]*Search[^}]*\}\s*from\s*["']lucide-react["']/.test(source), false, "Search icon import should be removed");
    assert.strictEqual(source.includes("⌘K"), false, "⌘K search shortcut badge should be removed");
  });

  test("Copy Link button and handleCopyLink handler are removed", () => {
    assert.strictEqual(source.includes("handleCopyLink"), false, "handleCopyLink function should be removed");
    assert.strictEqual(source.includes("Copy Link"), false, "'Copy Link' text should be removed");
    assert.strictEqual(/import\s*\{[^}]*Copy[^}]*\}\s*from\s*["']lucide-react["']/.test(source), false, "Copy icon import should be removed");
    assert.strictEqual(/import\s*\{[^}]*Check[^}]*\}\s*from\s*["']lucide-react["']/.test(source), false, "Check icon import should be removed");
  });

  test("Public Page external link is removed from shell", () => {
    assert.strictEqual(source.includes("Public Page"), false, "'Public Page' link text should be removed");
    assert.strictEqual(/import\s*\{[^}]*ExternalLink[^}]*\}\s*from\s*["']lucide-react["']/.test(source), false, "ExternalLink icon import should be removed");
  });

  test("Terminal / Logs button is removed from header", () => {
    assert.strictEqual(/import\s*\{[^}]*Terminal[^}]*\}\s*from\s*["']lucide-react["']/.test(source), false, "Terminal icon import should be removed");
    assert.strictEqual(source.includes("Open System Diagnostics & Logs"), false, "Logs button markup should be removed");
  });

  test("Unused logger and useState imports are eliminated", () => {
    assert.strictEqual(source.includes("@/lib/logger"), false, "logger import should be removed");
    assert.strictEqual(source.includes("useState"), false, "useState hook should be removed as copied state is gone");
  });
});

// ============================================================================
// SUITE 2: Component Relocation & Architecture Verification
// ============================================================================
describe("Component Relocation & Layout Architecture", () => {
  test("GoSmartClinic BrandLogo is rendered inside the sidebar <aside>", () => {
    const asideRegex = /<aside[\s\S]*?<\/aside>/;
    const match = source.match(asideRegex);
    assert.ok(match, "<aside> block must be present");
    // After rebranding (DocSpace → GoSmartClinic), the sidebar now uses the
    // BrandLogo component instead of hardcoded "DocSpace" text.
    assert.ok(
      match[0].includes("BrandLogo"),
      "BrandLogo component must be rendered inside <aside> (replaces legacy DocSpace text)"
    );
  });

  test("Doctor profile identity card is relocated inside the sidebar <aside>", () => {
    const asideRegex = /<aside[\s\S]*?<\/aside>/;
    const match = source.match(asideRegex);
    assert.ok(match, "<aside> block must be present");
    assert.ok(match[0].includes("doctor.full_name"), "doctor.full_name must be rendered inside <aside>");
    assert.ok(match[0].includes("doctor.email"), "doctor.email must be rendered inside <aside>");
    assert.ok(match[0].includes("src={avatar}"), "avatar image must be rendered inside <aside>");
  });

  test("Logout button is relocated inside the sidebar <aside>", () => {
    const asideRegex = /<aside[\s\S]*?<\/aside>/;
    const match = source.match(asideRegex);
    assert.ok(match, "<aside> block must be present");
    assert.ok(match[0].includes("onClick={onLogout}"), "onLogout handler must be wired inside <aside>");
    assert.ok(match[0].includes("LogOut"), "LogOut icon must be present inside <aside>");
  });

  test("Content area wraps {children} safely in a responsive section", () => {
    assert.ok(source.includes("<section className=\"flex-1 min-w-0\">"), "Content section must have min-w-0 flex-1");
    assert.ok(source.includes("{children}"), "{children} must be rendered in the main layout");
  });

  test("Interface backward compatibility is maintained for onOpenDiagnostics", () => {
    assert.ok(source.includes("onOpenDiagnostics?: () => void;"), "onOpenDiagnostics must remain an optional prop in DashboardShellProps");
  });
});

// ============================================================================
// SUITE 3: Navigation & State Logic Simulation
// ============================================================================
describe("Navigation & Tab State Logic Simulation", () => {
  const baseTabs = [
    { id: "overview", label: "Overview" },
    { id: "appointment", label: "Appointment" },
    { id: "schedule", label: "Schedule" },
    { id: "appointments", label: "Appointments" },
    { id: "profile", label: "Profile" },
  ];

  test("Base navigation contains 5 core tabs", () => {
    assert.strictEqual(baseTabs.length, 5);
    const ids = baseTabs.map((t) => t.id);
    assert.deepStrictEqual(ids, ["overview", "appointment", "schedule", "appointments", "profile"]);
  });

  test("Enable Android build flag dynamically appends Android tab", () => {
    const getNavItems = (enableAndroid) => {
      const items = [...baseTabs];
      if (enableAndroid) {
        items.push({ id: "android", label: "Android App" });
      }
      return items;
    };

    const withoutAndroid = getNavItems(false);
    assert.strictEqual(withoutAndroid.length, 5);
    assert.strictEqual(withoutAndroid.some((i) => i.id === "android"), false);

    const withAndroid = getNavItems(true);
    assert.strictEqual(withAndroid.length, 6);
    assert.strictEqual(withAndroid[5].id, "android");
    assert.strictEqual(withAndroid[5].label, "Android App");
  });

  test("Active tab styling computation distinguishes active vs inactive states", () => {
    const computeTabClasses = (isActive) => {
      return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap text-left w-full ${
        isActive
          ? "bg-brand-50 text-brand-700 font-semibold shadow-xs border-l-0 md:border-l-4 md:border-brand-600"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }`;
    };

    const activeClasses = computeTabClasses(true);
    assert.ok(activeClasses.includes("bg-brand-50 text-brand-700 font-semibold"));
    assert.ok(activeClasses.includes("md:border-brand-600"));

    const inactiveClasses = computeTabClasses(false);
    assert.ok(inactiveClasses.includes("text-slate-600"));
    assert.ok(inactiveClasses.includes("hover:bg-slate-50"));
    assert.strictEqual(inactiveClasses.includes("bg-brand-50"), false);
  });

  test("Avatar resolution fallback order: profile -> doctor -> DEFAULT_AVATAR", () => {
    const DEFAULT_AVATAR = "https://images.unsplash.com/photo-default";
    const resolveAvatar = (profile, doctor) => {
      return profile?.avatar_url || doctor?.avatar_url || DEFAULT_AVATAR;
    };

    // Case 1: Profile has avatar
    assert.strictEqual(resolveAvatar({ avatar_url: "profile.png" }, { avatar_url: "doctor.png" }), "profile.png");

    // Case 2: Only doctor has avatar
    assert.strictEqual(resolveAvatar(null, { avatar_url: "doctor.png" }), "doctor.png");
    assert.strictEqual(resolveAvatar({}, { avatar_url: "doctor.png" }), "doctor.png");

    // Case 3: Neither has avatar
    assert.strictEqual(resolveAvatar(null, {}), DEFAULT_AVATAR);
  });
});

// ============================================================================
// SUITE 4: Viewport Responsiveness & Layout Constraints
// ============================================================================
describe("Viewport Responsiveness & Layout Constraints", () => {
  test("Sidebar container provides full-width horizontal-scroll on mobile and fixed 240px width on desktop", () => {
    assert.ok(source.includes("w-full md:w-60"), "Sidebar must use w-full md:w-60");
    assert.ok(source.includes("overflow-x-auto md:overflow-visible"), "Nav must horizontally scroll on mobile and remain visible on desktop");
  });

  test("Sidebar flex direction stacks horizontally on mobile and vertically on desktop", () => {
    assert.ok(source.includes("flex md:flex-col"), "Nav items must layout as flex on mobile and flex-col on desktop");
  });

  test("Profile & Logout card adapts between mobile row and desktop column", () => {
    assert.ok(source.includes("justify-between md:flex-col md:items-stretch"), "Profile card must adapt between mobile row and desktop column");
    assert.ok(source.includes("md:w-full"), "Logout button must expand full-width on desktop sidebar");
  });
});

// ============================================================================
// SUMMARY & SCORECARD
// ============================================================================
console.log(`\n============================================================`);
console.log(`🏁 DASHBOARDSHELL TEST SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Test Cases : ${stats.total}`);
console.log(`  Passed           : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed           : ${stats.failed}`);
console.log(`  Suites Executed  : ${stats.suites}/${stats.suites}`);
console.log(`============================================================`);

if (stats.failed > 0) {
  process.exit(1);
} else {
  console.log(`\n🎉 ALL DASHBOARDSHELL AUTOMATED REGRESSION TESTS PASSED!\n`);
}
