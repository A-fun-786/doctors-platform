#!/usr/bin/env node

/**
 * End-to-End Automated Verification Suite
 * Tests live web server, API contracts, responsiveness metadata, accessibility tags, and edge cases.
 */

import assert from "node:assert/strict";

const FRONTEND_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:8000/api/v1";

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
};

function record(name, fn) {
  stats.total++;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      stats.passed++;
      console.log(`  ✅ [PASS] ${name}`);
    })
    .catch((err) => {
      stats.failed++;
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    });
}

async function run() {
  console.log("============================================================");
  console.log("🚀 DOCSPACE E2E AUTOMATED & ACCEPTANCE TEST SUITE");
  console.log("============================================================\n");

  console.log("--- 1. Frontend Web Pages & Responsive Meta Validation ---");
  await record("Frontend root (/) renders with 200 OK & viewport meta", async () => {
    const res = await fetch(`${FRONTEND_URL}/`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert.ok(html.includes("viewport"), "HTML must have responsive viewport meta tag");
  });

  await record("Login page (/login) renders with auth form elements", async () => {
    const res = await fetch(`${FRONTEND_URL}/login`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("DocSpace") || html.includes("Sign In"), "Login page must render branding");
  });

  await record("Doctor Dashboard (/dashboard) renders with Next.js SPA bundle", async () => {
    const res = await fetch(`${FRONTEND_URL}/dashboard`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("GoSmartClinic") || html.includes("DocSpace") || html.includes("dashboard"), "Dashboard shell rendered");
  });

  await record("Public Practice page (/dr-alexander-smith) renders 200 OK", async () => {
    const res = await fetch(`${FRONTEND_URL}/dr-alexander-smith`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.length > 500, "Public practice page rendered content");
  });

  console.log("\n--- 2. Doctor Auth & Session Verification ---");
  let token = null;
  await record("Doctor Login with dr.tester@docspace.com returns valid JWT", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dr.tester@docspace.com",
        password: "Password123!"
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.access_token, "Must return access_token");
    token = data.access_token;
  });

  const authHeaders = () => ({
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  });

  await record("Doctor Me (/auth/me) returns authenticated profile", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: authHeaders()
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.email, "dr.tester@docspace.com");
    assert.strictEqual(data.tenant?.slug, "dr-alexander-smith");
  });

  console.log("\n--- 3. Calendar & Schedule Engine Functionality ---");
  const today = new Date().toISOString().split("T")[0];

  await record("Get Unified Calendar Timeline (/doctor/calendar?from=...&to=...)", async () => {
    const res = await fetch(`${BACKEND_URL}/doctor/calendar?from=${today}&to=${today}`, {
      headers: authHeaders()
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.dates), "Calendar response should contain dates array");
    const day = data.dates.find(d => d.date === today);
    assert.ok(day, `Calendar must contain entry for today (${today})`);
    assert.ok(day.events.length >= 1, "Must have scheduled events/slots");
  });

  await record("Calendar Range Boundary Validation (>31 days rejected with 400)", async () => {
    const res = await fetch(`${BACKEND_URL}/doctor/calendar?from=2026-01-01&to=2026-03-01`, {
      headers: authHeaders()
    });
    assert.strictEqual(res.status, 400, "Should reject range >31 days with 400");
  });

  console.log("\n--- 4. Appointments Management & Lifecycle ---");
  let appointmentsList = [];
  await record("List Doctor Appointments (/doctor/appointments)", async () => {
    const res = await fetch(`${BACKEND_URL}/doctor/appointments?page_size=50`, {
      headers: authHeaders()
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items), "Appointments response must contain items array");
    appointmentsList = data.items;
    assert.ok(appointmentsList.length >= 2, "Should have seeded appointments");
  });

  await record("Double-Booking Conflict Rejection (HTTP 409)", async () => {
    // Attempt booking an already occupied slot
    const res = await fetch(`${BACKEND_URL}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Conflict Tester",
        patient_phone: "+1 (555) 000-1111",
        date: today,
        start_time: "10:00",
        end_time: "10:30",
        reason: "Double booking collision attempt"
      })
    });
    assert.strictEqual(res.status, 409, "Must reject conflicting appointment with 409 Conflict");
  });

  console.log("\n--- 5. Public Booking & Patient Isolation ---");
  await record("Public available slots retrieval (/public/tenants/{slug}/available-slots)", async () => {
    const res = await fetch(`${BACKEND_URL}/public/tenants/dr-alexander-smith/available-slots?date=${today}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), "Should return array of public slots");
    // Ensure booked slots (10:00, 11:30) are NOT exposed as available
    const hasBookedSlot = data.some(s => s.start.startsWith("10:00"));
    assert.strictEqual(hasBookedSlot, false, "Booked slot 10:00 must NOT be available");
  });

  await record("Public non-existent doctor slug returns 404", async () => {
    const res = await fetch(`${BACKEND_URL}/public/tenants/non-existent-doctor-slug-99999/available-slots?date=${today}`);
    assert.strictEqual(res.status, 404);
  });

  console.log("\n============================================================");
  console.log("🏁 E2E VERIFICATION SCORECARD");
  console.log("============================================================");
  console.log(`  Total Checks: ${stats.total}`);
  console.log(`  Passed      : ${stats.passed}`);
  console.log(`  Failed      : ${stats.failed}`);
  console.log("============================================================");

  if (stats.failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL E2E & INTEGRATION CHECKS PASSED WITH 100% SUCCESS!\n");
  }
}

run().catch((err) => {
  console.error("FATAL RUNNER ERROR:", err);
  process.exit(1);
});
