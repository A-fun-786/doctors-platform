import { AppointmentEntry } from "./types";

/**
 * Deterministic pastel avatar background generator
 */
export function getAvatarGradient(name: string): string {
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

/**
 * Generate 1-2 letter uppercase initials
 */
export function getInitials(name: string): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format ISO date string into readable display format (e.g., "Mon, 12 Oct 2026")
 */
export function formatDisplayDate(dateStr: string): string {
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

/**
 * Format 24-hr time into 12-hr AM/PM format (e.g. "10:30 AM")
 */
export function formatTime(timeStr: string): string {
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

/**
 * Calculate appointment duration in minutes, default 30 min
 */
export function calculateDuration(startTime: string, endTime: string): string {
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

/**
 * Detect whether appointment is video consultation
 */
export function isVideoConsultation(appt: AppointmentEntry): boolean {
  const text = `${appt.reason || ""} ${appt.notes || ""}`.toLowerCase();
  return (
    text.includes("[video]") ||
    text.includes("video consultation") ||
    text.includes("teleconsult") ||
    text.includes("telehealth") ||
    text.includes("online")
  );
}

/**
 * Clean prefix tags from reason string
 */
export function cleanReasonText(reason?: string): string {
  if (!reason) return "General Consultation";
  return (
    reason
      .replace(/\[Video Consultation\]/gi, "")
      .replace(/\[Video\]/gi, "")
      .replace(/\[Online\]/gi, "")
      .trim() || "General Consultation"
  );
}

/**
 * Format appointment ID to clean display badge like #APT-00124
 */
export function formatAppointmentId(id: string): string {
  if (!id) return "#APT-00000";
  if (id.startsWith("#APT-")) return id;
  if (id.startsWith("APT-")) return `#${id}`;
  const hex = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();
  return `#APT-${hex.padStart(5, "0")}`;
}

/**
 * Deterministic patient demographics generator for preview enrichment
 */
export function getPatientDemographics(name: string): { age: number; gender: "M" | "F" } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const age = 22 + (Math.abs(hash) % 45); // 22 to 67
  const femaleNames = ["priya", "neha", "pooja", "anjali", "eleanor", "sarah", "maria", "emily", "rachel", "emma"];
  const isFemale = femaleNames.some((n) => name.toLowerCase().includes(n)) || Math.abs(hash) % 2 === 1;
  return { age, gender: isFemale ? "F" : "M" };
}

/**
 * Mock appointment data matching reference UI for isolated previews
 */
export function getMockAppointments(): AppointmentEntry[] {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  return [
    {
      id: "APT-00124",
      patient_name: "Rahul Sharma",
      patient_contact: "+91 98765 43210",
      date: today,
      start_time: "10:30",
      end_time: "11:00",
      reason: "Fever & Cold",
      notes: "Complaining of persistent high fever and mild cough for 3 days.",
      status: "BOOKED",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "APT-00125",
      patient_name: "Priya Verma",
      patient_contact: "+91 87654 32109",
      date: today,
      start_time: "11:15",
      end_time: "11:45",
      reason: "[Video Consultation] Follow-up",
      notes: "Patient reports mild improvement. Need to review test results.",
      status: "BOOKED",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "APT-00126",
      patient_name: "Amit Kumar",
      patient_contact: "+91 91234 56789",
      date: today,
      start_time: "14:00",
      end_time: "14:30",
      reason: "Back Pain",
      notes: "Lower lumbar pain radiating down right leg. Possible sciatica.",
      status: "BOOKED",
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "APT-00127",
      patient_name: "Neha Singh",
      patient_contact: "+91 99887 76655",
      date: today,
      start_time: "15:30",
      end_time: "16:00",
      reason: "[Video Consultation] General Consultation",
      notes: "Routine checkup and blood pressure management review.",
      status: "BOOKED",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "APT-00128",
      patient_name: "Suresh Patel",
      patient_contact: "+91 87650 12345",
      date: yesterday,
      start_time: "17:00",
      end_time: "17:30",
      reason: "Diabetes Follow-up",
      notes: "HbA1c levels decreased to 6.8%. Continued metformin prescribed.",
      status: "COMPLETED",
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "APT-00129",
      patient_name: "Pooja Mehta",
      patient_contact: "+91 91011 12121",
      date: yesterday,
      start_time: "18:30",
      end_time: "19:00",
      reason: "[Video Consultation] Thyroid Checkup",
      notes: "Patient requested cancellation due to personal scheduling conflict.",
      status: "CANCELLED",
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: "APT-00130",
      patient_name: "Rohit Yadav",
      patient_contact: "+91 94567 89012",
      date: tomorrow,
      start_time: "09:00",
      end_time: "09:30",
      reason: "Skin Rash",
      notes: "Erythematous rash on both forearms after garden work.",
      status: "BOOKED",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "APT-00131",
      patient_name: "Anjali Desai",
      patient_contact: "+91 93456 78901",
      date: tomorrow,
      start_time: "10:30",
      end_time: "11:00",
      reason: "[Video Consultation] Hair Fall",
      notes: "Telogen effluvium suspected after recent viral infection.",
      status: "BOOKED",
      created_at: new Date().toISOString(),
    },
  ];
}
