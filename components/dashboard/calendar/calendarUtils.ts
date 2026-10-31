import { CalendarEvent } from "@/lib/api";
import { WeekDayItem, MiniCalDayItem, DayStatusInfo } from "./types";
import { DAY_NAMES, BREAK_TIME_LABEL } from "./constants";

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
 * Convert 24-hour time "HH:MM" to minutes from midnight
 */
export function timeToMinutes(time24: string): number {
  if (!time24) return 0;
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

/**
 * Convert minutes from midnight to 24-hour "HH:MM"
 */
export function minutesToTime24(minutes: number): string {
  const clamped = Math.min(23 * 60 + 59, Math.max(0, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Add minutes (default 30) to a 24-hour "HH:MM" string
 */
export function addMinutesToTime(time24: string, mins: number = 30): string {
  return minutesToTime24(timeToMinutes(time24) + mins);
}

/**
 * Match a slot start time (e.g. "10:30") to a 30-minute row label (e.g. "10:30 AM")
 */
export function getSlot30MinKey(time24: string): string {
  if (!time24) return "";
  return format12Hour(time24);
}

/**
 * Given a time row label (e.g. "9:30 AM"), return its 24-hour start and end bounds
 */
export function getTimeRowRange(timeRow: string): { start: string; end: string } {
  const [timePart, ampm] = timeRow.split(" ");
  const [hStr, mStr] = (timePart || "9:00").split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const start = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const end = addMinutesToTime(start, 30);
  return { start, end };
}

/**
 * Check if two time intervals [startA, endA) and [startB, endB) overlap
 */
export function isIntervalOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a1 = timeToMinutes(startA);
  let a2 = timeToMinutes(endA);
  if (a2 <= a1) a2 = 24 * 60; // handles full day or midnight
  const b1 = timeToMinutes(startB);
  let b2 = timeToMinutes(endB);
  if (b2 <= b1) b2 = 24 * 60;
  return a1 < b2 && a2 > b1;
}

/**
 * Check if a calendar event overlaps with a given 30-minute slot window
 */
export function doesEventOverlapSlot(
  event: CalendarEvent,
  slotStart: string,
  slotEnd: string
): boolean {
  return isIntervalOverlapping(event.start, event.end, slotStart, slotEnd);
}

/**
 * Find conflicting booked appointments or doctor leaves that collide with a target window
 */
export function findConflictingEvents(
  start: string,
  end: string,
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.filter((ev) => {
    if (ev.status === "CANCELLED") return false;
    return isIntervalOverlapping(start, end, ev.start, ev.end);
  });
}


/**
 * Safely format a local Date object into a "YYYY-MM-DD" string
 */
export function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Safely parse a "YYYY-MM-DD" string into a Date at local midnight
 */
export function parseYYYYMMDD(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10) - 1;
  const d = parseInt(dayStr, 10);
  return new Date(y, m, d);
}

/**
 * Compute the Monday of the given date (Monday starts the operational week)
 */
export function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

/**
 * Calculate the 7 days of the selected week (Monday to Sunday)
 */
export function generateWeekDays(selectedDate: string): WeekDayItem[] {
  const curDate = parseYYYYMMDD(selectedDate);
  const mon = getMonday(curDate);
  const todayStr = formatDateToYYYYMMDD(new Date());
  const days: WeekDayItem[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const iso = formatDateToYYYYMMDD(d);
    days.push({
      dateStr: iso,
      dayName: DAY_NAMES[i],
      dayNum: d.getDate(),
      isSelected: iso === selectedDate,
      isToday: iso === todayStr,
    });
  }
  return days;
}

/**
 * Compute week range title e.g. "Oct 19 – 25, 2026"
 */
export function computeWeekRangeTitle(currentWeekDays: WeekDayItem[]): string {
  if (currentWeekDays.length === 0) return "";
  const start = parseYYYYMMDD(currentWeekDays[0].dateStr);
  const end = parseYYYYMMDD(currentWeekDays[6].dateStr);

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
  const d = parseYYYYMMDD(dateStr);
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
 * Generate 7xN grid cells for the mini calendar, matching Google Calendar layout & real dates
 */
export function generateMiniCalDays(
  miniCalMonth: Date,
  selectedDate: string,
  eventsGetter?: (dateStr: string) => CalendarEvent[]
): MiniCalDayItem[] {
  const year = miniCalMonth.getFullYear();
  const month = miniCalMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const todayStr = formatDateToYYYYMMDD(new Date());

  const selDate = parseYYYYMMDD(selectedDate);
  const mon = getMonday(selDate);
  const weekStartStr = formatDateToYYYYMMDD(mon);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const weekEndStr = formatDateToYYYYMMDD(sun);

  // Days in week: 0(Sun) -> 6(Sat). Monday first (0=Mon, 6=Sun)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const days: MiniCalDayItem[] = [];

  // Prev month trailing days
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const num = prevMonthLastDate - i;
    const prevDate = new Date(year, month - 1, num);
    const iso = formatDateToYYYYMMDD(prevDate);
    days.push({
      dayNum: num,
      dateStr: iso,
      isCurrentMonth: false,
      isSelected: iso === selectedDate,
      isToday: iso === todayStr,
      isInCurrentWeek: iso >= weekStartStr && iso <= weekEndStr,
      hasEvents: eventsGetter ? (eventsGetter(iso)?.length || 0) > 0 : false,
    });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const curDate = new Date(year, month, i);
    const iso = formatDateToYYYYMMDD(curDate);
    days.push({
      dayNum: i,
      dateStr: iso,
      isCurrentMonth: true,
      isSelected: iso === selectedDate,
      isToday: iso === todayStr,
      isInCurrentWeek: iso >= weekStartStr && iso <= weekEndStr,
      hasEvents: eventsGetter ? (eventsGetter(iso)?.length || 0) > 0 : false,
    });
  }

  // Next month leading days to complete full Google Calendar grid (35 or 42 cells)
  const targetCount = days.length <= 35 ? 35 : 42;
  const remaining = targetCount - days.length;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    const iso = formatDateToYYYYMMDD(nextDate);
    days.push({
      dayNum: i,
      dateStr: iso,
      isCurrentMonth: false,
      isSelected: iso === selectedDate,
      isToday: iso === todayStr,
      isInCurrentWeek: iso >= weekStartStr && iso <= weekEndStr,
      hasEvents: eventsGetter ? (eventsGetter(iso)?.length || 0) > 0 : false,
    });
  }

  return days;
}


export interface WorkingHoursShift {
  id: string;
  label: string;
  start: string; // e.g. "10:00"
  end: string;   // e.g. "13:00"
  enabled: boolean;
}

export interface WorkingHoursBreak {
  enabled: boolean;
  start: string; // e.g. "13:00"
  end: string;   // e.g. "16:00"
  label?: string; // e.g. "Break Time"
}

export interface WorkingHoursConfig {
  shifts: WorkingHoursShift[];
  breakTime?: WorkingHoursBreak;
  closed_days?: number[];
}

export interface BreakIntervalInfo {
  enabled: boolean;
  start: string;
  end: string;
  startLabel: string;
  endLabel: string;
  label: string;
  durationMinutes: number;
}

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  shifts: [
    {
      id: "morning",
      label: "Morning Shift",
      start: "10:00",
      end: "13:00",
      enabled: true,
    },
    {
      id: "evening",
      label: "Evening Shift",
      start: "16:00",
      end: "20:00",
      enabled: true,
    },
  ],
  closed_days: [0],
};

