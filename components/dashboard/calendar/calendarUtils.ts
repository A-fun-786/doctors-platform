import { WeekDayItem, MiniCalDayItem, DayStatusInfo } from "./types";
import { DAY_NAMES } from "./constants";

/**
 * Format 24-hour time "HH:MM" to 12-hour "h:MM AM/PM"
 */
export function format12Hour(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Match a slot start time (e.g. "10:00") to the time row hourly label (e.g. "10:00 AM")
 */
export function getSlotHourKey(time24: string): string {
  if (!time24) return "";
  const [hStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:00 ${ampm}`;
}

/**
 * Compute the Monday of the given date (Monday starts the operational week)
 */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

/**
 * Calculate the 7 days of the selected week (Monday to Sunday)
 */
export function generateWeekDays(selectedDate: string): WeekDayItem[] {
  const curDate = new Date(selectedDate);
  const mon = getMonday(curDate);
  const days: WeekDayItem[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    days.push({
      dateStr: iso,
      dayName: DAY_NAMES[i],
      dayNum: d.getDate(),
      isSelected: iso === selectedDate,
    });
  }
  return days;
}

/**
 * Compute week range title e.g. "Oct 19 – 25, 2026"
 */
export function computeWeekRangeTitle(currentWeekDays: WeekDayItem[]): string {
  if (currentWeekDays.length === 0) return "";
  const start = new Date(currentWeekDays[0].dateStr);
  const end = new Date(currentWeekDays[6].dateStr);

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${startYear}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${endYear}`;
}

/**
 * Determine operational day badge status (Open, Closed, Holiday)
 */
export function getDayStatus(dateStr: string): DayStatusInfo {
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay(); // 0 is Sunday, 3 is Wednesday
  if (dayOfWeek === 0) {
    return { text: "Closed", color: "bg-red-50 text-red-600 border-red-200" };
  }
  if (dayOfWeek === 3) {
    return { text: "Holiday", color: "bg-red-50 text-red-600 border-red-200" };
  }
  return { text: "Clinic Open", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

/**
 * Generate 7xN grid cells for the mini calendar
 */
export function generateMiniCalDays(
  miniCalMonth: Date,
  selectedDate: string
): MiniCalDayItem[] {
  const year = miniCalMonth.getFullYear();
  const month = miniCalMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Days in week: 0(Sun) -> 6(Sat). Monday first (0=Mon, 6=Sun)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const days: MiniCalDayItem[] = [];

  // Prev month trailing days
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const num = prevMonthLastDate - i;
    const prevDate = new Date(year, month - 1, num);
    const iso = prevDate.toISOString().split("T")[0];
    days.push({
      dayNum: num,
      dateStr: iso,
      isCurrentMonth: false,
      isSelected: iso === selectedDate,
    });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const curDate = new Date(year, month, i);
    const iso = curDate.toISOString().split("T")[0];
    days.push({
      dayNum: i,
      dateStr: iso,
      isCurrentMonth: true,
      isSelected: iso === selectedDate,
    });
  }

  // Next month leading days to complete grid
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    const iso = nextDate.toISOString().split("T")[0];
    days.push({
      dayNum: i,
      dateStr: iso,
      isCurrentMonth: false,
      isSelected: iso === selectedDate,
    });
  }

  return days;
}
