"use client";

import React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CalendarViewMode } from "../types";

interface CalendarHeaderProps {
  weekRangeTitle: string;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export default function CalendarHeader({
  weekRangeTitle,
  viewMode,
  onViewModeChange,
  onPrevWeek,
  onNextWeek,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      {/* Navigation & Date Display */}
      <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onPrevWeek}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Previous Week"
            aria-label="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Next Week"
            aria-label="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight truncate">
            {weekRangeTitle}
          </h2>
          <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0 hidden xs:inline" aria-hidden="true" />
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center w-full sm:w-auto">
        {/* Day / Week / Month Pill */}
        <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs w-full sm:w-auto justify-around sm:justify-start" role="group" aria-label="Calendar view switcher">
          <button
            type="button"
            onClick={() => onViewModeChange("day")}
            aria-pressed={viewMode === "day"}
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
              viewMode === "day"
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
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
              viewMode === "week"
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
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
              viewMode === "month"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Month
          </button>
        </div>
      </div>
    </div>
  );
}