export const WORKING_HOURS_STORAGE_KEY = "doctor_calendar_working_hours";

/**
 * Returns the doctor's break interval based on working hours.
 * Uses explicit breakTime config if enabled, otherwise calculates
 * the gap between active shifts (e.g. morning shift end to evening shift start).
 */
export function getDoctorBreakInterval(
  _config?: WorkingHoursConfig
): BreakIntervalInfo | null {
  // Breaks removed: operating schedule follows start to end windows
  return null;
}

/**
 * Unified formatter for Break Time title string across DayView and WeekView.
 * e.g. "Break Time (1:00 PM – 4:00 PM)"
 */
export function formatBreakTimeTitle(startLabel: string, endLabel: string): string {
  return `${BREAK_TIME_LABEL} (${startLabel} – ${endLabel})`;
}

/**
 * Check if a slot interval [start, end) overlaps with the doctor's break interval.
 */
export function isSlotInBreak(
  _start: string,
  _end: string,
  _config?: WorkingHoursConfig
): boolean {
  return false;
}

/**
 * Calculate total 30-minute slot count for a given time window.
 */
export function calculateShiftSlotCount(start: string, end: string, stepMinutes = 30): number {
  const startM = timeToMinutes(start);
  const endM = timeToMinutes(end);
  if (endM <= startM) return 0;
  return Math.floor((endM - startM) / stepMinutes);
}

