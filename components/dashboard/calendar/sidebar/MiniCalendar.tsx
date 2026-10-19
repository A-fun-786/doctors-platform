"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MiniCalDayItem } from "../types";
import { DAY_NAMES } from "../constants";

interface MiniCalendarProps {
  miniCalMonth: Date;
  setMiniCalMonth: React.Dispatch<React.SetStateAction<Date>>;
  miniCalDays: MiniCalDayItem[];
  onSelectDate: (dateStr: string) => void;
}

export default function MiniCalendar({
  miniCalMonth,
  setMiniCalMonth,
  miniCalDays,
  onSelectDate,
}: MiniCalendarProps) {
  const handlePrevMonth = () => {
    const prev = new Date(miniCalMonth);
    prev.setMonth(prev.getMonth() - 1);
    setMiniCalMonth(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(miniCalMonth);
    next.setMonth(next.getMonth() + 1);
    setMiniCalMonth(next);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
      {/* Header: Month Year + Arrows */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-bold text-slate-900">
          {miniCalMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DAY_NAMES.map((d) => (
          <span key={d} className="text-[11px] font-medium text-slate-400 py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Calendar Days Matrix */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {miniCalDays.map((item, idx) => (
          <div key={item.dateStr || `day-${idx}`} className="flex items-center justify-center p-0.5">
            <button
              type="button"
              onClick={() => onSelectDate(item.dateStr)}
              className={`w-7 h-7 rounded-full text-xs transition-all flex items-center justify-center font-medium ${
                item.isSelected
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : item.isCurrentMonth
                  ? "text-slate-700 hover:bg-slate-100"
                  : "text-slate-300 hover:bg-slate-50"
              }`}
            >
              {item.dayNum}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
