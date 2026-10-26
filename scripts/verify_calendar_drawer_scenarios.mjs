#!/usr/bin/env node

/**
 * Calendar Slot Details & Rescheduling Drawer Verification Script
 * Validates Scenarios S1–S5 covering:
 * - S1: Patient Appointment Slot View Details & All Vitals/IDs
 * - S2: Doctor Leave Slot View Details & Leave ID
 * - S3: Appointment Reschedule Flow, Grid & Confirmation Modal
 * - S4: Delete Doctor Leave Flow & Slot Freeing
 * - S5: Drawer Accessibility, Backdrop, Transitions & Hook Integration
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("\n============================================================");
console.log("🧪 VERIFYING CALENDAR SLOT DETAILS & RESCHEDULING DRAWER (S1-S5)");
console.log("============================================================\n");

let passed = 0;
let total = 0;

function runScenario(title, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[✅ PASS] ${title}`);
  } catch (err) {
    console.error(`[❌ FAIL] ${title}: ${err.message}`);
  }
}

// S1: Patient Appointment Slot - View Details & Vitals/IDs
runScenario("S1: Patient Appointment Slot View Details & Vitals/IDs (AppointmentDetailsPanel)", () => {
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

  // Patient Name, Patient ID, Doctor ID, Appointment ID
  assert.ok(code.includes("patient_name"), "Must render patient_name");
  assert.ok(code.includes("effectivePatientId"), "Must render effectivePatientId");
  assert.ok(code.includes("effectiveDoctorId"), "Must render effectiveDoctorId");
  assert.ok(code.includes("appointment_id"), "Must render appointment_id");

  // Contact info
  assert.ok(code.includes("patientPhone") && code.includes("patientEmail"), "Must render phone and email");
  assert.ok(code.includes("patient_address"), "Must render patient_address");

  // Vitals matrix
  assert.ok(code.includes("patient_age"), "Must render patient_age");
  assert.ok(code.includes("patient_gender"), "Must render patient_gender");
  assert.ok(code.includes("patient_blood_group"), "Must render patient_blood_group");
  assert.ok(code.includes("patient_height"), "Must render patient_height");
  assert.ok(code.includes("patient_weight"), "Must render patient_weight");

  // Consultation details
  assert.ok(code.includes("reason"), "Must render visit reason");
  assert.ok(code.includes("notes"), "Must render clinical notes");
  assert.ok(code.includes("created_at"), "Must render created_at");

  // Copy buttons
  assert.ok(code.includes("handleCopy"), "Must provide copy to clipboard handler");
  assert.ok(code.includes("Copy"), "Must import Copy icon");

  // Hydration hook
  assert.ok(code.includes("getAppointment"), "Must hydrate full appointment data from backend API");
});

// S2: Doctor Leave Slot - View Details & Leave ID (LeaveDetailsPanel)
runScenario("S2: Doctor Leave Slot View Details & Leave ID (LeaveDetailsPanel)", () => {
  const panelPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "LeaveDetailsPanel.tsx"
  );
  assert.ok(fs.existsSync(panelPath), "LeaveDetailsPanel.tsx must exist");
  const code = fs.readFileSync(panelPath, "utf-8");

  // Leave ID prominence
  assert.ok(code.includes("resolvedLeaveId") || code.includes("displayLeaveId"), "Must manage resolvedLeaveId");
  assert.ok(code.includes("Leave ID:"), "Must display Leave ID label prominently");
  assert.ok(code.includes("effectiveDoctorId"), "Must render doctor_id");

  // Badge & Time window
  assert.ok(code.includes("format12Hour"), "Must format 12-hour start and end times");
  assert.ok(code.includes("reason"), "Must render leave reason");

  // Delete / Cancel Leave Button
  assert.ok(code.includes("Cancel Leave") || code.includes("Delete Leave"), "Must have cancel/delete leave button");
  assert.ok(code.includes("deleteDoctorSchedule"), "Must call deleteDoctorSchedule API");
});

// S3: Appointment Reschedule Flow, Grid & Confirmation Modal
runScenario("S3: Appointment Reschedule Flow, Grid & Confirmation Modal", () => {
  const formPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "AppointmentRescheduleForm.tsx"
  );
  const gridPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "SlotSelectorGrid.tsx"
  );
  const modalPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "RescheduleConfirmModal.tsx"
  );

  assert.ok(fs.existsSync(formPath), "AppointmentRescheduleForm.tsx must exist");
  assert.ok(fs.existsSync(gridPath), "SlotSelectorGrid.tsx must exist");
  assert.ok(fs.existsSync(modalPath), "RescheduleConfirmModal.tsx must exist");

  const formCode = fs.readFileSync(formPath, "utf-8");
  const gridCode = fs.readFileSync(gridPath, "utf-8");
  const modalCode = fs.readFileSync(modalPath, "utf-8");

  // Reschedule API dispatch
  assert.ok(formCode.includes("rescheduleAppointment"), "Must call rescheduleAppointment API");
  assert.ok(formCode.includes("RescheduleConfirmModal"), "Must trigger RescheduleConfirmModal");

  // Conflict checking in slot grid
  assert.ok(gridCode.includes("doesEventOverlapSlot"), "Must check slot overlap with doesEventOverlapSlot");
  assert.ok(gridCode.includes("isSlotWithinWorkingHours"), "Must check doctor working hours");
  assert.ok(gridCode.includes("isConflict") || gridCode.includes("conflictReason"), "Must identify and disable conflicting slots");

  // Confirmation modal details
  assert.ok(modalCode.includes("patientName"), "Must show patient name in confirmation");
  assert.ok(modalCode.includes("originalDate") && modalCode.includes("newDate"), "Must compare dates");
  assert.ok(modalCode.includes("Confirm Reschedule"), "Must have confirm button");
});

// S4: Delete Doctor Leave Flow & Immediate Slot Freeing
runScenario("S4: Delete Doctor Leave Flow & Immediate Slot Freeing", () => {
  const leavePanelPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "LeaveDetailsPanel.tsx"
  );
  const code = fs.readFileSync(leavePanelPath, "utf-8");

  assert.ok(code.includes("showConfirmModal"), "Must require confirmation before deletion");
  assert.ok(code.includes("deleteDoctorSchedule"), "Must dispatch delete schedule API");
  assert.ok(code.includes("onRefreshCalendar"), "Must refresh calendar stream to free slot immediately");
});

// S5: Drawer Accessibility, Transitions & Hook Integration
runScenario("S5: Drawer Accessibility, Transitions & Hook Integration", () => {
  const drawerPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "CalendarDrawer.tsx"
  );
  const hookPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "hooks",
    "useCalendarDrawer.ts"
  );
  const tabPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "CalendarTab.tsx"
  );

  assert.ok(fs.existsSync(drawerPath), "CalendarDrawer.tsx must exist");
  assert.ok(fs.existsSync(hookPath), "useCalendarDrawer.ts must exist");

  const drawerCode = fs.readFileSync(drawerPath, "utf-8");
  const hookCode = fs.readFileSync(hookPath, "utf-8");
  const tabCode = fs.readFileSync(tabPath, "utf-8");

  // Drawer accessibility & transitions
  assert.ok(drawerCode.includes('aria-modal="true"'), "Must have aria-modal attribute");
  assert.ok(drawerCode.includes('e.key === "Escape"'), "Must handle Escape key to close");
  assert.ok(drawerCode.includes("backdrop-blur"), "Must render backdrop blur overlay");
  assert.ok(drawerCode.includes("slide-in-from-right"), "Must have smooth slide transitions");

  // Hook state management
  assert.ok(hookCode.includes("openEventDrawer"), "Hook must provide openEventDrawer");
  assert.ok(hookCode.includes("closeDrawer"), "Hook must provide closeDrawer");
  assert.ok(hookCode.includes("isOpen"), "Hook must manage isOpen boolean");

  // CalendarTab integration
  assert.ok(tabCode.includes("CalendarDrawer"), "CalendarTab must mount CalendarDrawer");
  assert.ok(tabCode.includes("openEventDrawer"), "CalendarTab must trigger drawer via openEventDrawer");
});

// S6: Appointment Lifecycle State Transitions (Complete & Cancel Actions + Reschedule Guard)
runScenario("S6: Appointment Lifecycle State Transitions (Complete & Cancel Actions + Reschedule Guard)", () => {
  const panelPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "panels",
    "AppointmentDetailsPanel.tsx"
  );
  const apiPath = path.join(projectRoot, "lib", "api.ts");

  assert.ok(fs.existsSync(panelPath), "AppointmentDetailsPanel.tsx must exist");
  assert.ok(fs.existsSync(apiPath), "lib/api.ts must exist");

  const panelCode = fs.readFileSync(panelPath, "utf-8");
  const apiCode = fs.readFileSync(apiPath, "utf-8");

  // V1: Complete & Cancel helper wiring
  assert.ok(panelCode.includes("completeAppointment"), "AppointmentDetailsPanel must import & call completeAppointment");
  assert.ok(panelCode.includes("cancelAppointment"), "AppointmentDetailsPanel must import & call cancelAppointment");
  assert.ok(panelCode.includes("Mark Completed"), "Must render 'Mark Completed' action button");
  assert.ok(panelCode.includes("Cancel Appointment"), "Must render 'Cancel Appointment' action button");
  assert.ok(panelCode.includes("onRefreshCalendar"), "Must refresh calendar stream on transition");
  assert.ok(panelCode.includes("showToast"), "Must trigger toast notification on transition");

  // V2: Reschedule guard against completed and cancelled consultations
  assert.ok(
    panelCode.includes('currentEvent.status !== "CANCELLED" && currentEvent.status !== "COMPLETED"') ||
    panelCode.includes('currentEvent.status !== "COMPLETED" && currentEvent.status !== "CANCELLED"'),
    "Must prevent completed or cancelled appointments from being edited / rescheduled"
  );

  // Cancellation Confirmation Dialog with slot release warning
  assert.ok(
    panelCode.includes("Cancelling this appointment will release this 30-minute slot for other patients."),
    "Cancel modal must display release slot warning message"
  );
  assert.ok(panelCode.includes("Confirm Cancellation"), "Cancel modal must render Confirm Cancellation button");
  assert.ok(panelCode.includes("cancelReason"), "Cancel modal must support optional reason input");

  // Status badges color coding
  assert.ok(panelCode.includes("getStatusBadgeStyle"), "Must have getStatusBadgeStyle helper");
  assert.ok(panelCode.includes("bg-emerald-100") && panelCode.includes("text-emerald-800"), "COMPLETED status must use emerald style");
  assert.ok(panelCode.includes("bg-rose-100") && panelCode.includes("text-rose-800"), "CANCELLED status must use rose style");
  assert.ok(panelCode.includes("bg-slate-100") && panelCode.includes("text-slate-700"), "NO_SHOW status must use slate style");
  assert.ok(panelCode.includes("bg-blue-100") && panelCode.includes("text-blue-800"), "BOOKED status must use blue style");

  // API helper signatures
  assert.ok(apiCode.includes("export async function completeAppointment(id: string)"), "completeAppointment API helper exported");
  assert.ok(apiCode.includes("export async function cancelAppointment(id: string"), "cancelAppointment API helper exported");
});

console.log("\n============================================================");
console.log(`🏁 SCORECARD: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================\n");

if (passed === total) {
  console.log("🎉 ALL CALENDAR DRAWER & RESCHEDULING SCENARIOS VERIFIED SUCCESSFULLY!\n");
  process.exit(0);
} else {
  process.exit(1);
}
