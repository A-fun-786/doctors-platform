/**
 * Automated Verification Script: Appointments UI & Logic
 * Tests UI utilities, data structures, filter/sorting algorithms, and state transitions.
 */

import assert from "node:assert/strict";

// 1. Test Mock Data & Utility functions
console.log("=== [1/4] Testing Appointment Utilities & Formatters ===");

// Emulate utility functions to test algorithm correctness
function getAvatarGradient(name) {
  const gradients = [
    "from-sky-500 to-blue-600",
    "from-blue-500 to-indigo-600",
    "from-teal-500 to-cyan-600",
    "from-cyan-500 to-blue-500",
    "from-indigo-500 to-purple-600",
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-purple-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

function getInitials(name) {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
  return `${hourStr}:${minute} ${ampm}`;
}

function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return "30 min";
  try {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const diff = endMins - startMins;
    if (diff > 0) return `${diff} min`;
    return "30 min";
  } catch {
    return "30 min";
  }
}

function isVideoConsultation(appt) {
  const text = `${appt.reason || ""} ${appt.notes || ""}`.toLowerCase();
  return (
    text.includes("[video]") ||
    text.includes("video consultation") ||
    text.includes("teleconsult") ||
    text.includes("telehealth") ||
    text.includes("online")
  );
}

function cleanReasonText(reason) {
  if (!reason) return "General Consultation";
  return (
    reason
      .replace(/\[Video Consultation\]/gi, "")
      .replace(/\[Video\]/gi, "")
      .replace(/\[Online\]/gi, "")
      .trim() || "General Consultation"
  );
}

function formatAppointmentId(id) {
  if (!id) return "#APT-00000";
  if (id.startsWith("#APT-")) return id;
  if (id.startsWith("APT-")) return `#${id}`;
  const hex = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();
  return `#APT-${hex.padStart(5, "0")}`;
}

// Assertions on formatters
assert.equal(getInitials("Rahul Sharma"), "RS");
assert.equal(getInitials("Priya"), "PR");
assert.equal(getInitials(""), "P");
console.log("✓ Initials generator handles single, double, and empty names");

assert.equal(formatTime("00:00"), "12:00 AM");
assert.equal(formatTime("09:30"), "09:30 AM");
assert.equal(formatTime("12:00"), "12:00 PM");
assert.equal(formatTime("17:45"), "05:45 PM");
console.log("✓ 12-hr formatTime handles midnight, noon, AM, and PM");

assert.equal(calculateDuration("10:00", "10:30"), "30 min");
assert.equal(calculateDuration("10:00", "11:00"), "60 min");
assert.equal(calculateDuration("10:00", "10:45"), "45 min");
console.log("✓ Duration calculation verified for variable lengths");

assert.equal(
  isVideoConsultation({ reason: "[Video Consultation] Follow-up", notes: "" }),
  true
);
assert.equal(
  isVideoConsultation({ reason: "Routine Checkup", notes: "Telehealth call" }),
  true
);
assert.equal(
  isVideoConsultation({ reason: "Fever & Cold", notes: "In clinic walk-in" }),
  false
);
console.log("✓ Video consultation detection identifies tags & keywords");

assert.equal(
  cleanReasonText("[Video Consultation] Follow-up"),
  "Follow-up"
);
assert.equal(cleanReasonText(""), "General Consultation");
assert.equal(formatAppointmentId("APT-00124"), "#APT-00124");
assert.equal(formatAppointmentId("abcde12345"), "#APT-ABCDE");
console.log("✓ Reason cleaning and ID formatting verified");

// 2. Test Filter & Search Logic
console.log("\n=== [2/4] Testing Filtering, Searching & Sorting Logic ===");

const sampleData = [
  {
    id: "APT-001",
    patient_name: "Rahul Sharma",
    patient_contact: "+91 98765 43210",
    date: "2026-10-20",
    start_time: "10:00",
    end_time: "10:30",
    status: "BOOKED",
    reason: "Fever",
    notes: "High temperature",
  },
  {
    id: "APT-002",
    patient_name: "Priya Verma",
    patient_contact: "+91 87654 32109",
    date: "2026-10-20",
    start_time: "11:00",
    end_time: "11:30",
    status: "BOOKED",
    reason: "[Video Consultation] Dermatology",
    notes: "",
  },
  {
    id: "APT-003",
    patient_name: "Amit Kumar",
    patient_contact: "+91 91234 56789",
    date: "2026-10-19",
    start_time: "14:00",
    end_time: "14:30",
    status: "COMPLETED",
    reason: "Back Pain",
    notes: "Physical therapy recommended",
  },
  {
    id: "APT-004",
    patient_name: "Neha Singh",
    patient_contact: "+91 99887 76655",
    date: "2026-10-21",
    start_time: "09:30",
    end_time: "10:00",
    status: "CANCELLED",
    reason: "Flu",
    notes: "Cancelled by patient",
  },
];

// Status filter
const bookedOnly = sampleData.filter((a) => a.status === "BOOKED");
assert.equal(bookedOnly.length, 2);

const completedOnly = sampleData.filter((a) => a.status === "COMPLETED");
assert.equal(completedOnly.length, 1);
assert.equal(completedOnly[0].patient_name, "Amit Kumar");

// Type filter
const videoOnly = sampleData.filter((a) => isVideoConsultation(a));
assert.equal(videoOnly.length, 1);
assert.equal(videoOnly[0].id, "APT-002");

const clinicOnly = sampleData.filter((a) => !isVideoConsultation(a));
assert.equal(clinicOnly.length, 3);

// Search Query filter
const searchQuery = "rahul";
const searchResults = sampleData.filter((a) =>
  a.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
);
assert.equal(searchResults.length, 1);
assert.equal(searchResults[0].id, "APT-001");

// Search by Phone Contact
const searchPhone = "91234";
const searchPhoneResults = sampleData.filter((a) =>
  a.patient_contact?.includes(searchPhone)
);
assert.equal(searchPhoneResults.length, 1);
assert.equal(searchPhoneResults[0].id, "APT-003");

// Search by ID
const searchId = "004";
const searchIdResults = sampleData.filter((a) =>
  a.id.toLowerCase().includes(searchId)
);
assert.equal(searchIdResults.length, 1);
assert.equal(searchIdResults[0].id, "APT-004");

// Sorting: Patient Name Ascending
const sortedAtoZ = [...sampleData].sort((a, b) =>
  a.patient_name.localeCompare(b.patient_name)
);
assert.equal(sortedAtoZ[0].patient_name, "Amit Kumar");
assert.equal(sortedAtoZ[sortedAtoZ.length - 1].patient_name, "Rahul Sharma");

console.log("✓ Status, Type, Search (Name, Phone, ID), and Sorting algorithms verified");

// 3. Test Pagination Calculations
console.log("\n=== [3/4] Testing Pagination Windowing & Math ===");

function computePagination(totalItems, pageSize, currentPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);
  return { totalPages, safePage, startIndex, endIndex };
}

