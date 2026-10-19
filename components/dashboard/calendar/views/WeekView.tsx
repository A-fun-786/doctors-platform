"use client";

import React from "react";
import { Sparkles, User, RotateCw, Plus } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import { WeekDayItem } from "../types";
import { TIME_ROWS } from "../constants";
import { format12Hour, getSlotHourKey, getDayStatus } from "../calendarUtils";

interface WeekViewProps {
  currentWeekDays: WeekDayItem[];
  onSelectDate: (dateStr: string) => void;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onEventClick: (event: CalendarEvent, date: string) => void;
  onAvailableSlotClick: (date: string, start: string, end: string) => void;
  onQuickAddSlot: (date: string, timeRow: string) => void;
}

export default function WeekView({
  currentWeekDays,
  onSelectDate,
  getEventsForDate,
  onEventClick,
  onAvailableSlotClick,
  onQuickAddSlot,
}: WeekViewProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[840px]">
        {/* Day Header Row */}
        <div className="grid grid-cols-8 border-b border-slate-200 bg-white">
          {/* Empty top-left time column header */}
          <div className="p-3 border-r border-slate-200 text-center flex items-center justify-center">
            <span className="text-[11px] font-medium text-slate-400">All day</span>
          </div>

          {/* 7 Days Headers */}
          {currentWeekDays.map((day) => (
            <div
              key={day.dateStr}
              onClick={() => onSelectDate(day.dateStr)}
              className={`p-3 text-center border-r border-slate-200 last:border-r-0 cursor-pointer transition-colors ${
                day.isSelected ? "bg-blue-50/40" : "hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-medium text-slate-500 mb-1">{day.dayName}</div>
              <div
                className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  day.isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                {day.dayNum}
              </div>
            </div>
          ))}
        </div>

        {/* All-Day Status Row */}
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/50">
          <div className="p-2 border-r border-slate-200 text-center flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Status
            </span>
          </div>
          {currentWeekDays.map((day) => {
            const status = getDayStatus(day.dateStr);
            return (
              <div
                key={`status-${day.dateStr}`}
                className="p-2 border-r border-slate-200 last:border-r-0 text-center flex items-center justify-center"
              >
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded border inline-block w-full max-w-[95px] text-center ${status.color}`}
                >
                  {status.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time Slots Grid Rows */}
        <div className="divide-y divide-slate-100">
          {TIME_ROWS.map((timeRow) => (
            <div key={timeRow} className="grid grid-cols-8 min-h-[72px]">
              {/* Left Time Label Column */}
              <div className="p-2.5 border-r border-slate-200 bg-white flex items-start justify-end pr-3">
                <span className="text-xs font-medium text-slate-500">{timeRow}</span>
              </div>

              {/* Day Columns */}
              {currentWeekDays.map((day, dayIndex) => {
                const isSunday = dayIndex === 6;
                const dayEvents = getEventsForDate(day.dateStr);

                // Find matching events for this time row hour
                const cellEvents = dayEvents.filter((ev) => {
                  const evKey = getSlotHourKey(ev.start);
                  return evKey === timeRow;
                });

                return (
                  <div
                    key={`${day.dateStr}-${timeRow}`}
                    className={`p-1.5 border-r border-slate-200 last:border-r-0 relative group transition-colors ${
                      isSunday
                        ? "bg-slate-50/60"
                        : day.isSelected
                        ? "bg-blue-50/20"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    {isSunday ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                        Off
                      </div>
                    ) : cellEvents.length > 0 ? (
                      <div className="space-y-1.5">
                        {cellEvents.map((event, idx) => {
                          const isAppointment = event.type === "APPOINTMENT";
                          const isAvailable = event.type === "AVAILABLE";
                          const isFollowUp =
                            event.reason?.toLowerCase().includes("follow") ||
                            event.type === "BLOCKED";

                          if (isFollowUp) {
                            return (
                              <div
                                key={idx}
                                onClick={() => onEventClick(event, day.dateStr)}
                                className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 hover:border-purple-400 hover:shadow-xs transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span className="text-xs font-semibold text-purple-950 truncate">
                                    {event.reason || "Follow-up"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-purple-600 font-medium mt-0.5">
                                  {format12Hour(event.start)} - {format12Hour(event.end)}
                                </div>
                              </div>
                            );
                          }

                          if (isAppointment) {
                            return (
                              <div
                                key={idx}
                                onClick={() => onEventClick(event, day.dateStr)}
                                className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="text-xs font-semibold text-blue-950 truncate">
                                    Patient: {event.patient_name || "Patient"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                                  {format12Hour(event.start)} - {format12Hour(event.end)}
                                </div>
                              </div>
                            );
                          }

                          if (isAvailable) {
                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  onAvailableSlotClick(day.dateStr, event.start, event.end)
                                }
                                className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5">
                                  <RotateCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="text-xs font-semibold text-emerald-950">
                                    Available
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                  {format12Hour(event.start)} - {format12Hour(event.end)}
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    ) : (
                      // Quick slot create on hover
                      <button
                        type="button"
                        onClick={() => onQuickAddSlot(day.dateStr, timeRow)}
                        className="w-full h-full min-h-[50px] opacity-0 group-hover:opacity-100 flex items-center justify-center text-slate-300 hover:text-blue-600 transition-opacity"
                        title="Add slot"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
