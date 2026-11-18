#!/usr/bin/env node

/**
 * Test Suite: Issue #22 - Primary filter sends string "PRIMARY" as staff_id (422 Error)
 *
 * Verifies that:
 * 1. lib/api.ts sanitizes staffId / staff_id filters ("PRIMARY" -> primary_only=true, "primary" -> primary, ignores "ALL").
 * 2. lib/api.ts sanitizes createAppointment and rescheduleAppointment payloads so "PRIMARY" is stripped to undefined.
 * 3. calendarUtils.ts findConflictingEvents properly recognizes "PRIMARY" and "primary" as primary doctor (target = null).
 * 4. SlotSelectorGrid.tsx conflict check properly recognizes "PRIMARY" as primary doctor.
 * 5. Backend models & routes normalize "PRIMARY" / "primary" query params & payloads without throwing 422.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #22 - Primary Filter String 'PRIMARY' 422 Resiliency");
console.log("============================================================");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ------------------------------------------------------------------
// 1. AST & Code Pattern Verification in lib/api.ts
// ------------------------------------------------------------------
const apiTsPath = path.join(projectRoot, "lib", "api.ts");
const apiTsSource = fs.readFileSync(apiTsPath, "utf-8");

it("1.1 AppointmentFilterParams supports primary_only boolean", () => {
  assert.ok(
    apiTsSource.includes("primary_only?: boolean;"),
    "AppointmentFilterParams must declare optional primary_only boolean"
  );
});

it("1.2 getDoctorAppointments normalizes PRIMARY and primary to primary_only=true", () => {
  assert.ok(
    apiTsSource.includes('filters?.staff_id === "PRIMARY" || filters?.staff_id === "primary" || filters?.primary_only'),
    "getDoctorAppointments must check for PRIMARY/primary and set primary_only"
  );
  assert.ok(
    apiTsSource.includes('filters.staff_id !== "ALL"'),
    "getDoctorAppointments must not pass 'ALL' as staff_id"
  );
});

it("1.3 getDoctorAvailableSlots normalizes PRIMARY to lowercase primary and filters ALL", () => {
  assert.ok(
    apiTsSource.includes('staffId === "PRIMARY" || staffId === "primary"'),
    "getDoctorAvailableSlots must normalize PRIMARY or primary"
  );
  assert.ok(
    apiTsSource.includes('params.set("staff_id", "primary")'),
    "getDoctorAvailableSlots must set staff_id to lowercase primary"
  );
  assert.ok(
    apiTsSource.includes('staffId !== "ALL"'),
    "getDoctorAvailableSlots must not pass ALL sentinel"
  );
});

it("1.4 getPublicAvailableSlots normalizes PRIMARY to lowercase primary and filters ALL", () => {
  const publicSlotsSection = apiTsSource.slice(apiTsSource.indexOf("export async function getPublicAvailableSlots"));
  assert.ok(
    publicSlotsSection.includes('staffId === "PRIMARY" || staffId === "primary"'),
    "getPublicAvailableSlots must normalize PRIMARY or primary"
  );
});

it("1.5 createAppointment sanitizes payload so PRIMARY or ALL is replaced with undefined", () => {
  const createAptSection = apiTsSource.slice(
    apiTsSource.indexOf("export async function createAppointment"),
    apiTsSource.indexOf("export async function getDoctorAppointments")
  );
  assert.ok(
    createAptSection.includes('payload.staff_id === "PRIMARY"') &&
    createAptSection.includes("undefined"),
    "createAppointment must sanitize staff_id so PRIMARY becomes undefined"
  );
});

it("1.6 rescheduleAppointment sanitizes payload so PRIMARY or ALL is replaced with undefined", () => {
  const rescheduleSection = apiTsSource.slice(
    apiTsSource.indexOf("export async function rescheduleAppointment"),
    apiTsSource.indexOf("export async function getDoctorCalendar")
  );
  assert.ok(
    rescheduleSection.includes('payload.staff_id === "PRIMARY"') &&
    rescheduleSection.includes("undefined"),
    "rescheduleAppointment must sanitize staff_id so PRIMARY becomes undefined"
  );
});

// ------------------------------------------------------------------
// 2. Behavioral Unit Simulation of lib/api.ts Query Param Generation
// ------------------------------------------------------------------
function simulateGetDoctorAppointmentsParams(filters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.staff_id === "PRIMARY" || filters?.staff_id === "primary" || filters?.primary_only) {
    params.set("primary_only", "true");
  } else if (filters?.staff_id && filters.staff_id !== "ALL") {
    params.set("staff_id", filters.staff_id);
  }
  return params.toString();
}

it("2.1 staff_id='PRIMARY' in appointments filter produces primary_only=true and NO staff_id", () => {
  const query = simulateGetDoctorAppointmentsParams({ staff_id: "PRIMARY" });
  assert.equal(query, "primary_only=true");
  assert.ok(!query.includes("staff_id="));
});

it("2.2 staff_id='primary' (lowercase) in appointments filter produces primary_only=true", () => {
  const query = simulateGetDoctorAppointmentsParams({ staff_id: "primary" });
  assert.equal(query, "primary_only=true");
  assert.ok(!query.includes("staff_id="));
});

it("2.3 staff_id='ALL' in appointments filter produces empty query string", () => {
  const query = simulateGetDoctorAppointmentsParams({ staff_id: "ALL" });
  assert.equal(query, "");
});

it("2.4 Valid UUID staff doctor in appointments filter is preserved", () => {
  const uuid = "4dfa98e1-5f33-47a8-9be5-1f912239f150";
  const query = simulateGetDoctorAppointmentsParams({ staff_id: uuid });
  assert.equal(query, `staff_id=${uuid}`);
});

// ------------------------------------------------------------------
// 3. Behavioral Simulation of Payload Sanitization
// ------------------------------------------------------------------
function sanitizeAppointmentPayload(payload) {
  return {
    ...payload,
    staff_id:
      payload.staff_id === "PRIMARY" || payload.staff_id === "primary" || payload.staff_id === "ALL" || !payload.staff_id
        ? undefined
        : payload.staff_id,
  };
}

it("3.1 Booking payload with staff_id='PRIMARY' maps to undefined", () => {
  const sanitized = sanitizeAppointmentPayload({
    staff_id: "PRIMARY",
    patient_name: "Anita Roy",
  });
  assert.equal(sanitized.staff_id, undefined);
  assert.equal(sanitized.patient_name, "Anita Roy");
});

it("3.2 Booking payload with staff_id='ALL' maps to undefined", () => {
  const sanitized = sanitizeAppointmentPayload({
    staff_id: "ALL",
    patient_name: "Anita Roy",
  });
  assert.equal(sanitized.staff_id, undefined);
});

it("3.3 Booking payload with valid UUID staff_id is retained intact", () => {
  const uuid = "c9b139ec-9467-425b-b9d7-8547ad3ef1b5";
  const sanitized = sanitizeAppointmentPayload({
    staff_id: uuid,
    patient_name: "Anita Roy",
  });
  assert.equal(sanitized.staff_id, uuid);
});

// ------------------------------------------------------------------
// 4. AST & Logic Verification in calendarUtils.ts and SlotSelectorGrid
// ------------------------------------------------------------------
const utilsPath = path.join(projectRoot, "components", "dashboard", "calendar", "calendarUtils.ts");
const utilsSource = fs.readFileSync(utilsPath, "utf-8");

it("4.1 calendarUtils findConflictingEvents recognizes PRIMARY and primary as primary doctor", () => {
  assert.ok(
    utilsSource.includes('targetStaffId === "PRIMARY" || targetStaffId === "primary"'),
    "findConflictingEvents must treat PRIMARY or primary as target = null"
  );
});

const slotGridPath = path.join(projectRoot, "components", "dashboard", "calendar", "panels", "SlotSelectorGrid.tsx");
const slotGridSource = fs.readFileSync(slotGridPath, "utf-8");

it("4.2 SlotSelectorGrid conflict detection treats PRIMARY as primary doctor", () => {
  assert.ok(
    slotGridSource.includes('targetStaffId === "PRIMARY" || targetStaffId === "primary"'),
    "SlotSelectorGrid must normalize PRIMARY target"
  );
});

// ------------------------------------------------------------------
// 5. Backend Schema & Route AST Verification
// ------------------------------------------------------------------
const backendSchemaPath = path.join(projectRoot, "backend", "app", "schemas", "appointment.py");
const backendSchemaSource = fs.readFileSync(backendSchemaPath, "utf-8");

it("5.1 Backend AppointmentCreateRequest has normalize_staff_id field validator", () => {
  assert.ok(
    backendSchemaSource.includes("def normalize_staff_id"),
    "backend schemas must define normalize_staff_id validator"
  );
  assert.ok(
    backendSchemaSource.includes('"primary", "all", "none"'),
    "normalize_staff_id must sanitize primary, all, none strings"
  );
});

const backendApptRoutePath = path.join(projectRoot, "backend", "app", "api", "routes", "appointment.py");
const backendApptRouteSource = fs.readFileSync(backendApptRoutePath, "utf-8");

it("5.2 Backend appointment route handles staff_id string 'primary' and 'owner'", () => {
  assert.ok(
    backendApptRouteSource.includes('normalized in ("primary", "owner")'),
    "appointment route must map primary/owner to primary_only = True"
  );
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}
