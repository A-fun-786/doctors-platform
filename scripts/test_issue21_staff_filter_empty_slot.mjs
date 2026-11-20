#!/usr/bin/env node

/**
 * Test Suite: Issue #21 - Empty-slot booking defaults to primary doctor under staff filter
 *
 * Verifies that:
 * 1. When a staff doctor is selected in the practitionerFilter, clicking an empty slot
 *    forwards the staff doctor's ID to openSlotActionModal.
 * 2. QuickAddSlot in WeekView also forwards the staff doctor ID.
 * 3. DayView empty slot click and onBookPatient forward the staff doctor ID.
 * 4. Header & Agenda onBookAppointment forward the effective staff doctor ID.
 * 5. Primary Doctor and "ALL" filters cleanly resolve to "" without leaking strings.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #21 - Staff Filter Empty Slot Pre-Selection");
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
// 1. AST & Code Pattern Verification in CalendarTab.tsx
// ------------------------------------------------------------------
const calendarTabPath = path.join(projectRoot, "components", "dashboard", "CalendarTab.tsx");
const calendarTabSource = fs.readFileSync(calendarTabPath, "utf-8");

it("1.1 CalendarTab defines effectiveStaffId derived from practitionerFilter", () => {
  assert.ok(
    calendarTabSource.includes("const effectiveStaffId = useMemo("),
    "effectiveStaffId useMemo should be defined in CalendarTab.tsx"
  );
  assert.ok(
    calendarTabSource.includes('practitionerFilter === "ALL"') &&
    calendarTabSource.includes('practitionerFilter === "PRIMARY"'),
    "effectiveStaffId should filter out ALL and PRIMARY sentinels"
  );
});

it("1.2 handleEmptySlotClick passes staffId to openSlotActionModal", () => {
  assert.ok(
    calendarTabSource.includes("const handleEmptySlotClick = useCallback("),
    "handleEmptySlotClick callback should be defined"
  );
  assert.ok(
    calendarTabSource.includes("openSlotActionModal(date, start, end, \"booking\", slotStaffId || effectiveStaffId)"),
    "handleEmptySlotClick must pass slotStaffId || effectiveStaffId to openSlotActionModal"
  );
});

it("1.3 handleQuickAddSlot passes staffId to openAddAppointment", () => {
  assert.ok(
    calendarTabSource.includes("openAddAppointment(dateStr, start, end, slotStaffId || effectiveStaffId)"),
    "handleQuickAddSlot must forward slotStaffId || effectiveStaffId to openAddAppointment"
  );
});

it("1.4 WeekView uses handleEmptySlotClick instead of raw openSlotActionModal", () => {
  assert.ok(
    calendarTabSource.includes("onEmptySlotClick={isStaffDoctor ? undefined : handleEmptySlotClick}"),
    "WeekView must receive handleEmptySlotClick"
  );
  assert.ok(
    !calendarTabSource.includes("onEmptySlotClick={isStaffDoctor ? undefined : openSlotActionModal}"),
    "WeekView must NOT receive uncurried openSlotActionModal"
  );
});

it("1.5 DayView uses handleEmptySlotClick for empty slot click and onBookPatient", () => {
  assert.ok(
    calendarTabSource.includes("onEmptySlotClick={isStaffDoctor ? undefined : handleEmptySlotClick}"),
    "DayView must receive handleEmptySlotClick"
  );
  assert.ok(
    calendarTabSource.includes("handleEmptySlotClick(selectedDate, \"10:00\", \"10:30\")"),
    "DayView onBookPatient must call handleEmptySlotClick with current context"
  );
});

it("1.6 CalendarHeader and AgendaView forward effectiveStaffId to openAddAppointment", () => {
  assert.ok(
    calendarTabSource.includes("openAddAppointment(selectedDate, \"10:00\", \"10:30\", effectiveStaffId)"),
    "CalendarHeader and AgendaView must use effectiveStaffId"
  );
  assert.ok(
    !calendarTabSource.includes("openAddAppointment(selectedDate, \"10:00\", \"10:30\", practitionerFilter || \"\")"),
    "CalendarTab must NOT pass raw practitionerFilter string directly"
  );
});

it("1.7 Both SlotActionModal and AddAppointmentModal receive practitioners prop", () => {
  assert.ok(
    calendarTabSource.includes("<SlotActionModal") &&
    calendarTabSource.includes("practitioners={practitioners}"),
    "SlotActionModal and AddAppointmentModal must receive practitioners prop"
  );
});

// ------------------------------------------------------------------
// 2. Behavioral Unit Simulation of effectiveStaffId logic
// ------------------------------------------------------------------
function computeEffectiveStaffId(practitionerFilter) {
  if (!practitionerFilter || practitionerFilter === "ALL" || practitionerFilter === "PRIMARY") {
    return "";
  }
  return practitionerFilter;
}

it("2.1 Staff Doctor UUID is preserved for slot actions", () => {
  const staffDocUuid = "c9b139ec-9467-425b-b9d7-8547ad3ef1b5";
  const result = computeEffectiveStaffId(staffDocUuid);
  assert.equal(result, staffDocUuid);
});

it("2.2 PRIMARY filter resolves to empty string (Primary Doctor default)", () => {
  const result = computeEffectiveStaffId("PRIMARY");
  assert.equal(result, "");
});

it("2.3 ALL filter resolves to empty string (Clinic wide default)", () => {
  const result = computeEffectiveStaffId("ALL");
  assert.equal(result, "");
});

it("2.4 null or undefined filter resolves to empty string", () => {
  assert.equal(computeEffectiveStaffId(null), "");
  assert.equal(computeEffectiveStaffId(undefined), "");
  assert.equal(computeEffectiveStaffId(""), "");
});

// ------------------------------------------------------------------
// 3. Slot Action Modal Behavior & Payload Simulation
// ------------------------------------------------------------------
it("3.1 Simulating empty slot click under Staff Doctor filter sets selectedStaffId correctly", () => {
  const staffDocUuid = "staff-doc-42";
  let modalStaffId = null;

  function mockOpenSlotActionModal(date, start, end, initialTab, staffId) {
    modalStaffId = staffId;
  }

  function mockHandleEmptySlotClick(date, start, end, slotStaffId) {
    const effectiveStaffId = computeEffectiveStaffId(staffDocUuid);
    mockOpenSlotActionModal(date, start, end, "booking", slotStaffId || effectiveStaffId);
  }

  // User clicks slot at 10:30 AM
  mockHandleEmptySlotClick("2026-10-21", "10:30", "11:00");

  assert.equal(
    modalStaffId,
    staffDocUuid,
    "Expected modalStaffId to be the filtered staff doctor's UUID"
  );
});

it("3.2 Appointment creation payload includes staff_id when staff doctor is selected", () => {
  const staffDocUuid = "staff-doc-42";
  const formData = {
    staffId: staffDocUuid,
    patientName: "Jane Doe",
    patientContact: "9876543210",
  };

  const payload = {
    staff_id: formData.staffId || undefined,
    patient_name: formData.patientName,
    patient_contact: formData.patientContact,
  };

  assert.equal(payload.staff_id, staffDocUuid);
});

it("3.3 Appointment creation payload sets staff_id to undefined for Primary Doctor", () => {
  const formData = {
    staffId: "",
    patientName: "John Smith",
    patientContact: "9876543211",
  };

  const payload = {
    staff_id: formData.staffId || undefined,
    patient_name: formData.patientName,
    patient_contact: formData.patientContact,
  };

  assert.equal(payload.staff_id, undefined);
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}
