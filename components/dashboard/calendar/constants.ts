export const SLOT_DURATION_MINUTES = 30;

export const BREAK_TIME_LABEL = "Break Time" as const;
export const BREAK_TIME_BADGE = "BREAK TIME" as const;
export const BREAK_TIME_SUBTITLE = "• Clinic break interval (no patient booking)" as const;

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
export const MINI_CAL_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
