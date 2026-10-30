"use client";

import React from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { WeekDayItem } from "../types";
import { CalendarEvent } from "@/lib/api";

interface MobileHorizonDayStripProps {
  currentWeekDays: WeekDayItem[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onOpenFullMonth: () => void;
}

export default function MobileHorizonDayStrip({
  currentWeekDays,
  selectedDate,
  onSelectDate,
  getEventsForDate,
  onOpenFullMonth,
}: MobileHorizonDayStripProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs space-y-2 select-none">
      {/* Top micro bar: Date indicator & Expand to Full Month */}
      <div className="flex items-center justify-between px-1.5 pt-0.5">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Quick Week Jump
        </span>
        <button
          type="button"
          onClick={onOpenFullMonth}
          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 active:bg-blue-50 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
          title="Open Full Month Calendar"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Full Month</span>
          <ChevronDown className="w-3 h-3 text-blue-500" />
        </button>
      </div>

      {/* 7-Day Horizon Strip */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
        {currentWeekDays.map((day) => {
          const isSelected = day.dateStr === selectedDate;
          const isToday = !!day.isToday;
          const events = getEventsForDate(day.dateStr);
          const hasAppointments = events.some((e) => e.type === "APPOINTMENT");
          const hasLeave = events.some((e) => e.type === "LEAVE" || e.type === "BLOCKED");

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => onSelectDate(day.dateStr)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer relative min-h-[54px] ${
                isSelected
                  ? "bg-blue-600 text-white shadow-xs font-bold scale-[1.03]"
                  : isToday
                  ? "border border-blue-400 bg-blue-50/60 text-blue-900 font-semibold hover:bg-blue-100/50"
                  : "hover:bg-slate-100 text-slate-700 font-medium"
              }`}
              title={`${day.dayName}, ${day.dateStr}`}
            >
              {/* Short day label (M, T, W, T, F, S, S) */}
              <span
                className={`text-[10px] uppercase font-semibold leading-none mb-1 ${
                  isSelected
                    ? "text-blue-100"
                    : isToday
                    ? "text-blue-600"
                    : "text-slate-400"
                }`}
              >
                {day.dayName.slice(0, 3)}
              </span>

              {/* Day Number */}
              <span className="text-sm leading-none font-bold">
                {day.dayNum}
              </span>

              {/* Activity indicator dot */}
              <div className="flex items-center justify-center gap-0.5 mt-1 h-1.5">
                {hasAppointments && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-blue-600"
                    }`}
                  />
                )}
                {hasLeave && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-red-200" : "bg-red-500"
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

