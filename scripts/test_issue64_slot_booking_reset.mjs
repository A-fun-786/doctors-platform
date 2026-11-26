#!/usr/bin/env node

/**
 * Test Suite: Issue #64 - Last entered patient info must not persist in next slot booking
 *
 * Verifies that:
 * 1. SlotActionModal defines a resetForm helper that clears all patient & leave form fields.
 * 2. SlotActionModal runs resetForm via useEffect whenever isOpen, date, startTime, or endTime changes while open.
 * 3. useCalendarModals.openAddAppointment resets newPatientName, newPatientContact, and newApptReason.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #64 - Slot Booking Form Reset");
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

const slotModalPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "modals",
  "SlotActionModal.tsx"
);
const slotModalSource = fs.readFileSync(slotModalPath, "utf-8");

it("1.1 SlotActionModal defines resetForm clearing all patient and leave fields", () => {
  assert.ok(slotModalSource.includes("const resetForm = useCallback("), "resetForm must be defined");
  const expectedResets = [
    'setInternalStaffId("")',
    'setPatientName("")',
    'setPatientContact("")',
    'setPatientGender("")',
    'setPatientAge("")',
    'setReason("General Consultation")',
    'setCustomReason("")',
    'setPatientHeight("")',
    'setPatientWeight("")',
    'setPatientBloodGroup("")',
    'setPatientAddress("")',
    'setNotes("")',
    'setLeaveReason("Personal Leave")',
    'setCustomLeaveReason("")',
  ];
  for (const call of expectedResets) {
    assert.ok(slotModalSource.includes(call), `resetForm must call ${call}`);
  }
});

it("1.2 SlotActionModal resets form state when opened or when target slot changes", () => {
  assert.ok(
    /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(isOpen\)\s*\{\s*resetForm\(\);\s*\}\s*\},\s*\[isOpen,\s*date,\s*startTime,\s*endTime,\s*resetForm\]\)/.test(
      slotModalSource
    ),
    "SlotActionModal must invoke resetForm() in useEffect on [isOpen, date, startTime, endTime, resetForm]"
  );
});

const hookPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "hooks",
  "useCalendarModals.ts"
);
const hookSource = fs.readFileSync(hookPath, "utf-8");

it("2.1 useCalendarModals.openAddAppointment clears previous patient fields on open", () => {
  const openAddMatch = hookSource.match(/const openAddAppointment = useCallback\(([\s\S]*?)\[\]\s*\);/);
  assert.ok(openAddMatch, "openAddAppointment must exist");
  const body = openAddMatch[1];
  assert.ok(body.includes('setNewPatientName("")'), "openAddAppointment must reset newPatientName");
  assert.ok(body.includes('setNewPatientContact("")'), "openAddAppointment must reset newPatientContact");
  assert.ok(body.includes('setNewApptReason("")'), "openAddAppointment must reset newApptReason");
});

console.log("------------------------------------------------------------");
console.log(`Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
