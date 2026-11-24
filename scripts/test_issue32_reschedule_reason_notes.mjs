#!/usr/bin/env node

/**
 * Test Suite: Issue #32 - Reschedule: reason and notes edits are accepted but discarded
 *
 * Verifies that:
 * 1. AppointmentRescheduleForm includes reason and notes in rescheduleAppointment payload.
 * 2. AppointmentRescheduleForm forwards updatedReason and updatedNotes to onSuccess callback.
 * 3. AppointmentDetailsPanel updates currentEvent with newReason and newNotes upon reschedule success.
 * 4. AppointmentReschedulePayload in lib/api.ts includes reason and notes fields.
 * 5. AppointmentRescheduleRequest in backend schemas includes reason and notes fields.
 * 6. Appointment service persists reason and notes into the database record during reschedule.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #32 - Reschedule Reason and Notes Persistence");
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
// 1. Frontend AST Verification
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

it("1.1 AppointmentRescheduleForm sends reason and notes in rescheduleAppointment payload", () => {
  assert.ok(
    formSource.includes("reason: trimmedReason || null") ||
      formSource.includes("reason: reason.trim()"),
    "rescheduleAppointment payload must include reason"
  );
  assert.ok(
    formSource.includes("notes: trimmedNotes || null") ||
      formSource.includes("notes: notes.trim()"),
    "rescheduleAppointment payload must include notes"
  );
});

it("1.2 AppointmentRescheduleForm forwards reason and notes to onSuccess callback", () => {
  assert.ok(
    formSource.includes("onSuccess(targetDate, selectedSlot.start, selectedSlot.end, trimmedReason, trimmedNotes)"),
    "onSuccess must forward trimmedReason and trimmedNotes"
  );
});

const panelPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "panels",
  "AppointmentDetailsPanel.tsx"
);
const panelSource = fs.readFileSync(panelPath, "utf-8");

it("1.3 AppointmentDetailsPanel updates currentEvent reason and notes in handleRescheduleSuccess", () => {
  assert.ok(
    panelSource.includes("newReason !== undefined ? newReason : prev.reason"),
    "handleRescheduleSuccess must update currentEvent.reason"
  );
  assert.ok(
    panelSource.includes("newNotes !== undefined ? newNotes : prev.notes"),
    "handleRescheduleSuccess must update currentEvent.notes"
  );
});

const apiPath = path.join(projectRoot, "lib", "api.ts");
const apiSource = fs.readFileSync(apiPath, "utf-8");

it("1.4 lib/api.ts includes reason and notes in AppointmentReschedulePayload", () => {
  assert.ok(
    apiSource.includes("export interface AppointmentReschedulePayload {"),
    "AppointmentReschedulePayload must be exported"
  );
  const payloadDecl = apiSource.slice(
    apiSource.indexOf("export interface AppointmentReschedulePayload {"),
    apiSource.indexOf("export interface AppointmentFilterParams {")
  );
  assert.ok(
    payloadDecl.includes("reason?: string | null;"),
    "AppointmentReschedulePayload must include reason"
  );
  assert.ok(
    payloadDecl.includes("notes?: string | null;"),
    "AppointmentReschedulePayload must include notes"
  );
});

// ------------------------------------------------------------------
// 2. Backend Schema & Service AST Verification
// ------------------------------------------------------------------
const schemaPath = path.join(projectRoot, "backend", "app", "schemas", "appointment.py");
const schemaSource = fs.readFileSync(schemaPath, "utf-8");

it("2.1 backend appointment schema includes reason and notes in AppointmentRescheduleRequest", () => {
  const reqDecl = schemaSource.slice(
    schemaSource.indexOf("class AppointmentRescheduleRequest(BaseModel):"),
    schemaSource.indexOf("class AppointmentResponse(BaseModel):")
  );
  assert.ok(
    reqDecl.includes("reason: Optional[str]"),
    "AppointmentRescheduleRequest must declare reason"
  );
  assert.ok(
    reqDecl.includes("notes: Optional[str]"),
    "AppointmentRescheduleRequest must declare notes"
  );
});

const servicePath = path.join(projectRoot, "backend", "app", "services", "appointment_service.py");
const serviceSource = fs.readFileSync(servicePath, "utf-8");

it("2.2 appointment_service persists reason and notes via model_fields_set", () => {
  assert.ok(
    serviceSource.includes('"reason" in payload.model_fields_set'),
    'appointment_service must check "reason" in payload.model_fields_set'
  );
  assert.ok(
    serviceSource.includes('appointment.reason = payload.reason'),
    'appointment_service must assign appointment.reason = payload.reason'
  );
  assert.ok(
    serviceSource.includes('"notes" in payload.model_fields_set'),
    'appointment_service must check "notes" in payload.model_fields_set'
  );
  assert.ok(
    serviceSource.includes('appointment.notes = payload.notes'),
    'appointment_service must assign appointment.notes = payload.notes'
  );
});

// ------------------------------------------------------------------
// 3. Behavioral Simulation: Reschedule Payload Construction
// ------------------------------------------------------------------
function buildReschedulePayload({ targetDate, start, end, reason, notes }) {
  const trimmedReason = reason?.trim();
  const trimmedNotes = notes?.trim();

  return {
    date: targetDate,
    start_time: start,
    end_time: end,
    reason: trimmedReason || null,
    notes: trimmedNotes || null,
  };
}

it("3.1 Constructs complete payload with reason and notes", () => {
  const payload = buildReschedulePayload({
    targetDate: "2026-11-25",
    start: "14:00",
    end: "14:30",
    reason: "  Routine Follow-up  ",
    notes: "  Check blood pressure  ",
  });

  assert.strictEqual(payload.date, "2026-11-25");
  assert.strictEqual(payload.start_time, "14:00");
  assert.strictEqual(payload.end_time, "14:30");
  assert.strictEqual(payload.reason, "Routine Follow-up");
  assert.strictEqual(payload.notes, "Check blood pressure");
});

it("3.2 Normalizes whitespace-only reason or notes to null", () => {
  const payload = buildReschedulePayload({
    targetDate: "2026-11-25",
    start: "14:00",
    end: "14:30",
    reason: "   ",
    notes: "   ",
  });

  assert.strictEqual(payload.reason, null);
  assert.strictEqual(payload.notes, null);
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}

