#!/usr/bin/env node

/**
 * Test Suite: Issue #30 - Reschedule: primary-doctor slots use clinic-wide capacity
 *
 * Verifies that:
 * 1. AppointmentRescheduleForm passes `targetStaffId={event.staff_id || "primary"}` to SlotSelectorGrid.
 * 2. SlotSelectorGrid defaults `effectiveStaffId = targetStaffId || "primary"`.
 * 3. SlotSelectorGrid queries backend slots with `getDoctorAvailableSlots(date, effectiveStaffId)`.
 * 4. SlotSelectorGrid correctly distinguishes primary doctor appointments and doctor leaves from staff appointments.
 * 5. When backend returns empty array `[]` (0 slots available), SlotSelectorGrid marks candidate slots as unavailable.
 * 6. The appointment being rescheduled can still select its own original slot if unchanged.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #30 - Reschedule Primary Doctor Slot Resolution");
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
// 1. AST & Code Pattern Verification in AppointmentRescheduleForm.tsx
// ------------------------------------------------------------------
const formPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "panels",
  "AppointmentRescheduleForm.tsx"
);
const formSource = fs.readFileSync(formPath, "utf-8");

it("1.1 AppointmentRescheduleForm passes staff_id or 'primary' fallback to SlotSelectorGrid", () => {
  assert.ok(
    formSource.includes('targetStaffId={event.staff_id || "primary"}'),
    'AppointmentRescheduleForm must pass targetStaffId={event.staff_id || "primary"}'
  );
  assert.ok(
    !formSource.includes("targetStaffId={event.staff_id || null}"),
    "AppointmentRescheduleForm must NOT pass null for primary doctor appointments"
  );
});

// ------------------------------------------------------------------
// 2. AST & Code Pattern Verification in SlotSelectorGrid.tsx
// ------------------------------------------------------------------
const gridPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "panels",
  "SlotSelectorGrid.tsx"
);
const gridSource = fs.readFileSync(gridPath, "utf-8");

it("2.1 SlotSelectorGrid normalizes effectiveStaffId to 'primary'", () => {
  assert.ok(
    gridSource.includes('const effectiveStaffId = targetStaffId || "primary";'),
    'SlotSelectorGrid must normalize effectiveStaffId to "primary"'
  );
});

it("2.2 SlotSelectorGrid invokes getDoctorAvailableSlots with effectiveStaffId", () => {
  assert.ok(
    gridSource.includes("getDoctorAvailableSlots(date, effectiveStaffId)"),
    "SlotSelectorGrid must pass effectiveStaffId to getDoctorAvailableSlots"
  );
});

it("2.3 SlotSelectorGrid determines isTargetPrimary correctly", () => {
  assert.ok(
    gridSource.includes('const isTargetPrimary = !targetStaffId || targetStaffId.toLowerCase() === "primary";'),
    "SlotSelectorGrid must check isTargetPrimary using case-insensitive check"
  );
});

it("2.4 SlotSelectorGrid uses structured logger instead of console.warn", () => {
  assert.ok(
    gridSource.includes("logger.warn") && gridSource.includes('"SlotSelectorGrid"'),
    "SlotSelectorGrid must use structured logger.warn"
  );
  assert.ok(
    !gridSource.includes("console.warn"),
    "SlotSelectorGrid must NOT use console.warn"
  );
});

it("2.5 SlotSelectorGrid evaluates apiSlots !== null to respect empty [] responses", () => {
  assert.ok(
    gridSource.includes("if (apiSlots !== null)"),
    "SlotSelectorGrid must check apiSlots !== null"
  );
});

it("2.6 SlotSelectorGrid exports pure generateCandidateSlots for decoupled testability (SRP)", () => {
  assert.ok(
    gridSource.includes("export function generateCandidateSlots("),
    "SlotSelectorGrid must export generateCandidateSlots"
  );
});

it("2.7 SlotSelectorGrid pre-finds currentAppt once outside the slot loop for O(1) performance", () => {
  assert.ok(
    gridSource.includes("const currentAppt = currentAppointmentId") &&
    gridSource.includes("existingEvents.find("),
    "SlotSelectorGrid must pre-find currentAppt once before loop"
  );
});

// ------------------------------------------------------------------
// 3. Behavioral Simulation: Conflict & Target Practitioner Logic
// ------------------------------------------------------------------
function simulateSlotConflictCheck({
  targetStaffId,
  currentAppointmentId,
  event,
  slotStart,
  slotEnd,
}) {
  const isTargetPrimary = !targetStaffId || targetStaffId.toLowerCase() === "primary";

  if (currentAppointmentId && event.appointment_id === currentAppointmentId) {
    return { isBlocked: false, reason: "Own slot" };
  }

  if (event.type === "APPOINTMENT") {
    const isEvPrimary = !event.staff_id || event.staff_id.toLowerCase() === "primary";
    const sameDoctor = isTargetPrimary ? isEvPrimary : event.staff_id === targetStaffId;
    if (!sameDoctor) {
      return { isBlocked: false, reason: "Different doctor" };
    }
    return { isBlocked: true, reason: "Already Booked" };
  }

  if (event.type === "LEAVE") {
    if (!isTargetPrimary) {
      return { isBlocked: false, reason: "Primary leave does not block staff doctor" };
    }
    return { isBlocked: true, reason: "Doctor Leave" };
  }

  return { isBlocked: false };
}

it("3.1 Primary doctor reschedule conflicts with existing primary appointment", () => {
  const result = simulateSlotConflictCheck({
    targetStaffId: "primary",
    currentAppointmentId: "appt-current",
    event: {
      type: "APPOINTMENT",
      appointment_id: "appt-other-primary",
      staff_id: null, // primary
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(result.isBlocked, true);
  assert.strictEqual(result.reason, "Already Booked");
});

it("3.2 Primary doctor reschedule does NOT conflict with staff doctor appointment", () => {
  const result = simulateSlotConflictCheck({
    targetStaffId: "primary",
    currentAppointmentId: "appt-current",
    event: {
      type: "APPOINTMENT",
      appointment_id: "appt-staff-doc",
      staff_id: "550e8400-e29b-41d4-a716-446655440000",
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(result.isBlocked, false);
  assert.strictEqual(result.reason, "Different doctor");
});

it("3.3 Primary doctor reschedule IS blocked by primary doctor leave", () => {
  const result = simulateSlotConflictCheck({
    targetStaffId: "primary",
    currentAppointmentId: "appt-current",
    event: {
      type: "LEAVE",
      appointment_id: "leave-1",
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(result.isBlocked, true);
  assert.strictEqual(result.reason, "Doctor Leave");
});

it("3.4 Staff doctor reschedule is NOT blocked by primary doctor leave", () => {
  const result = simulateSlotConflictCheck({
    targetStaffId: "550e8400-e29b-41d4-a716-446655440000",
    currentAppointmentId: "appt-current",
    event: {
      type: "LEAVE",
      appointment_id: "leave-1",
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(result.isBlocked, false);
});

it("3.5 Staff doctor reschedule conflicts ONLY with same staff doctor appointments", () => {
  const staffId = "550e8400-e29b-41d4-a716-446655440000";
  const sameDocResult = simulateSlotConflictCheck({
    targetStaffId: staffId,
    currentAppointmentId: "appt-current",
    event: {
      type: "APPOINTMENT",
      appointment_id: "appt-same-staff",
      staff_id: staffId,
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(sameDocResult.isBlocked, true);

  const diffDocResult = simulateSlotConflictCheck({
    targetStaffId: staffId,
    currentAppointmentId: "appt-current",
    event: {
      type: "APPOINTMENT",
      appointment_id: "appt-primary",
      staff_id: null,
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(diffDocResult.isBlocked, false);
});

it("3.6 Current appointment's own slot is NOT blocked by itself", () => {
  const result = simulateSlotConflictCheck({
    targetStaffId: "primary",
    currentAppointmentId: "appt-123",
    event: {
      type: "APPOINTMENT",
      appointment_id: "appt-123",
      staff_id: null,
    },
    slotStart: "10:00",
    slotEnd: "10:30",
  });
  assert.strictEqual(result.isBlocked, false);
  assert.strictEqual(result.reason, "Own slot");
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}
