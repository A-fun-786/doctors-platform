"use client";

import React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { CalendarViewMode } from "../types";

interface CalendarHeaderProps {
  weekRangeTitle: string;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onAddAvailability: () => void;
}

export default function CalendarHeader({
  weekRangeTitle,
  viewMode,
  onViewModeChange,
  onPrevWeek,
  onNextWeek,
  onAddAvailability,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Navigation & Date Display */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevWeek}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            title="Previous Week"
            aria-label="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            title="Next Week"
            aria-label="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {weekRangeTitle}
          </h2>
          <CalendarIcon className="w-4 h-4 text-slate-500" aria-hidden="true" />
        </div>
      </div>

      {/* View Switcher & Add Availability Button */}
      <div className="flex items-center gap-3">
        {/* Day / Week / Month Pill */}
        <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs" role="group" aria-label="Calendar view switcher">
          <button
            type="button"
            onClick={() => onViewModeChange("day")}
            aria-pressed={viewMode === "day"}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "day"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("week")}
            aria-pressed={viewMode === "week"}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "week"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("month")}
            aria-pressed={viewMode === "month"}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "month"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
          >
            Month
          </button>
        </div>

        {/* Primary Action: + Add Availability */}
        <button
          type="button"
          onClick={onAddAvailability}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Availability</span>
        </button>
      </div>
    </div>
  );
}
