import React from "react";
import {
  Search,
  X,
  Calendar,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import {
  AppointmentTypeFilter,
  DatePreset,
  SortOption,
} from "./types";

interface AppointmentFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customStartDate: string;
  onCustomStartDateChange: (d: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (d: string) => void;
  typeFilter: AppointmentTypeFilter;
  onTypeFilterChange: (type: AppointmentTypeFilter) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export default function AppointmentFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  datePreset,
  onDatePresetChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortChange,
  onResetFilters,
  hasActiveFilters,
}: AppointmentFiltersProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-4.5 shadow-xs space-y-3">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* 1. Search Bar */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by patient name or appointment ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Controls Row: Date Range, Status, Type, Sort */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:border-slate-300 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={datePreset}
                onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
                aria-label="Filter appointments by date preset"
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today Only</option>
                <option value="UPCOMING">Upcoming Dates</option>
                <option value="PAST_7_DAYS">Past 7 Days</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:border-slate-300 transition-colors">
              <select
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                aria-label="Filter appointments by status"
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
              >
                <option value="ALL">All Status</option>
                <option value="BOOKED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Type Dropdown */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:border-slate-300 transition-colors">
              <select
                value={typeFilter}
                onChange={(e) => onTypeFilterChange(e.target.value as AppointmentTypeFilter)}
                aria-label="Filter appointments by consultation type"
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
              >
                <option value="ALL">All Types</option>
                <option value="in_clinic">In-Person</option>
                <option value="video_consultation">Online</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:border-slate-300 transition-colors">
              <span className="text-slate-400 font-normal">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                aria-label="Sort appointments"
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
              >
                <option value="date_desc">Date &amp; Time (Newest)</option>
                <option value="date_asc">Date &amp; Time (Oldest)</option>
                <option value="time_asc">Time (Earliest)</option>
                <option value="patient_asc">Patient Name (A-Z)</option>
                <option value="patient_desc">Patient Name (Z-A)</option>
                <option value="status">Status</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Reset Filters Shortcut */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
              title="Reset all active search and filter options"
              aria-label="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Pickers (only shown if datePreset is CUSTOM) */}
      {datePreset === "CUSTOM" && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
          <span className="text-xs text-slate-500 font-medium">Custom Range:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomStartDateChange(e.target.value)}
            aria-label="Custom start date"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomEndDateChange(e.target.value)}
            aria-label="Custom end date"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      )}
    </div>
  );
}