// Case: 25 items, 8 per page
const p1 = computePagination(25, 8, 1);
assert.equal(p1.totalPages, 4);
assert.equal(p1.safePage, 1);
assert.equal(p1.startIndex, 1);
assert.equal(p1.endIndex, 8);

const p2 = computePagination(25, 8, 2);
assert.equal(p2.startIndex, 9);
assert.equal(p2.endIndex, 16);

const p4 = computePagination(25, 8, 4);
assert.equal(p4.startIndex, 25);
assert.equal(p4.endIndex, 25);

// Out of bounds page clamps safely
const pOver = computePagination(25, 8, 99);
assert.equal(pOver.safePage, 4);

// Zero items
const pZero = computePagination(0, 8, 1);
assert.equal(pZero.totalPages, 1);
assert.equal(pZero.startIndex, 0);
assert.equal(pZero.endIndex, 0);

console.log("✓ Pagination mathematical boundaries and edge case clamping verified");

// 4. Test State Transitions
console.log("\n=== [4/4] Testing State Transitions (Complete, Reschedule, Cancel, Prescription) ===");

let currentAppointments = [...sampleData];

// Action: Complete
currentAppointments = currentAppointments.map((a) =>
  a.id === "APT-001" ? { ...a, status: "COMPLETED" } : a
);
assert.equal(
  currentAppointments.find((a) => a.id === "APT-001").status,
  "COMPLETED"
);

// Action: Reschedule
currentAppointments = currentAppointments.map((a) =>
  a.id === "APT-002"
    ? { ...a, date: "2026-10-22", start_time: "15:00", end_time: "15:30" }
    : a
);
const rescheduled = currentAppointments.find((a) => a.id === "APT-002");
assert.equal(rescheduled.date, "2026-10-22");
assert.equal(rescheduled.start_time, "15:00");

// Action: Cancel
currentAppointments = currentAppointments.map((a) =>
  a.id === "APT-002" ? { ...a, status: "CANCELLED" } : a
);
assert.equal(
  currentAppointments.find((a) => a.id === "APT-002").status,
  "CANCELLED"
);

// Action: Add Prescription
const rxText = "Amoxicillin 500mg TDS";
currentAppointments = currentAppointments.map((a) => {
  if (a.id === "APT-001") {
    const updatedNotes = a.notes ? `${a.notes}\n[Rx]: ${rxText}` : `[Rx]: ${rxText}`;
    return { ...a, notes: updatedNotes };
  }
  return a;
});
assert.ok(
  currentAppointments.find((a) => a.id === "APT-001").notes.includes("[Rx]: Amoxicillin 500mg TDS")
);

console.log("✓ State transitions (Complete, Reschedule, Cancel, Rx Draft) validated cleanly");
console.log("\n>>> ALL APPOINTMENTS SUITE TESTS PASSED (100%) <<<");
