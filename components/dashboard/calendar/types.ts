import { DoctorMeResponse, CalendarEvent } from "@/lib/api";
import { DashboardTabId } from "../DashboardShell";

export type CalendarViewMode = "day" | "week" | "month";

export type BlockType = "LEAVE" | "HOLIDAY" | "BLOCKED";

export interface CalendarTabProps {
  doctor: DoctorMeResponse;
  onNavigateTab?: (tab: DashboardTabId) => void;
}

export interface WeekDayItem {
  dateStr: string;
  dayName: string;
  dayNum: number;
  isSelected: boolean;
}

export interface MiniCalDayItem {
  dayNum: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
}

export interface SelectedEventState {
  event: CalendarEvent;
  date: string;
}

export interface DayStatusInfo {
  text: string;
  color: string;
}

export type CalendarDrawerMode = "view" | "edit";

export type CalendarDrawerType = "appointment" | "leave" | "blocked";

export interface CalendarDrawerState {
  isOpen: boolean;
  type: CalendarDrawerType | null;
  mode: CalendarDrawerMode;
  event: CalendarEvent | null;
  date: string;
  leaveId?: string;
}
