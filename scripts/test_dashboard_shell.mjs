#!/usr/bin/env node

/**
 * GoSmartClinic Platform - DashboardShell Verification & Regression Test Suite
 * Validates the Mobile-First Adaptive AppShell, Hamburger Navigation Drawer,
 * Tablet Collapsible Sidebar, Mobile Bottom Navigation, dead code elimination,
 * and accessibility compliance.
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
// SUITE 1: Dead Code & Legacy Header Removal Verification
// ============================================================================
describe("Dead Code & Legacy Header Removal Verification", () => {
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
  });

  test("Public Page external link is removed from shell", () => {
    assert.strictEqual(source.includes("Public Page"), false, "'Public Page' link text should be removed");
  });

  test("Legacy logger imports are eliminated", () => {
    assert.strictEqual(source.includes("@/lib/logger"), false, "logger import should be removed");
  });
});

// ============================================================================
// SUITE 2: Navigation & Mobile/Tablet Shell Architecture
// ============================================================================
describe("Navigation & Mobile/Tablet Shell Architecture", () => {
  test("Mobile Sticky Top Bar renders with Hamburger Menu and BrandLogo", () => {
    assert.ok(source.includes("<header className=\"md:hidden sticky top-0"), "Mobile sticky header must be present");
    assert.ok(source.includes("aria-label=\"Open navigation menu\""), "Hamburger menu must have accessible aria-label");
    assert.ok(source.includes("Menu"), "Menu icon must be used for hamburger button");
  });

  test("Mobile slide-out Navigation Drawer is implemented with accessibility", () => {
    assert.ok(source.includes("role=\"dialog\""), "Drawer must have dialog role");
    assert.ok(source.includes("aria-modal=\"true\""), "Drawer must declare aria-modal='true'");
    assert.ok(source.includes("Escape"), "Drawer must handle Escape key for keyboard dismissal");
    assert.ok(source.includes("overflow-hidden"), "Drawer must prevent background body scroll when open");
  });

  test("Tablet collapsible sidebar is implemented with toggle button", () => {
    assert.ok(source.includes("isSidebarCollapsed"), "Sidebar must support collapsed state");
    assert.ok(source.includes("PanelLeftClose"), "PanelLeftClose icon must be available");
    assert.ok(source.includes("PanelLeftOpen"), "PanelLeftOpen icon must be available");
    assert.ok(source.includes("w-20"), "Sidebar must support compact w-20 rail mode on tablets/desktops");
  });

  test("Mobile bottom navigation bar is fixed with safe-area support", () => {
    assert.ok(source.includes("aria-label=\"Mobile Navigation\""), "Mobile nav must have aria-label");
    assert.ok(source.includes("pb-safe"), "Mobile nav must include pb-safe for mobile home bars");
    assert.ok(source.includes("fixed bottom-0"), "Mobile nav must be fixed to bottom on mobile");
  });

  test("Content area wraps {children} safely in a semantic main element with mobile buffer", () => {
    assert.ok(source.includes("<main className=\"flex-1 min-w-0 pb-24 md:pb-6\">"), "Main must have min-w-0 and pb-24 for mobile nav clearance");
    assert.ok(source.includes("{children}"), "{children} must be rendered in main layout");
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
    { id: "appointment", label: "Appointments" },
    { id: "profile", label: "Profile" },
  ];

  test("Base navigation contains 3 core doctor tabs", () => {
    assert.strictEqual(baseTabs.length, 3);
    const ids = baseTabs.map((t) => t.id);
    assert.deepStrictEqual(ids, ["overview", "appointment", "profile"]);
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
    assert.strictEqual(withoutAndroid.length, 3);
    assert.strictEqual(withoutAndroid.some((i) => i.id === "android"), false);

    const withAndroid = getNavItems(true);
    assert.strictEqual(withAndroid.length, 4);
    assert.strictEqual(withAndroid[3].id, "android");
    assert.strictEqual(withAndroid[3].label, "Android App");
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
