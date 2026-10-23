import { CalendarEvent } from "@/lib/api";

export const SLOT_DURATION_MINUTES = 30;

export const TIME_ROWS = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
] as const;

export interface TimeOption30M {
  value: string; // "HH:MM" 24h
  label: string; // "h:MM AM/PM"
}

// Generate 30-minute time intervals across operating day (08:00 to 22:00)
export const TIME_OPTIONS_30M: TimeOption30M[] = (() => {
  const options: TimeOption30M[] = [];
  for (let hour = 8; hour <= 21; hour++) {
    for (const min of [0, 30]) {
      const hStr = hour.toString().padStart(2, "0");
      const mStr = min.toString().padStart(2, "0");
      const val = `${hStr}:${mStr}`;
      const ampm = hour >= 12 ? "PM" : "AM";
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      const label = `${displayHour}:${mStr} ${ampm}`;
      options.push({ value: val, label });
    }
  }
  options.push({ value: "22:00", label: "10:00 PM" });
  return options;
})();

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEMO_WEEK_EVENTS: Record<string, CalendarEvent[]> = {
  "2026-10-19": [
    { type: "APPOINTMENT", start: "10:00", end: "10:30", patient_name: "Neha Verma", reason: "General Consultation", status: "BOOKED" },
    { type: "APPOINTMENT", start: "11:00", end: "11:30", patient_name: "Pooja Singh", reason: "Blood Pressure Checkup", status: "BOOKED" },
    { type: "APPOINTMENT", start: "16:00", end: "16:30", patient_name: "Suresh Yadav", reason: "Diabetes Follow-up", status: "BOOKED" },
    { type: "APPOINTMENT", start: "18:00", end: "18:30", patient_name: "Kavita Joshi", reason: "Routine Health Check", status: "BOOKED" },
  ],
  "2026-10-20": [
    { type: "APPOINTMENT", start: "12:00", end: "12:30", patient_name: "Vikram Patel", reason: "Cardio Consultation", status: "BOOKED" },
    { type: "APPOINTMENT", start: "17:00", end: "17:30", patient_name: "Alok Gupta", reason: "Fever and Cough", status: "BOOKED" },
  ],
  "2026-10-21": [
    { type: "APPOINTMENT", start: "10:00", end: "10:30", patient_name: "Amit Kumar", reason: "Stomach Ache Evaluation", status: "BOOKED" },
    { type: "APPOINTMENT", start: "16:00", end: "16:30", patient_name: "Riya Sharma", reason: "Pediatric Consultation", status: "BOOKED" },
    { type: "APPOINTMENT", start: "18:00", end: "18:30", patient_name: "Deepak Verma", reason: "Post-op Followup", status: "BOOKED" },
  ],
  "2026-10-22": [
    { type: "APPOINTMENT", start: "11:00", end: "11:30", patient_name: "Rohan Das", reason: "Allergy Discussion", status: "BOOKED" },
    { type: "APPOINTMENT", start: "17:00", end: "17:30", patient_name: "Meena Rani", reason: "Joint Pain Consultation", status: "BOOKED" },
  ],
  "2026-10-23": [
    { type: "BLOCKED", start: "10:00", end: "10:30", reason: "Personal Follow-up" },
    { type: "APPOINTMENT", start: "12:00", end: "12:30", patient_name: "Anjali Mehta", reason: "Thyroid Profile Review", status: "BOOKED" },
    { type: "LEAVE", start: "14:00", end: "16:00", reason: "Hospital Medical Conference" },
    { type: "APPOINTMENT", start: "16:00", end: "16:30", patient_name: "Karan Bansal", reason: "Skin Rash Consultation", status: "BOOKED" },
    { type: "APPOINTMENT", start: "18:00", end: "18:30", patient_name: "Priya Nair", reason: "Migraine Follow-up", status: "BOOKED" },
  ],
  "2026-10-24": [
    { type: "APPOINTMENT", start: "11:00", end: "11:30", patient_name: "Sneha Kapoor", reason: "Routine Health Check", status: "BOOKED" },
  ],
  "2026-10-25": [],
};
