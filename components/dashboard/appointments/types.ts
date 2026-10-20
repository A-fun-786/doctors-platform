import { AppointmentEntry, AppointmentStatus, AvailableSlot } from "@/lib/api";

export type AppointmentTypeFilter = "ALL" | "in_clinic" | "video_consultation";
export type DatePreset = "ALL" | "TODAY" | "UPCOMING" | "PAST_7_DAYS" | "CUSTOM";
export type SortOption =
  | "date_desc"
  | "date_asc"
  | "time_asc"
  | "patient_asc"
  | "patient_desc"
  | "status";

export interface SummaryCounts {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

export interface AppointmentFiltersState {
  searchQuery: string;
  statusFilter: string;
  datePreset: DatePreset;
  customStartDate: string;
  customEndDate: string;
  typeFilter: AppointmentTypeFilter;
  sortBy: SortOption;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
}

export type { AppointmentEntry, AppointmentStatus, AvailableSlot };
