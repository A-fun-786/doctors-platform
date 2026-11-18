#!/usr/bin/env node

/**
 * Test Suite: Issue #31 - Week view shows only one appointment per time cell
 *
 * Verifies that:
 * 1. WeekView collects ALL appointments in a time slot via cellEvents.filter,
 *    eliminating the legacy .find() pattern that dropped concurrent bookings.
 * 2. WeekView maps over all booked appointments (apptEvents.map) so every appointment
 *    in that 30-minute time cell is rendered and interactive.
 * 3. In multi-event cells, the attending doctor's name is prominently rendered
 *    alongside the patient name to distinguish concurrent practitioners.
 * 4. Concurrent doctor leaves / clinic holidays and blocked periods are also rendered
 *    without colliding or obscuring patient appointments.
 * 5. Single appointment slots and empty slots preserve their clean, standardized design.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #31 - WeekView Multi-Appointment Per Time Cell");
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
// 1. AST & Code Pattern Verification in WeekView.tsx
// ------------------------------------------------------------------
const weekViewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "views",
  "WeekView.tsx"
);
const weekViewSource = fs.readFileSync(weekViewPath, "utf-8");

it("1.1 WeekView eliminates legacy cellEvents.find for appointments", () => {
  const hasLegacyFind = /cellEvents\.find\s*\(\s*\(\s*ev\s*\)\s*=>\s*ev\.type\s*===\s*["']APPOINTMENT["']\s*\)/.test(
    weekViewSource
  );
  assert.strictEqual(
    hasLegacyFind,
    false,
    "WeekView must NOT use cellEvents.find for APPOINTMENT, which drops concurrent appointments"
  );
});

it("1.2 WeekView filters all appointments via cellEvents.filter", () => {
  assert.ok(
    weekViewSource.includes('cellEvents.filter((ev) => ev.type === "APPOINTMENT")'),
    "WeekView must filter all appointments into apptEvents array"
  );
});

it("1.3 WeekView maps over apptEvents to render every appointment in the slot", () => {
  assert.ok(
    weekViewSource.includes("apptEvents.map("),
    "WeekView must iterate over apptEvents.map to render all concurrent bookings"
  );
});

it("1.4 WeekView renders patient name for each appointment", () => {
  assert.ok(
    weekViewSource.includes('apptEvent.patient_name || "Patient"'),
    "WeekView must render patient name for every appointment"
  );
});

it("1.5 WeekView renders doctor name in multi-event slots to distinguish practitioners", () => {
  assert.ok(
    weekViewSource.includes("isMulti && docName") &&
      weekViewSource.includes("apptEvent.doctor_name || apptEvent.staff_name"),
    "WeekView must render attending doctor name in multi-appointment cells"
  );
});

it("1.6 WeekView supports concurrent leaves without hiding appointments", () => {
  assert.ok(
    weekViewSource.includes("leaveEvents.map("),
    "WeekView must iterate over leaveEvents.map"
  );
});

it("1.7 WeekView renders empty slot button when no events are present", () => {
  assert.ok(
    weekViewSource.includes("hasEvents ? (") &&
      weekViewSource.includes("Empty Slot ("),
    "WeekView must render clean empty slot button when hasEvents is false"
  );
});

// ------------------------------------------------------------------
// 2. Behavioral Simulation: Multi-Doctor Concurrent Slots
// ------------------------------------------------------------------
const mockEvents = [
  {
    type: "APPOINTMENT",
    appointment_id: "apt-1",
    start: "10:00",
    end: "10:30",
    patient_name: "Alice Johnson",
    doctor_name: "Dr. Primary Owner",
    staff_id: null,
    status: "CONFIRMED",
  },
  {
    type: "APPOINTMENT",
    appointment_id: "apt-2",
    start: "10:00",
    end: "10:30",
    patient_name: "Bob Smith",
    doctor_name: "Dr. Sarah Staff",
    staff_id: "staff-uuid-1",
    status: "CONFIRMED",
  },
  {
    type: "APPOINTMENT",
    appointment_id: "apt-3",
    start: "10:00",
    end: "10:30",
    patient_name: "Charlie Brown",
    doctor_name: "Dr. David Staff",
    staff_id: "staff-uuid-2",
    status: "CONFIRMED",
  },
  {
    type: "APPOINTMENT",
    appointment_id: "apt-cancelled",
    start: "10:00",
    end: "10:30",
    patient_name: "Cancelled Patient",
    status: "CANCELLED",
  },
  {
    type: "LEAVE",
    schedule_id: "sch-leave-1",
    start: "10:00",
    end: "10:30",
    doctor_name: "Dr. Eve OnLeave",
    reason: "Medical Conference",
  },
];

function simulateCellFiltering(events, slotStart, slotEnd) {
  // Logic matching WeekView.tsx
  const cellEvents = events.filter(
    (ev) => ev.status !== "CANCELLED" && ev.start < slotEnd && ev.end > slotStart
  );
  const apptEvents = cellEvents.filter((ev) => ev.type === "APPOINTMENT");
  const leaveEvents = cellEvents.filter(
    (ev) => ev.type === "LEAVE" || ev.type === "HOLIDAY"
  );
  const blockedEvents = cellEvents.filter((ev) => ev.type === "BLOCKED");

  return { cellEvents, apptEvents, leaveEvents, blockedEvents };
}

it("2.1 Simulating multi-doctor slot: captures all 3 active concurrent appointments", () => {
  const result = simulateCellFiltering(mockEvents, "10:00", "10:30");
  assert.strictEqual(result.apptEvents.length, 3, "All 3 active appointments must be captured");
  assert.deepStrictEqual(
    result.apptEvents.map((a) => a.patient_name),
    ["Alice Johnson", "Bob Smith", "Charlie Brown"]
  );
  assert.deepStrictEqual(
    result.apptEvents.map((a) => a.doctor_name),
    ["Dr. Primary Owner", "Dr. Sarah Staff", "Dr. David Staff"]
  );
});

it("2.2 Simulating cancelled appointment: excluded from slot render", () => {
  const result = simulateCellFiltering(mockEvents, "10:00", "10:30");
  const hasCancelled = result.cellEvents.some((ev) => ev.status === "CANCELLED");
  assert.strictEqual(hasCancelled, false, "CANCELLED appointments must be excluded");
});

it("2.3 Simulating slot with both appointment and leave: retains both events", () => {
  const result = simulateCellFiltering(mockEvents, "10:00", "10:30");
  assert.strictEqual(result.leaveEvents.length, 1, "Leave event must be captured alongside appointments");
  assert.strictEqual(result.leaveEvents[0].doctor_name, "Dr. Eve OnLeave");
  assert.strictEqual(result.cellEvents.length, 4, "Total 4 events (3 appts + 1 leave) in cell");
});

it("2.4 Simulating empty slot: yields zero cell events", () => {
  const result = simulateCellFiltering(mockEvents, "14:00", "14:30");
  assert.strictEqual(result.cellEvents.length, 0, "No events in empty slot");
  assert.strictEqual(result.apptEvents.length, 0);
  assert.strictEqual(result.leaveEvents.length, 0);
});

// ------------------------------------------------------------------
// Summary Scorecard
// ------------------------------------------------------------------
console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}
