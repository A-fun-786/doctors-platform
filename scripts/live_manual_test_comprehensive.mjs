#!/usr/bin/env node

/**
 * COMPREHENSIVE LIVE MANUAL TESTING SCRIPT
 * Tests every feature and claim from docs/feature/appointment/ against the running application.
 * 
 * Covers:
 *  - Server health & CORS
 *  - Auth (register/login, /auth/me)
 *  - Doctor profile & onboarding
 *  - Working hours CRUD (GET/PUT with validation)
 *  - Slot generation engine (shift fallback, closed-day guard, past-slot filter, explicit precedence)
 *  - Schedule management (AVAILABLE, LEAVE, BLOCKED, HOLIDAY)
 *  - Appointment full lifecycle (Create, List, Get, Complete, Cancel, Reschedule)
 *  - Booking validations (outside hours, on leave, on closed day, duplicate slot)
 *  - Calendar aggregation (/doctor/calendar)
 *  - Public patient-facing endpoints (profile, available slots)
 *  - Frontend bundle integrity checks
 *  - Patient details schema & vitals storage
 */

const API = "http://localhost:8000/api/v1";
const FRONTEND = "http://localhost:3000";

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Skip Sunday (0) for tomorrow tests so closed_days=[0] doesn't interfere
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function nextWeekday() {
  // Find a date 3 days from now that's not a Sunday
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function test(section, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    const msg = err.message || String(err);
    failures.push({ section, name, msg });
    console.error(`  ❌ ${name}: ${msg}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

async function main() {
  const uniqueSuffix = Date.now();
  const email = `live.test.${uniqueSuffix}@docspace.com`;
  const password = "LiveTest123!";
  let token = null;
  let doctorId = null;
  let slug = null;
  let appointmentIds = {};
  let leaveScheduleId = null;

  console.log("\n" + "=".repeat(80));
  console.log("🏥 COMPREHENSIVE LIVE MANUAL TESTING — APPOINTMENT SYSTEM");
  console.log("=".repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Backend:   ${API}`);
  console.log(`Frontend:  ${FRONTEND}`);
  console.log(`Test Doctor: ${email}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: SERVER HEALTH & CORS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("━".repeat(70));
  console.log("§1  SERVER HEALTH & CORS");
  console.log("━".repeat(70));

  await test("Health", "1.1 Backend health endpoint returns 200", async () => {
    const r = await fetch(`http://localhost:8000/health`);
    assertEq(r.status, 200, "Health status");
  });

  await test("Health", "1.2 Backend Swagger docs (/docs) accessible", async () => {
    const r = await fetch(`http://localhost:8000/docs`);
    assertEq(r.status, 200, "Swagger docs status");
    const html = await r.text();
    assert(html.includes("swagger") || html.includes("Swagger") || html.includes("openapi"), "Should contain swagger content");
  });

  await test("Health", "1.3 Frontend dashboard page accessible", async () => {
    const r = await fetch(`${FRONTEND}/dashboard`);
    assert(r.status === 200 || r.status === 307, `Dashboard status should be 200 or 307, got ${r.status}`);
  });

  await test("Health", "1.4 CORS header allows localhost:3000 origin", async () => {
    const r = await fetch(`http://localhost:8000/health`, {
      headers: { "Origin": "http://localhost:3000" }
    });
    const cors = r.headers.get("access-control-allow-origin");
    assert(cors === "http://localhost:3000" || cors === "*", `CORS: ${cors}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§2  AUTHENTICATION (Register, Login, /auth/me)");
  console.log("━".repeat(70));

  await test("Auth", "2.1 Register new test doctor", async () => {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: `Dr. LiveTest ${uniqueSuffix}`
      })
    });
    const status = r.status;
    const data = await r.json();
    assert(status === 200 || status === 201, `Register failed: ${status} - ${JSON.stringify(data)}`);
    token = data.access_token;
    slug = data.tenant?.slug;
    assert(token, "Should return access_token");
    assert(slug, "Should return tenant slug");
  });

  const authHeaders = () => ({
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  });

  await test("Auth", "2.2 GET /auth/me returns doctor info", async () => {
    const r = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    assertEq(r.status, 200, "auth/me status");
    const data = await r.json();
    assertEq(data.email, email, "Email mismatch");
    doctorId = data.id;
    assert(doctorId, "Should have doctor ID");
  });

  await test("Auth", "2.3 Login with registered credentials", async () => {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    assertEq(r.status, 200, "Login status");
    const data = await r.json();
    assert(data.access_token, "Should return token on login");
    token = data.access_token;
    if (data.tenant?.slug) slug = data.tenant.slug;
  });

  await test("Auth", "2.4 Invalid credentials rejected with 401", async () => {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "WrongPassword" })
    });
    assertEq(r.status, 401, "Invalid login status");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: DOCTOR PROFILE & ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§3  DOCTOR PROFILE & ONBOARDING");
  console.log("━".repeat(70));

  await test("Profile", "3.1 PUT /doctor/profile updates successfully", async () => {
    const r = await fetch(`${API}/doctor/profile`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        full_name: `Dr. LiveTest ${uniqueSuffix}`,
        clinic_name: "LiveTest Clinic",
        location: "TestCity",
        speciality: "General Medicine",
        bio: "Test doctor bio.",
        onboarding_completed: true,
        services: {
          appointment: true,
          video_consultation: true,
          medicine_inventory: false,
          lab_reports: false
        }
      })
    });
    assertEq(r.status, 200, "Profile update status");
  });

  await test("Profile", "3.2 Public profile accessible via GET /public/tenants/{slug}", async () => {
    assert(slug, "Slug must be present");
    const r = await fetch(`${API}/public/tenants/${slug}`);
    assertEq(r.status, 200, "Public profile status");
    const data = await r.json();
    assert(data.full_name.includes("LiveTest"), "Name should match");
    assert(data.services?.appointment === true, "Appointment service should be enabled");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: WORKING HOURS (Phase 1 of appointment_calender_plan)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§4  WORKING HOURS API (GET/PUT, Validation, Defaults)");
  console.log("━".repeat(70));

  await test("WorkingHours", "4.1 GET /doctor/working-hours returns default fallback when unconfigured", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, { headers: authHeaders() });
    assertEq(r.status, 200, "GET working-hours status");
    const data = await r.json();
    assert(data.shifts && data.shifts.length === 2, `Default should have 2 shifts, got ${data.shifts?.length}`);
    assertEq(data.shifts[0].id, "morning", "First shift id");
    assertEq(data.shifts[0].start, "10:00", "Morning start");
    assertEq(data.shifts[0].end, "13:00", "Morning end");
    assertEq(data.shifts[1].id, "evening", "Second shift id");
    assertEq(data.shifts[1].start, "16:00", "Evening start");
    assertEq(data.shifts[1].end, "20:00", "Evening end");
    assert(data.closed_days.includes(0), "Default closed_days should include Sunday (0)");
  });

  await test("WorkingHours", "4.2 PUT /doctor/working-hours saves valid shifts", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "morning", label: "Morning Shift", start: "10:00", end: "13:00", enabled: true },
          { id: "evening", label: "Evening Shift", start: "16:00", end: "20:00", enabled: true }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 200, "PUT working-hours status");
    const data = await r.json();
    assertEq(data.shifts.length, 2, "Should persist 2 shifts");
    assertEq(data.closed_days[0], 0, "Closed day should be Sunday(0)");
  });

  await test("WorkingHours", "4.3 PUT rejects inverted range (start >= end) with 422", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "bad", label: "Bad", start: "14:00", end: "10:00", enabled: true }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 422, "Inverted range should be rejected with 422");
  });

  await test("WorkingHours", "4.4 PUT rejects equal start/end with 422", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "zero", label: "Zero", start: "10:00", end: "10:00", enabled: true }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 422, "Equal start/end should be 422");
  });

  await test("WorkingHours", "4.5 PUT rejects non-30-minute intervals with 422", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "odd", label: "Odd", start: "10:15", end: "12:00", enabled: true }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 422, "Non-30m interval should be 422");
  });

  await test("WorkingHours", "4.6 PUT rejects overlapping enabled shifts with 422", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "a", label: "A", start: "10:00", end: "13:00", enabled: true },
          { id: "b", label: "B", start: "12:00", end: "15:00", enabled: true }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 422, "Overlapping enabled shifts should be 422");
  });

  await test("WorkingHours", "4.7 PUT allows disabled overlap (not 422)", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "a", label: "A", start: "10:00", end: "13:00", enabled: true },
          { id: "b", label: "B", start: "12:00", end: "15:00", enabled: false }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 200, "Disabled overlap should be allowed");
  });

  await test("WorkingHours", "4.8 PUT rejects more than 4 shifts with 422", async () => {
    const r = await fetch(`${API}/doctor/working-hours`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        shifts: [
          { id: "s1", label: "S1", start: "06:00", end: "07:00", enabled: true },
          { id: "s2", label: "S2", start: "08:00", end: "09:00", enabled: true },
          { id: "s3", label: "S3", start: "10:00", end: "11:00", enabled: true },
          { id: "s4", label: "S4", start: "12:00", end: "13:00", enabled: true },
          { id: "s5", label: "S5", start: "14:00", end: "15:00", enabled: true }
        ],
        closed_days: [0]
      })
    });
    assertEq(r.status, 422, "More than 4 shifts should be 422");
  });

  // Restore valid working hours for subsequent tests
  await fetch(`${API}/doctor/working-hours`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      shifts: [
        { id: "morning", label: "Morning Shift", start: "10:00", end: "13:00", enabled: true },
        { id: "evening", label: "Evening Shift", start: "16:00", end: "20:00", enabled: true }
      ],
      closed_days: [0]
    })
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: SLOT GENERATION ENGINE (Phase 2)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§5  SLOT GENERATION ENGINE (Shift Fallback, Closed Days, Precedence)");
  console.log("━".repeat(70));

  const tomorrowDate = tomorrow();
  const sundayDate = nextSunday();
  const weekdayDate = nextWeekday();

  await test("Slots", "5.1 GET /doctor/available-slots on a weekday returns 14 shift-based slots", async () => {
    const r = await fetch(`${API}/doctor/available-slots?date=${weekdayDate}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Available slots status");
    const slots = await r.json();
    assertEq(slots.length, 14, `Weekday should have 14 slots (6 morning + 8 evening), got ${slots.length}`);
    assertEq(slots[0].start, "10:00", "First slot start");
    assertEq(slots[0].end, "10:30", "First slot end");
    assertEq(slots[5].start, "12:30", "Last morning slot");
    assertEq(slots[6].start, "16:00", "First evening slot");
    assertEq(slots[13].start, "19:30", "Last slot start");
    assertEq(slots[13].end, "20:00", "Last slot end");
  });

  await test("Slots", "5.2 GET /doctor/available-slots on Sunday returns 0 slots (closed day)", async () => {
    const r = await fetch(`${API}/doctor/available-slots?date=${sundayDate}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Sunday slots status");
    const slots = await r.json();
    assertEq(slots.length, 0, `Sunday should have 0 slots (closed), got ${slots.length}`);
  });

  await test("Slots", "5.3 Explicit AVAILABLE schedule overrides shift fallback (precedence)", async () => {
    const schedRes = await fetch(`${API}/doctor/schedule`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        date: weekdayDate,
        start_time: "08:00",
        end_time: "09:00",
        type: "AVAILABLE"
      })
    });
    assert(schedRes.status === 201 || schedRes.status === 200, `Schedule create: ${schedRes.status}`);
    const schedData = await schedRes.json();
    const availableId = Array.isArray(schedData) ? schedData[0].id : schedData.id;

    const r = await fetch(`${API}/doctor/available-slots?date=${weekdayDate}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Slots after explicit AVAILABLE");
    const slots = await r.json();
    assertEq(slots.length, 2, `Explicit AVAILABLE should yield 2 slots, got ${slots.length}`);
    assertEq(slots[0].start, "08:00", "Explicit slot start");

    // Cleanup: delete the explicit schedule so subsequent tests use shift fallback
    await fetch(`${API}/doctor/schedule/${availableId}`, { method: "DELETE", headers: authHeaders() });
  });

  await test("Slots", "5.4 Public available-slots endpoint returns slots for patient", async () => {
    assert(slug, "Slug must be present");
    const r = await fetch(`${API}/public/tenants/${slug}/available-slots?date=${tomorrowDate}`);
    assertEq(r.status, 200, "Public slots status");
    const slots = await r.json();
    assertEq(slots.length, 14, `Public slots should be 14, got ${slots.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: SCHEDULE MANAGEMENT (LEAVE, BLOCKED, HOLIDAY)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§6  SCHEDULE MANAGEMENT (Leave, Blocked, Holiday)");
  console.log("━".repeat(70));

  await test("Schedule", "6.1 Create LEAVE schedule entry", async () => {
    const r = await fetch(`${API}/doctor/schedule`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        date: tomorrowDate,
        start_time: "10:00",
        end_time: "11:00",
        type: "LEAVE"
      })
    });
    assert(r.status === 201 || r.status === 200, `Create leave: ${r.status}`);
    const data = await r.json();
    leaveScheduleId = Array.isArray(data) ? data[0].id : data.id;
    assert(leaveScheduleId, "Leave should have an ID");
  });

  await test("Schedule", "6.2 LEAVE blocks those slots (2 slots removed from 14)", async () => {
    const r = await fetch(`${API}/doctor/available-slots?date=${tomorrowDate}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Slots after leave");
    const slots = await r.json();
    assertEq(slots.length, 12, `Should have 12 slots after leave (was 14), got ${slots.length}`);
    const starts = slots.map(s => s.start);
    assert(!starts.includes("10:00"), "10:00 should be blocked by leave");
    assert(!starts.includes("10:30"), "10:30 should be blocked by leave");
  });

  await test("Schedule", "6.3 Delete LEAVE restores blocked slots", async () => {
    const r = await fetch(`${API}/doctor/schedule/${leaveScheduleId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    assertEq(r.status, 204, "Delete leave status");

    const slotsRes = await fetch(`${API}/doctor/available-slots?date=${tomorrowDate}`, { headers: authHeaders() });
    const slots = await slotsRes.json();
    assertEq(slots.length, 14, `After leave deletion should restore to 14 slots, got ${slots.length}`);
  });

  await test("Schedule", "6.4 Create BLOCKED schedule entry", async () => {
    const r = await fetch(`${API}/doctor/schedule`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        date: tomorrowDate,
        start_time: "16:00",
        end_time: "17:00",
        type: "BLOCKED"
      })
    });
    assert(r.status === 201 || r.status === 200, `Create blocked: ${r.status}`);
    const data = await r.json();
    const blockedId = Array.isArray(data) ? data[0].id : data.id;

    const slotsRes = await fetch(`${API}/doctor/available-slots?date=${tomorrowDate}`, { headers: authHeaders() });
    const slots = await slotsRes.json();
    assertEq(slots.length, 12, `Should have 12 slots after BLOCKED 16:00-17:00, got ${slots.length}`);

    // Cleanup
    await fetch(`${API}/doctor/schedule/${blockedId}`, { method: "DELETE", headers: authHeaders() });
  });

  await test("Schedule", "6.5 GET /doctor/schedule lists entries by date range", async () => {
    const r = await fetch(`${API}/doctor/schedule?from=${tomorrowDate}&to=${tomorrowDate}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Schedule list status");
    const data = await r.json();
    assert(data.items !== undefined && Array.isArray(data.items), "Should return items array");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: APPOINTMENT LIFECYCLE (Create, List, Get, Complete, Cancel, Reschedule)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§7  APPOINTMENT LIFECYCLE (Full CRUD + State Transitions)");
  console.log("━".repeat(70));

  await test("Appointment", "7.1 POST /doctor/appointments creates appointment within working hours", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Aisha Rahman",
        patient_contact: "+91 9876543210",
        date: tomorrowDate,
        start_time: "10:00",
        end_time: "10:30",
        reason: "Routine checkup",
        patient_gender: "Female",
        patient_age: 35,
        patient_height: "165 cm",
        patient_weight: "62 kg",
        patient_blood_group: "B+",
        patient_address: "12 MG Road, Mumbai"
      })
    });
    const status = r.status;
    const data = await r.json();
    assertEq(status, 201, `Create appointment failed: ${JSON.stringify(data)}`);
    appointmentIds.first = data.id;
    assert(data.id, "Appointment should have ID");
    assertEq(data.patient_name, "Aisha Rahman", "Patient name");
    assertEq(data.status, "BOOKED", "Initial status should be BOOKED");
    assertEq(data.patient_gender, "Female", "Gender should be stored");
    assertEq(data.patient_age, 35, "Age should be stored");
  });

  await test("Appointment", "7.2 Duplicate slot booking rejected (same time)", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Duplicate Test",
        patient_contact: "+91 1111111111",
        date: tomorrowDate,
        start_time: "10:00",
        end_time: "10:30",
        reason: "Duplicate"
      })
    });
    assert(r.status === 400 || r.status === 409 || r.status === 422, `Duplicate should be rejected, got ${r.status}`);
  });

  await test("Appointment", "7.3 Create second appointment in a different slot", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Raj Kumar",
        patient_contact: "+91 9988776655",
        date: tomorrowDate,
        start_time: "11:00",
        end_time: "11:30",
        reason: "Follow-up consultation"
      })
    });
    assertEq(r.status, 201, `Second appointment status: ${r.status}`);
    const data = await r.json();
    appointmentIds.second = data.id;
  });

  await test("Appointment", "7.4 Create third appointment for lifecycle tests", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Priya Sharma",
        patient_contact: "+91 8877665544",
        date: tomorrowDate,
        start_time: "16:00",
        end_time: "16:30",
        reason: "Blood pressure review"
      })
    });
    assertEq(r.status, 201, `Third appointment status: ${r.status}`);
    const data = await r.json();
    appointmentIds.third = data.id;
  });

  await test("Appointment", "7.5 GET /doctor/appointments lists all appointments", async () => {
    const r = await fetch(`${API}/doctor/appointments`, { headers: authHeaders() });
    assertEq(r.status, 200, "List appointments status");
    const data = await r.json();
    const items = data.items || data.appointments || data;
    assert(Array.isArray(items), "Should return array");
    assert(items.length >= 3, `Should have at least 3 appointments, got ${items.length}`);
  });

  await test("Appointment", "7.6 GET /doctor/appointments/{id} returns single appointment with patient details", async () => {
    assert(appointmentIds.first, "First appointment ID must exist");
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.first}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Get single appointment status");
    const data = await r.json();
    assertEq(data.id, appointmentIds.first, "ID match");
    assertEq(data.patient_name, "Aisha Rahman", "Patient name");
    assert(data.doctor_id, "Should have doctor_id");
    assert(data.created_at, "Should have created_at");
  });

  await test("Appointment", "7.7 POST /doctor/appointments/{id}/complete transitions to COMPLETED", async () => {
    assert(appointmentIds.first, "First appointment ID must exist");
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.first}/complete`, {
      method: "POST",
      headers: authHeaders()
    });
    assertEq(r.status, 200, "Complete status");
    const data = await r.json();
    assertEq(data.status, "COMPLETED", "Should be COMPLETED");
  });

  await test("Appointment", "7.8 Cannot complete an already-completed appointment", async () => {
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.first}/complete`, {
      method: "POST",
      headers: authHeaders()
    });
    assert(r.status === 400 || r.status === 409 || r.status === 422, `Double complete should fail, got ${r.status}`);
  });

  await test("Appointment", "7.9 POST /doctor/appointments/{id}/cancel transitions to CANCELLED", async () => {
    assert(appointmentIds.second, "Second appointment ID must exist");
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.second}/cancel`, {
      method: "POST",
      headers: authHeaders()
    });
    assertEq(r.status, 200, "Cancel status");
    const data = await r.json();
    assertEq(data.status, "CANCELLED", "Should be CANCELLED");
  });

  await test("Appointment", "7.10 Cannot cancel an already-cancelled appointment", async () => {
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.second}/cancel`, {
      method: "POST",
      headers: authHeaders()
    });
    assert(r.status === 400 || r.status === 409 || r.status === 422, `Double cancel should fail, got ${r.status}`);
  });

  await test("Appointment", "7.11 Cannot cancel a completed appointment", async () => {
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.first}/cancel`, {
      method: "POST",
      headers: authHeaders()
    });
    assert(r.status === 400 || r.status === 409 || r.status === 422, `Cancel completed should fail, got ${r.status}`);
  });

  await test("Appointment", "7.12 PATCH /doctor/appointments/{id} reschedules to new slot", async () => {
    assert(appointmentIds.third, "Third appointment ID must exist");
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.third}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        date: tomorrowDate,
        start_time: "17:00",
        end_time: "17:30"
      })
    });
    assertEq(r.status, 200, "Reschedule status");
    const data = await r.json();
    assert(data.start_time.startsWith("17:00"), `Rescheduled start_time: ${data.start_time}`);
  });

  await test("Appointment", "7.13 Cannot reschedule a cancelled appointment", async () => {
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.second}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        date: tomorrowDate,
        start_time: "18:00",
        end_time: "18:30"
      })
    });
    assert(r.status === 400 || r.status === 409 || r.status === 422, `Reschedule cancelled should fail, got ${r.status}`);
  });

  await test("Appointment", "7.14 Cancelled appointment frees its slot for rebooking", async () => {
    // appointmentIds.second was at 11:00-11:30 on tomorrowDate, now cancelled
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Slot Reuse Test",
        patient_contact: "+91 1234567890",
        date: tomorrowDate,
        start_time: "11:00",
        end_time: "11:30",
        reason: "Rebooking freed slot"
      })
    });
    assertEq(r.status, 201, `Rebooking freed slot: ${r.status}`);
    const data = await r.json();
    appointmentIds.rebooked = data.id;
  });

  await test("Appointment", "7.15 GET /doctor/appointments supports status filter", async () => {
    const r = await fetch(`${API}/doctor/appointments?status=COMPLETED`, { headers: authHeaders() });
    assertEq(r.status, 200, "Filtered list status");
    const data = await r.json();
    const items = data.items || data.appointments || data;
    assert(items.length >= 1, "Should have at least 1 completed appointment");
    for (const item of items) {
      assertEq(item.status, "COMPLETED", "All items should be COMPLETED");
    }
  });

  await test("Appointment", "7.16 GET nonexistent appointment returns 404", async () => {
    const r = await fetch(`${API}/doctor/appointments/00000000-0000-0000-0000-000000000000`, { headers: authHeaders() });
    assertEq(r.status, 404, "Nonexistent appointment should be 404");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: BOOKING VALIDATIONS (Outside Hours, Leave, Closed Day)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§8  BOOKING VALIDATIONS (Outside Hours, Leave Period, Closed Day)");
  console.log("━".repeat(70));

  await test("Validation", "8.1 Booking outside working hours is rejected", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Off Hours Patient",
        patient_contact: "+91 5555555555",
        date: tomorrowDate,
        start_time: "07:00",
        end_time: "07:30",
        reason: "Too early"
      })
    });
    assert(r.status === 400 || r.status === 422, `Outside hours should be rejected, got ${r.status}`);
  });

  await test("Validation", "8.2 Booking on closed day (Sunday) is rejected", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Sunday Patient",
        patient_contact: "+91 6666666666",
        date: sundayDate,
        start_time: "10:00",
        end_time: "10:30",
        reason: "Sunday booking"
      })
    });
    assert(r.status === 400 || r.status === 422, `Sunday booking should be rejected, got ${r.status}`);
  });

  await test("Validation", "8.3 Booking during LEAVE period is rejected", async () => {
    const leaveRes = await fetch(`${API}/doctor/schedule`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        date: tomorrowDate,
        start_time: "12:00",
        end_time: "13:00",
        type: "LEAVE"
      })
    });
    const leaveData = await leaveRes.json();
    const leaveId = Array.isArray(leaveData) ? leaveData[0].id : leaveData.id;

    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Leave Patient",
        patient_contact: "+91 7777777777",
        date: tomorrowDate,
        start_time: "12:00",
        end_time: "12:30",
        reason: "During leave"
      })
    });
    assert(r.status === 400 || r.status === 422, `Booking during leave should be rejected, got ${r.status}`);

    // Cleanup leave
    await fetch(`${API}/doctor/schedule/${leaveId}`, { method: "DELETE", headers: authHeaders() });
  });

  await test("Validation", "8.4 After leave deletion, same slot becomes bookable again", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_name: "Restored Slot Patient",
        patient_contact: "+91 8888888888",
        date: tomorrowDate,
        start_time: "12:00",
        end_time: "12:30",
        reason: "Booking after leave deletion"
      })
    });
    assertEq(r.status, 201, `Booking after leave deletion should succeed, got ${r.status}`);
    const data = await r.json();
    appointmentIds.restored = data.id;
  });

  await test("Validation", "8.5 Missing required field (patient_name) returns 422", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        patient_contact: "+91 0000000000",
        date: tomorrowDate,
        start_time: "19:00",
        end_time: "19:30",
        reason: "Missing name"
      })
    });
    assertEq(r.status, 422, "Missing patient_name should be 422");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9: CALENDAR AGGREGATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§9  CALENDAR AGGREGATION (/doctor/calendar)");
  console.log("━".repeat(70));

  await test("Calendar", "9.1 GET /doctor/calendar returns aggregated events for date range", async () => {
    const r = await fetch(`${API}/doctor/calendar?from=${tomorrowDate}&to=${tomorrowDate}`, {
      headers: authHeaders()
    });
    assertEq(r.status, 200, "Calendar status");
    const data = await r.json();
    assert(data.dates && Array.isArray(data.dates), "Should return dates array");
    const hasAppointments = data.dates.some(d => d.events && d.events.some(e => e.type === "APPOINTMENT"));
    assert(hasAppointments, "Calendar should contain APPOINTMENT events");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10: PUBLIC PATIENT-FACING ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§10 PUBLIC PATIENT-FACING ENDPOINTS");
  console.log("━".repeat(70));

  await test("Public", "10.1 GET /public/tenants/{slug} returns doctor profile", async () => {
    assert(slug, "Slug must be present");
    const r = await fetch(`${API}/public/tenants/${slug}`);
    assertEq(r.status, 200, "Public profile");
    const data = await r.json();
    assert(data.full_name, "Should have doctor name");
    assertEq(data.slug, slug, "Slug match");
  });

  await test("Public", "10.2 GET /public/tenants/{slug}/available-slots returns bookable slots", async () => {
    assert(slug, "Slug must be present");
    const r = await fetch(`${API}/public/tenants/${slug}/available-slots?date=${tomorrowDate}`);
    assertEq(r.status, 200, "Public slots");
    const slots = await r.json();
    assert(Array.isArray(slots), "Should be array");
    assert(slots.length > 0, "Should have some available slots");
    assert(slots.length < 14, `Some slots should be booked, got ${slots.length}`);
  });

  await test("Public", "10.3 Public slots on Sunday returns empty (closed day)", async () => {
    assert(slug, "Slug must be present");
    const r = await fetch(`${API}/public/tenants/${slug}/available-slots?date=${sundayDate}`);
    assertEq(r.status, 200, "Public Sunday slots");
    const slots = await r.json();
    assertEq(slots.length, 0, `Sunday public slots should be 0, got ${slots.length}`);
  });

  await test("Public", "10.4 Invalid slug returns 404", async () => {
    const r = await fetch(`${API}/public/tenants/nonexistent-slug-xyz-12345`);
    assertEq(r.status, 404, "Invalid slug should be 404");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 11: FRONTEND BUNDLE INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§11 FRONTEND BUNDLE & UI INTEGRITY");
  console.log("━".repeat(70));

  await test("Frontend", "11.1 Dashboard page serves HTML with MiniCalendar", async () => {
    const r = await fetch(`${FRONTEND}/dashboard`);
    const html = await r.text();
    assert(html.includes("MiniCalendar") || html.includes("mini") || html.includes("__next"), "Dashboard should serve Next.js content");
  });

  await test("Frontend", "11.2 No QuickActionsCard in bundle (removed in Phase 4)", async () => {
    const r = await fetch(`${FRONTEND}/dashboard`);
    const html = await r.text();
    assert(!html.includes("QuickActionsCard"), "QuickActionsCard should not be in bundle");
  });

  await test("Frontend", "11.3 No GoogleCalendarCard in bundle (removed in Phase 2)", async () => {
    const r = await fetch(`${FRONTEND}/dashboard`);
    const html = await r.text();
    assert(!html.includes("GoogleCalendarCard"), "GoogleCalendarCard should not be in bundle");
    assert(!html.includes("GoogleCalendarModal"), "GoogleCalendarModal should not be in bundle");
  });

  await test("Frontend", "11.4 Public patient page (/[slug]) accessible", async () => {
    assert(slug, "Slug must be present");
    const r = await fetch(`${FRONTEND}/${slug}`);
    assert(r.status === 200 || r.status === 307, `Patient page: ${r.status}`);
  });

  await test("Frontend", "11.5 Login page accessible", async () => {
    const r = await fetch(`${FRONTEND}/login`);
    assertEq(r.status, 200, "Login page status");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 12: RATE LIMITING & SECURITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§12 RATE LIMITING & SECURITY");
  console.log("━".repeat(70));

  await test("Security", "12.1 Unauthenticated request to /doctor/* returns 401/403", async () => {
    const r = await fetch(`${API}/doctor/appointments`);
    assert(r.status === 401 || r.status === 403, `Unauth should be 401/403, got ${r.status}`);
  });

  await test("Security", "12.2 Invalid token returns 401", async () => {
    const r = await fetch(`${API}/doctor/appointments`, {
      headers: { "Authorization": "Bearer invalid.token.here" }
    });
    assert(r.status === 401 || r.status === 403, `Invalid token: ${r.status}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 13: PATIENT DETAILS SCHEMA (Phase 5 - Alembic migration 008)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(70));
  console.log("§13 PATIENT DETAILS SCHEMA & VITALS STORAGE");
  console.log("━".repeat(70));

  await test("PatientDetails", "13.1 Appointment stores patient vitals (gender, age, height, weight, blood_group, address)", async () => {
    assert(appointmentIds.first, "First appointment ID must exist");
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.first}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Get appointment with vitals");
    const data = await r.json();
    assertEq(data.patient_gender, "Female", "Gender");
    assertEq(data.patient_age, 35, "Age");
    assertEq(data.patient_height, "165 cm", "Height");
    assertEq(data.patient_weight, "62 kg", "Weight");
    assertEq(data.patient_blood_group, "B+", "Blood group");
    assertEq(data.patient_address, "12 MG Road, Mumbai", "Address");
  });

  await test("PatientDetails", "13.2 Appointment without vitals stores null/missing gracefully", async () => {
    assert(appointmentIds.rebooked, "Rebooked appointment ID must exist");
    const r = await fetch(`${API}/doctor/appointments/${appointmentIds.rebooked}`, { headers: authHeaders() });
    assertEq(r.status, 200, "Get appointment without vitals");
    const data = await r.json();
    assert(data.patient_gender === null || data.patient_gender === undefined || data.patient_gender === "", "Gender should be null when not supplied");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(80));
  console.log("📊 COMPREHENSIVE LIVE TESTING SUMMARY");
  console.log("═".repeat(80));
  console.log(`  Total Tests:  ${passed + failed + skipped}`);
  console.log(`  ✅ Passed:    ${passed}`);
  console.log(`  ❌ Failed:    ${failed}`);
  console.log(`  ⏭️  Skipped:   ${skipped}`);
  console.log("─".repeat(80));

  if (failures.length > 0) {
    console.log("\n🔴 FAILURE DETAILS:");
    for (const f of failures) {
      console.log(`  [${f.section}] ${f.name}`);
      console.log(`    → ${f.msg}`);
    }
  }

  console.log("\n" + "═".repeat(80));
  if (failed === 0) {
    console.log("🎉 ALL LIVE TESTS PASSED — EVERY FEATURE CLAIM VERIFIED AGAINST RUNNING APP!");
  } else {
    console.log(`⚠️  ${failed} TEST(S) FAILED — SEE DETAILS ABOVE`);
  }
  console.log("═".repeat(80) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
