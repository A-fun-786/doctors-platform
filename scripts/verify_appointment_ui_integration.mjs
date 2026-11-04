#!/usr/bin/env node

/**
 * Phase 5 Focused Verification Script: Appointment UI Integration & Working Hours Parity
 * 
 * Validates requirements from docs/feature/appointment/appointment_calender_plan.md (Phase 5):
 * - V1: AppointmentDetailsPanel exposes Complete and Cancel buttons calling completeAppointment / cancelAppointment.
 * - V2: AppointmentDetailsPanel hides Edit button when status === "COMPLETED" or "CANCELLED".
 * - V3: app/[slug]/page.tsx calls getPublicAvailableSlots dynamically and handles loading/empty states.
 * - V4: EditWorkingHoursModal dispatches updateDoctorWorkingHours to backend API with loading state.
 * - V5: CalendarTab.tsx fetches getDoctorWorkingHours on mount to eliminate split-brain drift.
 * - V6: lib/api.ts exports getDoctorWorkingHours and updateDoctorWorkingHours API clients.
 * - V7: calendarUtils.ts WorkingHoursConfig supports closed_days and breakTime with default Sunday closure.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("\n============================================================");
console.log("🧪 PHASE 5: APPOINTMENT UI & WORKING HOURS INTEGRATION SUITE");
console.log("============================================================\n");

let passed = 0;
let total = 0;

function runCheck(id, title, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] ${id}: ${title}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${id}: ${title}`);
    console.error(`     Error: ${err.message}`);
  }
}

// V1: AppointmentDetailsPanel exposes Complete and Cancel buttons calling completeAppointment / cancelAppointment
runCheck("V1", "AppointmentDetailsPanel Complete & Cancel actions", () => {
  const panelPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "AppointmentDetailsPanel.tsx"
  );
  assert.ok(fs.existsSync(panelPath), "AppointmentDetailsPanel.tsx must exist");
  const code = fs.readFileSync(panelPath, "utf-8");

  assert.ok(code.includes("completeAppointment"), "Must import or invoke completeAppointment");
  assert.ok(code.includes("cancelAppointment"), "Must import or invoke cancelAppointment");
  assert.ok(code.includes("Mark Completed"), "Must render 'Mark Completed' button");
  assert.ok(code.includes("Cancel Appointment"), "Must render 'Cancel Appointment' button");
  assert.ok(code.includes("Cancelling this appointment will release this 30-minute slot for other patients."), "Must display slot release warning in cancellation dialog");
});

// V2: AppointmentDetailsPanel hides Edit button when status === "COMPLETED" or "CANCELLED"
runCheck("V2", "AppointmentDetailsPanel status guard disables edit/reschedule for completed & cancelled consultations", () => {
  const panelPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "AppointmentDetailsPanel.tsx"
  );
  const code = fs.readFileSync(panelPath, "utf-8");

  // Check for status guard
  const hasStatusGuard = code.includes('currentEvent.status !== "CANCELLED" && currentEvent.status !== "COMPLETED"') ||
    (code.includes('currentEvent.status !== "CANCELLED"') && code.includes('currentEvent.status !== "COMPLETED"'));
  assert.ok(hasStatusGuard, "Must guard Edit button against both CANCELLED and COMPLETED statuses");
  assert.ok(code.includes("Edit / Reschedule"), "Must render Edit / Reschedule label");
});

// V3: app/[slug]/page.tsx calls getPublicAvailableSlots dynamically and removes static slots
runCheck("V3", "Public booking page (app/[slug]/page.tsx) dynamic slot generation", () => {
  const publicPagePath = path.join(projectRoot, "app", "[slug]", "page.tsx");
  assert.ok(fs.existsSync(publicPagePath), "app/[slug]/page.tsx must exist");
  const code = fs.readFileSync(publicPagePath, "utf-8");

  assert.ok(!code.includes("const TIME_SLOTS ="), "Must NOT define static TIME_SLOTS array");
  assert.ok(code.includes("getPublicAvailableSlots"), "Must invoke getPublicAvailableSlots");
  assert.ok(code.includes("Loader2"), "Must render Loader2 spinner during slot fetching");
  assert.ok(code.includes("No available slots on this date"), "Must provide courteous empty slot message");
});

// V4: EditWorkingHoursModal dispatches backend API call (updateDoctorWorkingHours)
runCheck("V4", "EditWorkingHoursModal backend persistence & loading state", () => {
  const modalPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "modals",
    "EditWorkingHoursModal.tsx"
  );
  assert.ok(fs.existsSync(modalPath), "EditWorkingHoursModal.tsx must exist");
  const code = fs.readFileSync(modalPath, "utf-8");

  assert.ok(code.includes("updateDoctorWorkingHours"), "Must import and call updateDoctorWorkingHours");
  assert.ok(code.includes("saveDoctorWorkingHours"), "Must synchronize localStorage cache with updated config");
  assert.ok(code.includes("isSaving"), "Must manage isSaving state");
  assert.ok(code.includes("Loader2"), "Must render Loader2 spinner during save");
});

// V5: CalendarTab.tsx fetches getDoctorWorkingHours on mount to eliminate split-brain drift
runCheck("V5", "CalendarTab.tsx mount synchronization with authoritative backend working hours", () => {
  const tabPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "CalendarTab.tsx"
  );
  assert.ok(fs.existsSync(tabPath), "CalendarTab.tsx must exist");
  const code = fs.readFileSync(tabPath, "utf-8");

  assert.ok(code.includes("getDoctorWorkingHours"), "Must import and call getDoctorWorkingHours");
  assert.ok(code.includes("setWorkingHoursConfig"), "Must update local state via setWorkingHoursConfig");
  assert.ok(code.includes("saveDoctorWorkingHours"), "Must update localStorage offline cache");
});

// V6: lib/api.ts exports getDoctorWorkingHours and updateDoctorWorkingHours API clients
runCheck("V6", "lib/api.ts working hours API functions & types", () => {
  const apiPath = path.join(projectRoot, "lib", "api.ts");
  assert.ok(fs.existsSync(apiPath), "lib/api.ts must exist");
  const code = fs.readFileSync(apiPath, "utf-8");

  assert.ok(code.includes("export async function getDoctorWorkingHours"), "Must export getDoctorWorkingHours");
  assert.ok(code.includes("export async function updateDoctorWorkingHours"), "Must export updateDoctorWorkingHours");
  assert.ok(code.includes("DoctorWorkingHoursResponse"), "Must declare DoctorWorkingHoursResponse interface");
  assert.ok(code.includes("DoctorWorkingHoursUpdatePayload"), "Must declare DoctorWorkingHoursUpdatePayload interface");
  assert.ok(code.includes("/api/v1/doctor/working-hours"), "Must target /api/v1/doctor/working-hours route");
});

// V7: calendarUtils.ts WorkingHoursConfig supports closed_days and breakTime with default Sunday closure
runCheck("V7", "calendarUtils.ts WorkingHoursConfig schema & default Sunday closure parity", () => {
  const utilsPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "calendarUtils.ts"
  );
  assert.ok(fs.existsSync(utilsPath), "calendarUtils.ts must exist");
  const code = fs.readFileSync(utilsPath, "utf-8");

  assert.ok(code.includes("closed_days?: number[]"), "WorkingHoursConfig must support closed_days");
  assert.ok(code.includes("breakTime?: WorkingHoursBreak"), "WorkingHoursConfig must support breakTime");
  assert.ok(code.includes("closed_days: [0]"), "DEFAULT_WORKING_HOURS must default Sunday (0) to closed");
  assert.ok(code.includes("isSlotInBreak"), "isSlotWithinWorkingHours must check break time intervals");
});

console.log("\n============================================================");
console.log(`📊 RESULTS: ${passed} / ${total} CHECKS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================\n");

if (passed !== total) {
  process.exit(1);
}
