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
          const avails = evs.filter((e) => e.type === "AVAILABLE").length;

          return (
            <div
              key={idx}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[85px] p-2 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 transition-all ${
                cell.isSelected
                  ? "bg-blue-50/60 border-blue-500"
                  : cell.isCurrentMonth
                  ? "bg-white"
                  : "bg-slate-50/50 opacity-60"
              }`}
            >
              <div className="text-xs font-bold text-slate-800 mb-1">{cell.dayNum}</div>
              <div className="space-y-1">
                {appts > 0 && (
                  <div className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium truncate">
                    {appts} Booked
                  </div>
                )}
                {avails > 0 && (
                  <div className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium truncate">
                    {avails} Slots
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
