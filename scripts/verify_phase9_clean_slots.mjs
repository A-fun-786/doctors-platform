#!/usr/bin/env node

/**
 * Phase 9 Verification Script: Clean Calendar Slots & Break Time Omission
 * Validates:
 * 1. Filled calendar slots display ONLY the patient name (no time range or reason subtitles inside the card).
 * 2. Unbooked / open slots render as empty slots (no green "Available" badges, no default text clutter).
 * 3. Break time slots are NOT mentioned anywhere in WeekView.tsx.
 * 4. DayView appointment cards prominently display patient name without extra subtitle clutter.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const weekViewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "views",
  "WeekView.tsx"
);
const dayViewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "views",
  "DayView.tsx"
);

console.log("\n============================================================");
console.log("🧪 VERIFYING PHASE 9: CLEAN SLOTS & BREAK OMISSION");
console.log("============================================================\n");

let passed = 0;
let total = 0;

function runCheck(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[✅ PASS] ${name}`);
  } catch (err) {
    console.error(`[❌ FAIL] ${name}: ${err.message}`);
  }
}

const weekViewContent = fs.readFileSync(weekViewPath, "utf-8");
const dayViewContent = fs.readFileSync(dayViewPath, "utf-8");

// Check 1: In filled slot, ONLY patient name is shown
runCheck("V1: Filled calendar slot renders only patient name", () => {
  // Must render apptEvent.patient_name
  assert.ok(
    weekViewContent.includes("apptEvent.patient_name || \"Patient\""),
    "WeekView must render apptEvent.patient_name"
  );
  // Must NOT render subtitle start-end time inside appointment card
  const hasApptTimeSubtitle = /apptEvent[\s\S]*?format12Hour\(event\.start\)/.test(weekViewContent);
  assert.strictEqual(
    hasApptTimeSubtitle,
    false,
    "Filled slot must not render time range subtitle inside card"
  );
  // Must NOT render reason subtitle inside appointment card
  const hasReasonSubtitle = /apptEvent[\s\S]*?event\.reason[\s\S]*?font-mono/.test(weekViewContent);
  assert.strictEqual(
    hasReasonSubtitle,
    false,
    "Filled slot must not render reason subtitle inside card"
  );
});

// Check 2: Otherwise empty slot
runCheck("V2: Unbooked slots render as clean empty slots", () => {
  // Must NOT render heavy "Available" green text badges in slots
  assert.ok(
    !weekViewContent.includes("Available\n") && !weekViewContent.includes(">Available<"),
    "WeekView must not render text 'Available' in slots"
  );
  // Empty slot button must exist with click handlers
  assert.ok(
    weekViewContent.includes("onEmptySlotClick") &&
      weekViewContent.includes("title={`Empty Slot"),
    "WeekView must render clean empty slot button"
  );
});

// Check 3: Not mention break time slot
runCheck("V3: Zero mentions of break time in WeekView.tsx", () => {
  const breakRegex = /\bbreak\b|\bBreak\b|\bLUNCH\b|\blunch\b/i;
  const breakMatches = weekViewContent
    .split("\n")
    .filter((line) => breakRegex.test(line));
  assert.strictEqual(
    breakMatches.length,
    0,
    `Found break references in WeekView.tsx: ${breakMatches.join("; ")}`
  );
});

// Check 4: DayView appointment card shows patient name with reason for visit
runCheck("V4: DayView appointment card displays patient name with visit reason", () => {
  assert.ok(
    dayViewContent.includes("event.patient_name || \"Patient\""),
    "DayView must display event.patient_name"
  );
  assert.ok(
    dayViewContent.includes("event.reason || \"General Visit\""),
    "DayView must display visit reason alongside patient name"
  );
  // Must not have legacy "Patient: " prefix
  assert.ok(
    !dayViewContent.includes("<span>Patient: {event.patient_name}</span>"),
    "DayView should display clean patient name without 'Patient:' label"
  );
});

// Check 5: DayView renders clean empty slot for available/unbooked intervals
runCheck("V5: DayView otherwise renders clean empty slot with booking trigger", () => {
  assert.ok(
    dayViewContent.includes("Empty Slot") &&
      dayViewContent.includes("— Click to book") &&
      dayViewContent.includes('"EMPTY SLOT"'),
    "DayView must render 'Empty Slot', '— Click to book', and 'EMPTY SLOT' badge"
  );
  assert.ok(
    dayViewContent.includes("onEmptySlotClick"),
    "DayView must support onEmptySlotClick callback for empty slot booking"
  );
  // Must not render legacy emerald green "Open for Booking" or "Open 30-Minute Booking Slot"
  assert.ok(
    !dayViewContent.includes("Open 30-Minute Booking Slot") &&
      !dayViewContent.includes("Open for Booking"),
    "DayView must not use legacy green 'Open for Booking' labels"
  );
});

// Check 6: DayView top legend bar renders on top with full semantic color indicators
runCheck("V6: DayView renders operational legend bar on top", () => {
  assert.ok(
    dayViewContent.includes("Calendar Legend Bar on Top"),
    "DayView must include top calendar legend bar comment/block"
  );
  assert.ok(
    dayViewContent.includes("Appointment (Patient)") &&
      dayViewContent.includes("Empty Slot (Click to Book)") &&
      dayViewContent.includes("Doctor Leave") &&
      dayViewContent.includes("Blocked Period") &&
      dayViewContent.includes("30-Minute Operating Intervals"),
    "DayView legend bar must include all 4 slot categories and 30-min interval label"
  );
  const legendIndex = dayViewContent.indexOf("Calendar Legend Bar on Top");
  const headerIndex = dayViewContent.indexOf("Day Schedule — {selectedDate}");
  assert.ok(
    legendIndex > 0 && legendIndex < headerIndex,
    "Legend bar must appear at the top of DayView before the day schedule header"
  );
});

// Check 7: Elimination of redundant "Book Patient" button from Day Schedule header
runCheck("V7: DayView eliminates redundant 'Book Patient' header button", () => {
  assert.ok(
    !dayViewContent.includes("Book Patient") ||
      !dayViewContent.includes("<Plus className="),
    "DayView must not render redundant 'Book Patient' header button"
  );
  assert.ok(
    !dayViewContent.includes("onClick={onBookPatient}"),
    "DayView header must not have onClick={onBookPatient} button"
  );
});

console.log("\n------------------------------------------------------------");
console.log(`Results: ${passed}/${total} checks passed (${Math.round((passed / total) * 100)}%)`);
console.log("------------------------------------------------------------\n");

if (passed !== total) {
  process.exit(1);
}