/**
 * Retrieve doctor working hours from localStorage or fallback to default.
 */
export function getDoctorWorkingHours(): WorkingHoursConfig {
  if (typeof window === "undefined") return DEFAULT_WORKING_HOURS;
  try {
    const raw = localStorage.getItem(WORKING_HOURS_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKING_HOURS;
    const parsed = JSON.parse(raw) as WorkingHoursConfig;
    if (parsed && Array.isArray(parsed.shifts) && parsed.shifts.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error("Error loading working hours:", err);
  }
  return DEFAULT_WORKING_HOURS;
}

export const getCachedDoctorWorkingHours = getDoctorWorkingHours;

/**
 * Persist doctor customized working hours to localStorage.
 */
export function saveDoctorWorkingHours(config: WorkingHoursConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKING_HOURS_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Error saving working hours:", err);
  }
}

/**
 * Check if a time slot (start, end) falls within doctor's configured working hours.
 * Defaults to closed on Sundays if closed_days not specified, and disallows intervals during the doctor's break time.
 */
export function isSlotWithinWorkingHours(
  dateStr: string,
  slotStart: string,
  slotEnd: string,
  config?: WorkingHoursConfig
): boolean {
  if (!dateStr || !slotStart || !slotEnd) return false;
  const d = new Date(dateStr);
  const activeConfig = config || DEFAULT_WORKING_HOURS;
  const closedDays = activeConfig.closed_days ?? [0];
  if (closedDays.includes(d.getDay())) return false;

  const startM = timeToMinutes(slotStart);
  const endM = timeToMinutes(slotEnd);

  return activeConfig.shifts.some((shift) => {
    if (!shift.enabled) return false;
    const shiftStartM = timeToMinutes(shift.start);
    const shiftEndM = timeToMinutes(shift.end);
    return startM >= shiftStartM && endM <= shiftEndM;
  });
}

export interface PatientVitalsData {
  gender?: string;
  age?: string | number;
  height?: string;
  weight?: string;
  bloodGroup?: string;
  address?: string;
  shortNotes?: string;
}

/**
 * Format patient details (vitals, address, notes) into structured clinical notes string.
 */
export function formatPatientClinicalNotes(data: PatientVitalsData): string {
  const vitals: string[] = [];
  if (data.gender) vitals.push(`Gender: ${data.gender}`);
  if (data.age) vitals.push(`Age: ${data.age}`);
  if (data.bloodGroup) vitals.push(`Blood Group: ${data.bloodGroup}`);
  if (data.height) vitals.push(`Height: ${data.height}`);
  if (data.weight) vitals.push(`Weight: ${data.weight}`);

  const sections: string[] = [];
  if (vitals.length > 0) {
    sections.push(`[Patient Vitals] ${vitals.join(" | ")}`);
  }
  if (data.address?.trim()) {
    sections.push(`[Address] ${data.address.trim()}`);
  }
  if (data.shortNotes?.trim()) {
    sections.push(`[Notes] ${data.shortNotes.trim()}`);
  }

  return sections.join("\n");
}

/**
 * Generate 30-minute time row labels (e.g. "10:00 AM", "10:30 AM") for all active working shifts.
 * Automatically incorporates any slots that contain scheduled events so no appointments are missed.
 */
export function getWorkingHoursTimeRows(
  config?: WorkingHoursConfig,
  additionalEvents?: CalendarEvent[]
): string[] {
  const activeConfig = config || DEFAULT_WORKING_HOURS;
  const timeMinutesSet = new Set<number>();

  // Add 30-minute intervals for all enabled shifts
  activeConfig.shifts.forEach((shift) => {
    if (!shift.enabled) return;
    const startM = timeToMinutes(shift.start);
    const endM = timeToMinutes(shift.end);
    for (let m = startM; m + 30 <= endM; m += 30) {
      timeMinutesSet.add(m);
    }
  });

  // Also include any 30-minute slots containing scheduled events
  if (additionalEvents && Array.isArray(additionalEvents)) {
    additionalEvents.forEach((ev) => {
      if (ev.status === "CANCELLED" || !ev.start) return;
      const evStartM = timeToMinutes(ev.start);
      // Floor to nearest 30-min interval
      const slotM = Math.floor(evStartM / 30) * 30;
      timeMinutesSet.add(slotM);
    });
  }

  // Sort chronologically and convert to 12-hour labels
  const sortedMinutes = Array.from(timeMinutesSet).sort((a, b) => a - b);
  return sortedMinutes.map((m) => format12Hour(minutesToTime24(m)));
}

export interface ShiftSlotGroup {
  id: string;
  label: string;
  start: string;
  end: string;
  enabled: boolean;
  timeRows: string[];
}

export interface GroupedWorkingHoursSlots {
  groups: ShiftSlotGroup[];
  extraTimeRows: string[];
}

/**
 * Group 30-minute time rows strictly by doctor working shifts (Schedules),
 * while capturing any off-hours slots that contain active scheduled events.
 */
export function getGroupedWorkingHoursSlots(
  config?: WorkingHoursConfig,
  additionalEvents?: CalendarEvent[]
): GroupedWorkingHoursSlots {
  const activeConfig = config || DEFAULT_WORKING_HOURS;
  const groups: ShiftSlotGroup[] = [];
  const coveredMinutes = new Set<number>();

  activeConfig.shifts.forEach((shift, index) => {
    if (!shift.enabled) return;
    const startM = timeToMinutes(shift.start);
    const endM = timeToMinutes(shift.end);
    const timeRows: string[] = [];

    for (let m = startM; m + 30 <= endM; m += 30) {
      timeRows.push(format12Hour(minutesToTime24(m)));
      coveredMinutes.add(m);
    }

    groups.push({
      id: shift.id || `shift_${index + 1}`,
      label: shift.label || `Schedule ${index + 1}`,
      start: shift.start,
      end: shift.end,
      enabled: shift.enabled,
      timeRows,
    });
  });

  // Check if any scheduled events fall outside configured shifts
  const extraMinutesSet = new Set<number>();
  if (additionalEvents && Array.isArray(additionalEvents)) {
    additionalEvents.forEach((ev) => {
      if (ev.status === "CANCELLED" || !ev.start) return;
      const evStartM = timeToMinutes(ev.start);
      const slotM = Math.floor(evStartM / 30) * 30;
      if (!coveredMinutes.has(slotM)) {
        extraMinutesSet.add(slotM);
      }
    });
  }

  const extraTimeRows = Array.from(extraMinutesSet)
    .sort((a, b) => a - b)
    .map((m) => format12Hour(minutesToTime24(m)));

  return { groups, extraTimeRows };
}

export interface ShiftThemeStyle {
  name: string;
  badgeLabel: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  indicator: string;
  timeBg: string;
  timeText: string;
  bookedBorder: string;
  emptyCard: string;
  emptySlot: string;
  emptyTimeText: string;
  plusBtn: string;
  plusIcon: string;
  apptBorder: string;
}

export const SHIFT_THEME_PALETTES: ShiftThemeStyle[] = [
  // Shift 1: Warm Amber
  {
    name: 'Shift 1',
    badgeLabel: 'Schedule 1',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-900',
    pillBorder: 'border-amber-300',
    indicator: 'bg-amber-500',
    timeBg: 'bg-amber-50/50',
    timeText: 'text-amber-950 font-bold',
    bookedBorder: 'border-2 border-amber-400 bg-amber-50/20 hover:border-amber-500',
    emptyCard: 'border-2 border-dashed border-amber-300 bg-amber-50/15 hover:bg-amber-50/40 hover:border-amber-400',
    emptySlot: 'border-2 border-dashed border-amber-300 bg-amber-50/15 hover:bg-amber-50/40 hover:border-amber-400 text-amber-700',
    emptyTimeText: 'text-slate-700 group-hover:text-amber-950',
    plusBtn: 'border-amber-300 text-amber-600 group-hover:border-amber-500 group-hover:text-amber-700',
    plusIcon: 'text-amber-600 group-hover/slot:text-amber-700',
    apptBorder: 'border-l-[4px] border-l-amber-500 border-amber-300 bg-amber-50/40 hover:border-amber-400',
  },
  // Shift 2: Sky Blue
  {
    name: 'Shift 2',
    badgeLabel: 'Schedule 2',
    pillBg: 'bg-sky-50',
    pillText: 'text-sky-900',
    pillBorder: 'border-sky-300',
    indicator: 'bg-sky-500',
    timeBg: 'bg-sky-50/50',
    timeText: 'text-sky-950 font-bold',
    bookedBorder: 'border-2 border-sky-400 bg-sky-50/20 hover:border-sky-500',
    emptyCard: 'border-2 border-dashed border-sky-300 bg-sky-50/15 hover:bg-sky-50/40 hover:border-sky-400',
    emptySlot: 'border-2 border-dashed border-sky-300 bg-sky-50/15 hover:bg-sky-50/40 hover:border-sky-400 text-sky-700',
    emptyTimeText: 'text-slate-700 group-hover:text-sky-950',
    plusBtn: 'border-sky-300 text-sky-600 group-hover:border-sky-500 group-hover:text-sky-700',
    plusIcon: 'text-sky-600 group-hover/slot:text-sky-700',
    apptBorder: 'border-l-[4px] border-l-sky-500 border-sky-300 bg-sky-50/40 hover:border-sky-400',
  },
  // Shift 3: Emerald Green
  {
    name: 'Shift 3',
    badgeLabel: 'Schedule 3',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-900',
    pillBorder: 'border-emerald-300',
    indicator: 'bg-emerald-500',
    timeBg: 'bg-emerald-50/50',
    timeText: 'text-emerald-950 font-bold',
    bookedBorder: 'border-2 border-emerald-400 bg-emerald-50/20 hover:border-emerald-500',
    emptyCard: 'border-2 border-dashed border-emerald-300 bg-emerald-50/15 hover:bg-emerald-50/40 hover:border-emerald-400',
    emptySlot: 'border-2 border-dashed border-emerald-300 bg-emerald-50/15 hover:bg-emerald-50/40 hover:border-emerald-400 text-emerald-700',
    emptyTimeText: 'text-slate-700 group-hover:text-emerald-950',
    plusBtn: 'border-emerald-300 text-emerald-600 group-hover:border-emerald-500 group-hover:text-emerald-700',
    plusIcon: 'text-emerald-600 group-hover/slot:text-emerald-700',
    apptBorder: 'border-l-[4px] border-l-emerald-500 border-emerald-300 bg-emerald-50/40 hover:border-emerald-400',
  },
  // Shift 4: Royal Violet
  {
    name: 'Shift 4',
    badgeLabel: 'Schedule 4',
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-900',
    pillBorder: 'border-purple-300',
    indicator: 'bg-purple-500',
    timeBg: 'bg-purple-50/50',
    timeText: 'text-purple-950 font-bold',
    bookedBorder: 'border-2 border-purple-400 bg-purple-50/20 hover:border-purple-500',
    emptyCard: 'border-2 border-dashed border-purple-300 bg-purple-50/15 hover:bg-purple-50/40 hover:border-purple-400',
    emptySlot: 'border-2 border-dashed border-purple-300 bg-purple-50/15 hover:bg-purple-50/40 hover:border-purple-400 text-purple-700',
    emptyTimeText: 'text-slate-700 group-hover:text-purple-950',
    plusBtn: 'border-purple-300 text-purple-600 group-hover:border-purple-500 group-hover:text-purple-700',
    plusIcon: 'text-purple-600 group-hover/slot:text-purple-700',
    apptBorder: 'border-l-[4px] border-l-purple-500 border-purple-300 bg-purple-50/40 hover:border-purple-400',
  },
];

/**
 * Dynamically resolves slot border & styling based on the specific shift schedule window it belongs to.
 */
export function getSlotShiftTheme(time24: string, config?: WorkingHoursConfig): ShiftThemeStyle {
  const activeConfig = config || DEFAULT_WORKING_HOURS;
  const slotM = timeToMinutes(time24);
  const enabledShifts = activeConfig.shifts.filter((s) => s.enabled);
  const matchedIndex = enabledShifts.findIndex((shift) => {
    const startM = timeToMinutes(shift.start);
    const endM = timeToMinutes(shift.end);
    return slotM >= startM && slotM < endM;
  });

  if (matchedIndex !== -1) {
    const palette = SHIFT_THEME_PALETTES[matchedIndex % SHIFT_THEME_PALETTES.length];
    return {
      ...palette,
      name: enabledShifts[matchedIndex].label || palette.name,
      badgeLabel: enabledShifts[matchedIndex].label || palette.badgeLabel,
    };
  }

  return SHIFT_THEME_PALETTES[0];
}
