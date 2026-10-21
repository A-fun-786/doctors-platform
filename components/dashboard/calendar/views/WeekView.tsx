"use client";

import React from "react";
import { Sparkles, User, RotateCw, Plus, Coffee, Lock } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import { WeekDayItem } from "../types";
import { TIME_ROWS } from "../constants";
import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getDayStatus,
} from "../calendarUtils";

interface WeekViewProps {
  currentWeekDays: WeekDayItem[];
  onSelectDate: (dateStr: string) => void;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onEventClick: (event: CalendarEvent, date: string) => void;
  onAvailableSlotClick: (date: string, start: string, end: string) => void;
  onQuickAddSlot: (date: string, start: string, end: string) => void;
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
      <div className="min-w-[860px]">
        {/* Day Header Row */}
        <div className="grid grid-cols-8 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-2xs">
          {/* Top-left Time column label */}
          <div className="p-3 border-r border-slate-200 text-center flex items-center justify-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Time
            </span>
          </div>

          {/* 7 Days Headers */}
          {currentWeekDays.map((day) => (
            <div
              key={day.dateStr}
              onClick={() => onSelectDate(day.dateStr)}
              className={`p-3 text-center border-r border-slate-200 last:border-r-0 cursor-pointer transition-colors ${
                day.isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-semibold text-slate-500 mb-1">{day.dayName}</div>
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
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/60">
          <div className="p-2 border-r border-slate-200 text-center flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Clinic
            </span>
          </div>
          {currentWeekDays.map((day) => {
            const status = getDayStatus(day.dateStr);
            return (
              <div
                key={`status-${day.dateStr}`}
                className="p-1.5 border-r border-slate-200 last:border-r-0 text-center flex items-center justify-center"
              >
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-block w-full max-w-[95px] text-center ${status.color}`}
                >
                  {status.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* 30-Minute Time Slots Grid */}
        <div className="divide-y divide-slate-100">
          {TIME_ROWS.map((timeRow) => {
            const isHour = timeRow.endsWith(":00 AM") || timeRow.endsWith(":00 PM");
            const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);

            return (
              <div
                key={timeRow}
                className={`grid grid-cols-8 min-h-[52px] ${
                  isHour ? "border-t border-slate-200/80 bg-white" : "bg-slate-50/20"
                }`}
              >
                {/* Left Time Column */}
                <div
                  className={`p-2 border-r border-slate-200 flex items-start justify-end pr-2.5 select-none ${
                    isHour ? "bg-white" : "bg-slate-50/40"
                  }`}
                >
                  <span
                    className={`text-xs ${
                      isHour
                        ? "font-semibold text-slate-700"
                        : "font-normal text-slate-400 text-[11px]"
                    }`}
                  >
                    {timeRow}
                  </span>
                </div>

                {/* Day Columns */}
                {currentWeekDays.map((day, dayIndex) => {
                  const isSunday = dayIndex === 6;
                  const dayEvents = getEventsForDate(day.dateStr);

                  // Find events that overlap this exact 30-minute slot
                  const cellEvents = dayEvents.filter((ev) =>
                    doesEventOverlapSlot(ev, slotStart, slotEnd)
                  );

                  return (
                    <div
                      key={`${day.dateStr}-${timeRow}`}
                      className={`p-1 border-r border-slate-200 last:border-r-0 relative group transition-colors ${
                        isSunday
                          ? "bg-slate-50/70"
                          : day.isSelected
                          ? "bg-blue-50/15"
                          : "hover:bg-slate-50/50"
                      }`}
                    >
                      {isSunday ? (
                        <div className="h-full flex items-center justify-center text-[11px] text-slate-400 font-medium">
                          Closed
                        </div>
                      ) : cellEvents.length > 0 ? (
                        <div className="space-y-1">
                          {cellEvents.map((event, idx) => {
                            const isAppointment = event.type === "APPOINTMENT";
                            const isAvailable = event.type === "AVAILABLE";
                            const isLeave = event.type === "LEAVE" || event.type === "HOLIDAY";
                            const isBlocked = event.type === "BLOCKED";

                            // DOCTOR LEAVE / HOLIDAY
                            if (isLeave) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() => onEventClick(event, day.dateStr)}
                                  className="p-1.5 rounded-lg bg-amber-50/90 border border-amber-300 text-amber-950 hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`${event.type === "LEAVE" ? "Doctor Leave" : "Clinic Holiday"}: ${format12Hour(event.start)} - ${format12Hour(event.end)}${event.reason ? ` (${event.reason})` : ""}`}
                                >
                                  <div className="flex items-center gap-1">
                                    <Coffee className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span className="text-[11px] font-bold text-amber-900 truncate">
                                      {event.type === "LEAVE" ? "Doctor Leave" : "Clinic Holiday"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-amber-700 font-medium mt-0.5 truncate">
                                    {format12Hour(event.start)} – {format12Hour(event.end)}
                                    {event.reason && ` • ${event.reason}`}
                                  </div>
                                </div>
                              );
                            }

                            // BLOCKED TIME
                            if (isBlocked) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() => onEventClick(event, day.dateStr)}
                                  className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-950 hover:border-purple-400 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`Blocked: ${format12Hour(event.start)} - ${format12Hour(event.end)}${event.reason ? ` (${event.reason})` : ""}`}
                                >
                                  <div className="flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-purple-600 shrink-0" />
                                    <span className="text-[11px] font-bold text-purple-950 truncate">
                                      {event.reason || "Blocked Period"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-purple-600 font-medium mt-0.5">
                                    {format12Hour(event.start)} – {format12Hour(event.end)}
                                  </div>
                                </div>
                              );
                            }

                            // BOOKED APPOINTMENT (30m Increment)
                            if (isAppointment) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() => onEventClick(event, day.dateStr)}
                                  className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`Appointment: ${event.patient_name} (${format12Hour(event.start)} - ${format12Hour(event.end)})`}
                                >
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span className="text-[11px] font-bold text-blue-950 truncate">
                                      {event.patient_name || "Patient"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-blue-600 font-medium mt-0.5 flex items-center justify-between">
                                    <span>
                                      {format12Hour(event.start)} – {format12Hour(event.end)}
                                    </span>
                                    {event.reason && (
                                      <span className="text-slate-400 truncate max-w-[50px] text-[9px] font-normal">
                                        {event.reason}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // AVAILABLE 30-MINUTE SLOT
                            if (isAvailable) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() =>
                                    onAvailableSlotClick(day.dateStr, event.start, event.end)
                                  }
                                  className="p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-900 hover:border-emerald-400 hover:bg-emerald-100/70 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`Click to book appointment (${format12Hour(event.start)} - ${format12Hour(event.end)})`}
                                >
                                  <div className="flex items-center gap-1">
                                    <RotateCw className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="text-[11px] font-bold text-emerald-950">
                                      Available
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                    {format12Hour(event.start)} – {format12Hour(event.end)}
                                  </div>
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      ) : (
                        // Quick slot creation on hover for empty 30-min slot
                        <button
                          type="button"
                          onClick={() => onQuickAddSlot(day.dateStr, slotStart, slotEnd)}
                          className="w-full h-full min-h-[40px] opacity-0 group-hover:opacity-100 flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50/40 rounded transition-all"
                          title={`Add available slot (${format12Hour(slotStart)} - ${format12Hour(slotEnd)})`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
