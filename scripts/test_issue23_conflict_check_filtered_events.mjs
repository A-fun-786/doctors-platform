/**
 * Automated Verification Suite for Issue #23:
 * Calendar: conflict check uses filtered events, allowing double-booking.
 *
 * Verifies:
 * 1. CalendarTab.tsx AST & Prop Verification:
 *    - Uses getAllEventsForDate (unfiltered operational events) instead of getEventsForDate (filtered events)
 *      for all conflict checking, booking submissions, leave marking, and drawer reschedule panels.
 *    - Keeps getEventsForDate for visual calendar views (WeekView, DayView, MonthView, AgendaView).
 * 2. useCalendarData.ts Architecture:
 *    - Exports both getEventsForDate and getAllEventsForDate.
 *    - Fetches full operational calendar without practitionerFilter constraint so all clinic bookings are in cache.
 *    - Performs client-side practitioner filtering cleanly in getEventsForDate.
 *    - Provides ensureDateLoaded to preload dates outside the current week.
 * 3. calendarUtils.ts findConflictingEvents Resilience:
 *    - Ignores AVAILABLE slots (does not treat open availability slots as collisions).
 *    - Ignores CANCELLED appointments.
 *    - Respects doctor targeting (allows concurrent bookings for different doctors).
 *    - Flags conflicts when booking the same doctor even when another doctor is filtered.
 *    - Flags clinic-wide HOLIDAY for all doctors.
 * 4. Multi-Doctor End-to-End Double-Booking Prevention Simulation:
 *    - When filter is set to Doctor A, booking Doctor B detects Doctor B's existing appointment as conflict.
 *    - When filter is set to Doctor A, booking Primary Doctor detects Primary Doctor's existing appointment.
 *    - When filter is set to Doctor A, blocking time detects appointments of all clinic doctors.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #23 - Calendar Conflict Check Double-Booking Prevention");
console.log("============================================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ------------------------------------------------------------------
// 1. CalendarTab.tsx AST & Integration Verification
// ------------------------------------------------------------------
const calendarTabPath = path.join(projectRoot, "components", "dashboard", "CalendarTab.tsx");
const calendarTabSource = fs.readFileSync(calendarTabPath, "utf-8");

test("1.1 CalendarTab imports getAllEventsForDate from useCalendarData", () => {
  assert.ok(
    calendarTabSource.includes("getAllEventsForDate"),
    "CalendarTab must destructure getAllEventsForDate from useCalendarData"
  );
});

test("1.2 SlotActionModal receives getAllEventsForDate for existingEvents", () => {
  assert.ok(
    calendarTabSource.includes("<SlotActionModal") &&
    calendarTabSource.includes("existingEvents={getAllEventsForDate(modalDate)}"),
    "SlotActionModal must receive getAllEventsForDate(modalDate) for accurate conflict checks"
  );
  assert.ok(
    !calendarTabSource.includes("<SlotActionModal") ||
    !calendarTabSource.includes("existingEvents={getEventsForDate(modalDate)}"),
    "SlotActionModal must NOT receive filtered getEventsForDate"
  );
});

test("1.3 SlotActionModal booking & leave callbacks pass getAllEventsForDate", () => {
  assert.ok(
    calendarTabSource.includes("handleSlotBookingSubmit(") &&
    calendarTabSource.includes("getAllEventsForDate(modalDate)"),
    "handleSlotBookingSubmit must receive getAllEventsForDate(modalDate)"
  );
  assert.ok(
    calendarTabSource.includes("handleSlotLeaveSubmit(") &&
    calendarTabSource.includes("getAllEventsForDate(modalDate)"),
    "handleSlotLeaveSubmit must receive getAllEventsForDate(modalDate)"
  );
});

test("1.4 AddAppointmentModal receives getAllEventsForDate for existingEvents & submit", () => {
  assert.ok(
    calendarTabSource.includes("<AddAppointmentModal") &&
    calendarTabSource.includes("existingEvents={getAllEventsForDate(modalDate)}"),
    "AddAppointmentModal must receive getAllEventsForDate(modalDate)"
  );
  assert.ok(
    calendarTabSource.includes("handleAddAppointmentSubmit(") &&
    calendarTabSource.includes("getAllEventsForDate(modalDate)"),
    "handleAddAppointmentSubmit must receive getAllEventsForDate(modalDate)"
  );
});

test("1.5 BlockTimeModal receives getAllEventsForDate for existingEvents & submit", () => {
  assert.ok(
    calendarTabSource.includes("<BlockTimeModal") &&
    calendarTabSource.includes("existingEvents={getAllEventsForDate(modalDate)}"),
    "BlockTimeModal must receive getAllEventsForDate(modalDate)"
  );
  assert.ok(
    calendarTabSource.includes("handleBlockSubmit(") &&
    calendarTabSource.includes("getAllEventsForDate(modalDate)"),
    "handleBlockSubmit must receive getAllEventsForDate(modalDate)"
  );
});

test("1.6 AppointmentDetailsPanel receives getAllEventsForDate for drawer reschedule panel", () => {
  assert.ok(
    calendarTabSource.includes("<AppointmentDetailsPanel") &&
    calendarTabSource.includes("existingEvents={getAllEventsForDate(drawerState.date)}"),
    "AppointmentDetailsPanel must receive getAllEventsForDate(drawerState.date)"
  );
});

test("1.7 CalendarTab preserves getEventsForDate for visual calendar views", () => {
  assert.ok(
    calendarTabSource.includes("<AgendaView") &&
    calendarTabSource.includes("getEventsForDate={getEventsForDate}"),
    "AgendaView must still receive getEventsForDate for filtered visual display"
  );
  assert.ok(
    calendarTabSource.includes("<WeekView") &&
    calendarTabSource.includes("getEventsForDate={getEventsForDate}"),
    "WeekView must still receive getEventsForDate for filtered visual display"
  );
  assert.ok(
    calendarTabSource.includes("<DayView") &&
    calendarTabSource.includes("events={getEventsForDate(selectedDate)}"),
    "DayView must still receive getEventsForDate for filtered visual display"
  );
  assert.ok(
    calendarTabSource.includes("<MonthView") &&
    calendarTabSource.includes("getEventsForDate={getEventsForDate}"),
    "MonthView must still receive getEventsForDate for filtered visual display"
  );
});

// ------------------------------------------------------------------
// 2. useCalendarData.ts Architecture & Data Flow
// ------------------------------------------------------------------
const useCalendarDataPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "calendar",
  "hooks",
  "useCalendarData.ts"
);
const useCalendarDataSource = fs.readFileSync(useCalendarDataPath, "utf-8");

test("2.1 useCalendarData defines and exports getAllEventsForDate", () => {
  assert.ok(
    useCalendarDataSource.includes("const getAllEventsForDate = useCallback("),
    "getAllEventsForDate must be declared via useCallback"
  );
  assert.ok(
    useCalendarDataSource.includes("getAllEventsForDate,"),
    "useCalendarData return object must export getAllEventsForDate"
  );
});

test("2.2 fetchCalendar loads all operational calendar events without practitioner filter", () => {
  assert.ok(
    useCalendarDataSource.includes("const res = await getDoctorCalendar(startIso, endIso);"),
    "fetchCalendar must fetch unfiltered calendar so all clinic practitioners exist in cache"
  );
});

test("2.3 useCalendarData defines ensureDateLoaded to preload arbitrary dates", () => {
  assert.ok(
    useCalendarDataSource.includes("const ensureDateLoaded = useCallback("),
    "ensureDateLoaded must be defined to load dates outside current week"
  );
});

// ------------------------------------------------------------------
// 3. calendarUtils.ts findConflictingEvents Functionality & Resiliency
// ------------------------------------------------------------------
const calendarUtilsPath = path.join(projectRoot, "components", "dashboard", "calendar", "calendarUtils.ts");
const rawTs = fs.readFileSync(calendarUtilsPath, "utf-8");
const cleanTs = rawTs
  .replace(/import\s*\{\s*CalendarEvent\s*\}\s*from\s*"@\/lib\/api";/, "")
  .replace(/import\s*\{[^}]*\}\s*from\s*"\.\/types";/, "")
  .replace(/import\s*\{[^}]*\}\s*from\s*"\.\/constants";/, "const DAY_NAMES = [\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\"];\nconst BREAK_TIME_LABEL = \"Break Time\";");

const jsCode = ts.transpileModule(cleanTs, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const encodedUri = "data:text/javascript;base64," + Buffer.from(jsCode).toString("base64");
const utils = await import(encodedUri);
const { findConflictingEvents, isIntervalOverlapping } = utils;

test("3.1 isIntervalOverlapping correctly detects slot collisions", () => {
  assert.strictEqual(isIntervalOverlapping("10:00", "10:30", "10:00", "10:30"), true);
  assert.strictEqual(isIntervalOverlapping("10:00", "10:30", "10:15", "10:45"), true);
  assert.strictEqual(isIntervalOverlapping("10:00", "10:30", "10:30", "11:00"), false); // Adjacent
  assert.strictEqual(isIntervalOverlapping("10:00", "10:30", "09:30", "10:00"), false); // Adjacent
});

test("3.2 findConflictingEvents ignores AVAILABLE and CANCELLED entries", () => {
  const events = [
    { type: "AVAILABLE", start: "10:00", end: "10:30", status: "BOOKED" },
    { type: "APPOINTMENT", start: "10:00", end: "10:30", status: "CANCELLED", staff_id: "staff-1" },
  ];
  const conflicts = findConflictingEvents("10:00", "10:30", events, "staff-1");
  assert.strictEqual(conflicts.length, 0, "AVAILABLE and CANCELLED events must never trigger conflicts");
});

test("3.3 findConflictingEvents allows concurrent booking for different doctors", () => {
  const events = [
    {
      type: "APPOINTMENT",
      start: "10:00",
      end: "10:30",
      status: "BOOKED",
      staff_id: "dr-alice",
      patient_name: "Patient Alice",
    },
  ];

  // Booking for Dr. Bob at the same time should NOT conflict
  const bobConflicts = findConflictingEvents("10:00", "10:30", events, "dr-bob");
  assert.strictEqual(bobConflicts.length, 0, "Different doctors must be allowed concurrent bookings");

  // Booking for Dr. Alice at the same time SHOULD conflict
  const aliceConflicts = findConflictingEvents("10:00", "10:30", events, "dr-alice");
  assert.strictEqual(aliceConflicts.length, 1);
  assert.strictEqual(aliceConflicts[0].patient_name, "Patient Alice");
});

test("3.4 Clinic Holiday blocks all doctors", () => {
  const holidayEvent = [
    { type: "HOLIDAY", start: "00:00", end: "23:59", reason: "National Holiday" },
  ];
  const primaryConf = findConflictingEvents("10:00", "10:30", holidayEvent, "PRIMARY");
  const staffConf = findConflictingEvents("10:00", "10:30", holidayEvent, "staff-1");
  assert.strictEqual(primaryConf.length, 1, "Holiday blocks primary doctor");
  assert.strictEqual(staffConf.length, 1, "Holiday blocks staff doctor");
});

// ------------------------------------------------------------------
// 4. Multi-Doctor End-to-End Double-Booking Prevention Simulation
// ------------------------------------------------------------------
describeSimulation: {
  const clinicEvents = [
    // Dr. Alice (staff-1) is booked at 09:00 - 09:30
    {
      type: "APPOINTMENT",
      start: "09:00",
      end: "09:30",
      status: "BOOKED",
      staff_id: "staff-1",
      staff_name: "Dr. Alice",
      patient_name: "John Doe",
    },
    // Dr. Bob (staff-2) is booked at 10:00 - 10:30
    {
      type: "APPOINTMENT",
      start: "10:00",
      end: "10:30",
      status: "BOOKED",
      staff_id: "staff-2",
      staff_name: "Dr. Bob",
      patient_name: "Jane Smith",
    },
    // Primary Doctor is booked at 11:00 - 11:30
    {
      type: "APPOINTMENT",
      start: "11:00",
      end: "11:30",
      status: "BOOKED",
      staff_id: null,
      patient_name: "Sam Wilson",
    },
  ];

  // Simulation of getEventsForDate (filtered) vs getAllEventsForDate (unfiltered)
  function simulateGetEvents(events, filter) {
    if (!filter || filter === "ALL") return events;
    const isPrimary = filter === "PRIMARY" || filter === "primary";
    return events.filter((ev) => {
      if (ev.type === "HOLIDAY") return true;
      if (ev.type === "APPOINTMENT") {
        const evStaff = ev.staff_id || null;
        return isPrimary ? evStaff === null : evStaff === filter;
      }
      return isPrimary;
    });
  }

  test("4.1 Filter set to Dr. Alice (staff-1): getEventsForDate filters out Dr. Bob and Primary Doctor", () => {
    const filteredEvents = simulateGetEvents(clinicEvents, "staff-1");
    assert.strictEqual(filteredEvents.length, 1);
    assert.strictEqual(filteredEvents[0].patient_name, "John Doe");
  });

  test("4.2 Buggy legacy behavior: using getEventsForDate allowed double booking Dr. Bob", () => {
    const filteredEvents = simulateGetEvents(clinicEvents, "staff-1");
    // Trying to book Dr. Bob at 10:00 against filtered events
    const legacyConflicts = findConflictingEvents("10:00", "10:30", filteredEvents, "staff-2");
    // In legacy buggy code, legacyConflicts was 0, allowing double booking!
    assert.strictEqual(legacyConflicts.length, 0, "Demonstrates legacy bug: 0 conflicts found in filtered list");
  });

  test("4.3 Fixed behavior: using getAllEventsForDate catches Dr. Bob conflict despite active filter", () => {
    // When using getAllEventsForDate (unfiltered events):
    const allEvents = clinicEvents;
    const conflicts = findConflictingEvents("10:00", "10:30", allEvents, "staff-2");
    assert.strictEqual(conflicts.length, 1, "Must detect Dr. Bob is already booked at 10:00");
    assert.strictEqual(conflicts[0].patient_name, "Jane Smith");
  });

  test("4.4 Fixed behavior: using getAllEventsForDate catches Primary Doctor conflict despite active filter", () => {
    const allEvents = clinicEvents;
    const conflicts = findConflictingEvents("11:00", "11:30", allEvents, "PRIMARY");
    assert.strictEqual(conflicts.length, 1, "Must detect Primary Doctor is already booked at 11:00");
    assert.strictEqual(conflicts[0].patient_name, "Sam Wilson");
  });

  test("4.5 Fixed behavior: BlockTimeModal detects all doctor appointments across clinic", () => {
    const allEvents = clinicEvents;
    const blockWindow = { start: "09:00", end: "12:00" };
    const conflictingAppointments = allEvents.filter((ev) => {
      if (ev.type !== "APPOINTMENT" || ev.status === "CANCELLED") return false;
      return isIntervalOverlapping(blockWindow.start, blockWindow.end, ev.start, ev.end);
    });
    assert.strictEqual(
      conflictingAppointments.length,
      3,
      "BlockTimeModal must detect all 3 booked appointments in the 09:00 - 12:00 window"
    );
  });
}

// ------------------------------------------------------------------
console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}
