"use client";

import React from "react";
import { CalendarEvent } from "@/lib/api";
import { MiniCalDayItem } from "../types";
import { DAY_NAMES } from "../constants";

interface MonthViewProps {
  miniCalDays: MiniCalDayItem[];
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onSelectDate: (dateStr: string) => void;
}

export default function MonthView({
  miniCalDays,
  getEventsForDate,
  onSelectDate,
}: MonthViewProps) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-7 gap-2">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center font-bold text-xs text-slate-500 py-2">
            {d}
          </div>
        ))}
        {miniCalDays.map((cell, idx) => {
          const evs = getEventsForDate(cell.dateStr);
          const appts = evs.filter((e) => e.type === "APPOINTMENT").length;
          const leaves = evs.filter(
            (e) => e.type === "LEAVE" || e.type === "HOLIDAY" || e.type === "BLOCKED"
          ).length;

          return (
            <div
              key={idx}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[85px] p-2 border rounded-xl cursor-pointer hover:border-blue-400 transition-all ${
                cell.isSelected
                  ? "bg-blue-50/60 border-blue-500 shadow-2xs"
                  : cell.isToday
                  ? "border-blue-300 bg-blue-50/20"
                  : cell.isCurrentMonth
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50/50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-bold ${
                    cell.isToday
                      ? "w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs"
                      : cell.isCurrentMonth
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {cell.dayNum}
                </span>
              </div>
              <div className="space-y-1">
                {leaves > 0 && (
                  <div className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-medium truncate">
                    {leaves} Leave/Block
                  </div>
                )}
                {appts > 0 && (
                  <div className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium truncate">
                    {appts} Booked (30m)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
