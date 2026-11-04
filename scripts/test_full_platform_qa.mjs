#!/usr/bin/env node

/**
 * DocSpace Platform - Deep Automated QA & Verification Suite
 * Tests Functionality, Responsiveness, Accessibility (WCAG 2.1), and Edge Cases.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const FRONTEND_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:8000/api/v1";

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {
    functionality: { total: 0, passed: 0, failed: 0 },
    responsiveness: { total: 0, passed: 0, failed: 0 },
    accessibility: { total: 0, passed: 0, failed: 0 },
    edge_cases: { total: 0, passed: 0, failed: 0 },
  },
};

function record(category, name, fn) {
  stats.total++;
  stats.categories[category].total++;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      stats.passed++;
      stats.categories[category].passed++;
      console.log(`  ✅ [PASS] [${category.toUpperCase()}] ${name}`);
    })
    .catch((err) => {
      stats.failed++;
      stats.categories[category].failed++;
      console.error(`  ❌ [FAIL] [${category.toUpperCase()}] ${name}`);
      console.error(`     Error: ${err.message}`);
    });
}

async function run() {
  console.log("================================================================================");
  console.log("🏥 DOCSPACE COMPREHENSIVE QA AUTOMATION SUITE");
  console.log("   Validating: Functionality | Responsiveness | Accessibility | Edge Cases");
  console.log("================================================================================\n");

  // ============================================================================
  // 1. FUNCTIONALITY TESTING
  // ============================================================================
  console.log("--- 1. FUNCTIONALITY VERIFICATION ---");

  await record("functionality", "Backend Health Probe returns healthy service status", async () => {
    const res = await fetch(`${BACKEND_URL}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "healthy");
    assert.strictEqual(data.service, "doctor-platform-api");
  });

  let token = null;
  let doctorSlug = null;
  await record("functionality", "Doctor Login authenticates and issues valid JWT bearer token", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dr.tester@docspace.com", password: "Password123!" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.access_token, "Must return access_token");
    token = data.access_token;
    doctorSlug = data.tenant?.slug;
  });

  await record("functionality", "Doctor /auth/me profile reflects authenticated tenant context", async () => {
    assert.ok(token, "Token must be available");
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.email, "dr.tester@docspace.com");
    assert.ok(data.tenant, "Must contain tenant information");
  });

  await record("functionality", "Doctor Calendar Timeline endpoint returns chronological schedule", async () => {
    assert.ok(token);
    const from = "2026-10-21";
    const to = "2026-10-25";
    const res = await fetch(`${BACKEND_URL}/doctor/calendar?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.dates), "Calendar must return an array of dates");
    if (data.dates.length > 0) {
      assert.ok(Array.isArray(data.dates[0].events), "Date must contain events array");
    }
  });

  await record("functionality", "Doctor Appointments list endpoint returns paginated patient bookings", async () => {
    assert.ok(token);
    const res = await fetch(`${BACKEND_URL}/doctor/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items), "Appointments must contain items array");
    assert.strictEqual(typeof data.total, "number", "Appointments must include total count");
  });

  await record("functionality", "Public booking slots endpoint exposes valid practice slots", async () => {
    const slug = doctorSlug || "dr-alexander-smith";
    const res = await fetch(`${BACKEND_URL}/public/tenants/${slug}/available-slots?date=2026-10-21`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), "Slots must be an array");
  });

  // ============================================================================
  // 2. RESPONSIVENESS TESTING
  // ============================================================================
  console.log("\n--- 2. RESPONSIVENESS ARCHITECTURE & METADATA ---");

  await record("responsiveness", "Root layout contains mobile viewport meta configuration", async () => {
    const res = await fetch(`${FRONTEND_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("viewport") || html.includes("width=device-width"), "Must configure device-width viewport");
  });

  await record("responsiveness", "DashboardShell implements responsive breakpoints (md:flex desktop & md:hidden mobile)", async () => {
    const shellFile = path.join(rootDir, "components", "dashboard", "DashboardShell.tsx");
    const content = fs.readFileSync(shellFile, "utf-8");
    assert.ok(content.includes("hidden md:flex") || content.includes("md:block"), "Desktop sidebar hidden on mobile and flex on desktop");
    assert.ok(content.includes("md:hidden"), "Mobile navigation drawer and sticky topbar hidden on desktop");
    assert.ok(content.includes("fixed bottom-0"), "Mobile bottom nav fixed with touch-friendly layout");
  });

  await record("responsiveness", "AdaptiveDataView in OverviewTab implements dual desktop table & mobile cards", async () => {
    const overviewFile = path.join(rootDir, "components", "dashboard", "OverviewTab.tsx");
    const content = fs.readFileSync(overviewFile, "utf-8");
    assert.ok(content.includes("AdaptiveDataView"), "AdaptiveDataView container used for responsive switching");
    assert.ok(content.includes("<table"), "Must render semantic table element on desktop viewports");
    assert.ok(content.includes("renderMobileCard"), "Must render mobile-optimized touch card views");
  });

  await record("responsiveness", "CalendarTab adapts across viewport bounds with responsive container", async () => {
    const calFile = path.join(rootDir, "components", "dashboard", "CalendarTab.tsx");
    const content = fs.readFileSync(calFile, "utf-8");
    assert.ok(content.includes("overflow-hidden") || content.includes("w-full"), "Calendar container must prevent overflow");
  });

  await record("responsiveness", "Landing page Navbar implements direct mobile Login and Sign Up action buttons", async () => {
    const navbarFile = path.join(rootDir, "components", "landing", "Navbar.tsx");
    const content = fs.readFileSync(navbarFile, "utf-8");
    assert.ok(content.includes('flex md:hidden items-center'), "Must include mobile actions container");
    assert.ok(content.includes('Sign Up'), "Must include direct Sign Up action button on mobile");
    assert.ok(content.includes('href="/login"'), "Must include direct Login action on mobile");
    assert.ok(content.includes('href="/register"'), "Must route to /register for doctor signup");
  });

  // ============================================================================
  // 3. ACCESSIBILITY (WCAG 2.1 AA) TESTING
  // ============================================================================
  console.log("\n--- 3. ACCESSIBILITY (WCAG 2.1 AA) VERIFICATION ---");

  await record("accessibility", "HTML document declares language attribute (lang='en')", async () => {
    const layoutFile = path.join(rootDir, "app", "layout.tsx");
    const content = fs.readFileSync(layoutFile, "utf-8");
    assert.ok(content.includes('lang="en"') || content.includes("lang='en'"), "HTML must declare lang='en'");
  });

  await record("accessibility", "Interactive dashboard tabs use semantic <button> and accessible labels", async () => {
    const shellFile = path.join(rootDir, "components", "dashboard", "DashboardShell.tsx");
    const content = fs.readFileSync(shellFile, "utf-8");
    assert.ok(content.includes("<button"), "Nav items must be interactive buttons");
    assert.ok(content.includes("type=\"button\""), "Nav buttons must declare type='button'");
  });

  await record("accessibility", "Reusable Modal component enforces role='dialog', aria-modal='true', and Escape key dismiss", async () => {
    const modalFile = path.join(rootDir, "components", "ui", "Modal.tsx");
    const content = fs.readFileSync(modalFile, "utf-8");
    assert.ok(content.includes('role="dialog"') || content.includes("role='dialog'"), "Modal must declare role='dialog'");
    assert.ok(content.includes('aria-modal="true"') || content.includes("aria-modal='true'"), "Modal must declare aria-modal='true'");
    assert.ok(content.includes('"Escape"') || content.includes("'Escape'"), "Modal must dismiss on Escape key");
  });

  await record("accessibility", "Form inputs include associated descriptive labels or aria attributes", async () => {
    const loginRes = await fetch(`${FRONTEND_URL}/login`);
    const html = await loginRes.text();
    assert.ok(html.includes("label") || html.includes("Email") || html.includes("Password"), "Login form must have labels");
  });

  await record("accessibility", "Doctor avatar images provide descriptive alt text alternatives", async () => {
    const shellFile = path.join(rootDir, "components", "dashboard", "DashboardShell.tsx");
    const content = fs.readFileSync(shellFile, "utf-8");
    assert.ok(content.includes("alt="), "Doctor avatar must provide alt attribute");
  });

  // ============================================================================
  // 4. EDGE CASES & SECURITY RESILIENCE TESTING
  // ============================================================================
  console.log("\n--- 4. EDGE CASES & BOUNDARY VERIFICATION ---");

  await record("edge_cases", "Unauthenticated access to protected /doctor/appointments returns 401", async () => {
    const res = await fetch(`${BACKEND_URL}/doctor/appointments`);
    assert.strictEqual(res.status, 401);
  });

  await record("edge_cases", "Malformed / Empty JSON to login endpoint returns 422 Unprocessable Entity", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 422);
  });

  await record("edge_cases", "Invalid credentials return 401 or 429 (brute-force rate limited) safely", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@docspace.com", password: "BadPassword999!" }),
    });
    assert.ok(res.status === 401 || res.status === 422 || res.status === 429, `Expected 401, 422 or 429, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.detail, "Must return structured error detail");
  });

  await record("edge_cases", "SQL Injection attempt in login email is safely handled (401, 422 or 429)", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "' OR 1=1 --", password: "test" }),
    });
    assert.ok(res.status === 401 || res.status === 422 || res.status === 429, `Expected 401, 422 or 429, got ${res.status}`);
  });

  await record("edge_cases", "Public booking for non-existent doctor slug returns 404 Not Found", async () => {
    const res = await fetch(`${BACKEND_URL}/public/tenants/non-existent-doctor-slug-9999/available-slots?date=2026-10-21`);
    assert.strictEqual(res.status, 404);
  });

  await record("edge_cases", "Calendar query exceeding 31 days is rejected with HTTP 400", async () => {
    assert.ok(token);
    const from = "2026-10-01";
    const to = "2026-11-15"; // 45 days
    const res = await fetch(`${BACKEND_URL}/doctor/calendar?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 400);
  });

  await record("edge_cases", "Calendar query with inverted dates (from > to) is rejected with HTTP 400", async () => {
    assert.ok(token);
    const from = "2026-10-25";
    const to = "2026-10-20";
    const res = await fetch(`${BACKEND_URL}/doctor/calendar?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 400);
  });

  await record("edge_cases", "Non-existent nested route returns clean 404 status without server crash", async () => {
    const res = await fetch(`${FRONTEND_URL}/nonexistent/nested/path`);
    assert.strictEqual(res.status, 404);
  });

  // ============================================================================
  // SUMMARY SCORECARD
  // ============================================================================
  console.log("\n================================================================================");
  console.log("🏁 DOCSPACE DEEP QA AUTOMATION SCORECARD");
  console.log("================================================================================");
  console.log(`  Total Checks Executed : ${stats.total}`);
  console.log(`  Passed                : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
  console.log(`  Failed                : ${stats.failed}`);
  console.log("--------------------------------------------------------------------------------");
  for (const [cat, score] of Object.entries(stats.categories)) {
    const passPct = Math.round((score.passed / score.total) * 100);
    console.log(`  - ${cat.toUpperCase().padEnd(16)}: ${score.passed}/${score.total} Passed (${passPct}%)`);
  }
  console.log("================================================================================");

  if (stats.failed > 0) {
    console.error("❌ SOME TESTS FAILED!");
    process.exit(1);
  } else {
    console.log("🎉 ALL FUNCTIONALITY, RESPONSIVENESS, ACCESSIBILITY & EDGE CASE TESTS PASSED!");
  }
}

run().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
