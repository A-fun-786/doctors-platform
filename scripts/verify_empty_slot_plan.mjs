#!/usr/bin/env node

/**
 * Empty Calendar Slot & Editable Working Hours Verification Script
 * Validates Scenarios E1–E5 across frontend logic, schemas, and live backend OpenAPI docs.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const calendarUtilsPath = path.join(projectRoot, "components", "dashboard", "calendar", "calendarUtils.ts");

const rawTs = fs.readFileSync(calendarUtilsPath, "utf-8");
const cleanTs = rawTs
  .replace(/import\s*\{\s*CalendarEvent\s*\}\s*from\s*"@\/lib\/api";/, "")
  .replace(/import\s*\{\s*WeekDayItem[^}]*\}\s*from\s*"\.\/types";/, "")
  .replace(/import\s*\{\s*DAY_NAMES\s*\}\s*from\s*"\.\/constants";/, "const DAY_NAMES = [\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\"];");

const jsCode = ts.transpileModule(cleanTs, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const encodedUri = "data:text/javascript;base64," + Buffer.from(jsCode).toString("base64");
const {
  isSlotWithinWorkingHours,
  calculateShiftSlotCount,
  DEFAULT_WORKING_HOURS,
  formatPatientClinicalNotes,
} = await import(encodedUri);

console.log("\n============================================================");
console.log("🧪 VERIFYING EMPTY SLOT & EDITABLE WORKING HOURS SCENARIOS");
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

async function runAsyncScenario(title, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`[✅ PASS] ${title}`);
  } catch (err) {
    console.error(`[❌ FAIL] ${title}: ${err.message}`);
  }
}

// E1: Working Hours Detection & Slot Highlighting
runScenario("E1: Standard Working Hours & Sunday Closure", () => {
  assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "10:00", "10:30"), true);
  assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "16:30", "17:00"), true);
  assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "14:00", "14:30"), false); // break
  assert.strictEqual(isSlotWithinWorkingHours("2026-10-18", "10:00", "10:30"), false); // Sunday
});

// E2: Editable Working Hours Reconfiguration
runScenario("E2: Shift Reconfiguration & Slot Count Computation", () => {
  const morningCount = calculateShiftSlotCount("10:00", "13:00");
  assert.strictEqual(morningCount, 6);
  const eveningCount = calculateShiftSlotCount("16:00", "20:00");
  assert.strictEqual(eveningCount, 8);
  assert.strictEqual(morningCount + eveningCount, 14);

  // Reconfigured custom shift (09:00 - 12:30)
  const customMorningCount = calculateShiftSlotCount("09:00", "12:30");
  assert.strictEqual(customMorningCount, 7);
  const customConfig = {
    shifts: [
      { id: "morning", label: "Morning", start: "09:00", end: "12:30", enabled: true },
      { id: "evening", label: "Evening", start: "16:00", end: "20:00", enabled: true },
    ],
  };
  assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "09:00", "09:30", customConfig), true);
  assert.strictEqual(isSlotWithinWorkingHours("2026-10-19", "12:30", "13:00", customConfig), false);
});

// E3: SlotActionModal Booking Form Mandatory Validation Check
runScenario("E3: Booking Form Mandatory Fields & Vitals Packaging", () => {
  const slotActionModalPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "modals",
    "SlotActionModal.tsx"
  );
  const code = fs.readFileSync(slotActionModalPath, "utf-8");
  assert.ok(code.includes("patientName.trim().length >= 1"), "Must require patientName");
  assert.ok(code.includes("patientContact.trim().length >= 5"), "Must require patientContact >= 5");
  assert.ok(code.includes("patientGender === \"Male\" || patientGender === \"Female\" || patientGender === \"Other\""), "Must require valid patientGender");
  assert.ok(code.includes("Number(patientAge) >= 0") && code.includes("Number(patientAge) <= 130"), "Must require valid patientAge (0-130)");
  assert.ok(code.includes("effectiveReason.length >= 1"), "Must require visit reason");
});

// E4: Leave Tab Single Reason Check
runScenario("E4: Leave Tab Streamlined Reason-Only Form", () => {
  const slotActionModalPath = path.join(
    projectRoot,
    "components",
    "dashboard",
    "calendar",
    "modals",
    "SlotActionModal.tsx"
  );
  const code = fs.readFileSync(slotActionModalPath, "utf-8");
  assert.ok(code.includes("Marking Slot as Doctor Leave"), "Must explain Doctor Leave marking");
  assert.ok(code.includes("onMarkLeave"), "Must provide onMarkLeave submit handler");
  assert.ok(code.includes("COMMON_LEAVE_REASONS"), "Must include standard common leave reasons");
});

// E5: Live Backend OpenAPI Schema Dedicated Columns
await runAsyncScenario("E5: Live Backend OpenAPI Schema Dedicated Columns", async () => {
  const res = await fetch("http://127.0.0.1:8000/openapi.json");
  assert.strictEqual(res.status, 200, "OpenAPI schema must be accessible");
  const schema = await res.json();
  const appointmentCreateProperties =
    schema.components.schemas.AppointmentCreateRequest.properties;
  assert.ok("patient_gender" in appointmentCreateProperties, "Must contain patient_gender");
  assert.ok("patient_age" in appointmentCreateProperties, "Must contain patient_age");
  assert.ok("patient_height" in appointmentCreateProperties, "Must contain patient_height");
  assert.ok("patient_weight" in appointmentCreateProperties, "Must contain patient_weight");
  assert.ok("patient_blood_group" in appointmentCreateProperties, "Must contain patient_blood_group");
  assert.ok("patient_address" in appointmentCreateProperties, "Must contain patient_address");

  const calendarEventProperties = schema.components.schemas.CalendarEvent.properties;
  assert.ok("patient_gender" in calendarEventProperties, "CalendarEvent must contain patient_gender");
  assert.ok("patient_age" in calendarEventProperties, "CalendarEvent must contain patient_age");
  assert.ok("patient_blood_group" in calendarEventProperties, "CalendarEvent must contain patient_blood_group");
});

console.log("\n============================================================");
console.log(`🏁 SCORECARD: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================\n");

if (passed === total) {
  console.log("🎉 ALL EMPTY SLOT & EDITABLE WORKING HOURS SCENARIOS VERIFIED SUCCESSFULLY!\n");
  process.exit(0);
} else {
  process.exit(1);
}
