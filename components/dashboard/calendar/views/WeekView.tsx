"use client";

import React, { useMemo } from "react";
import { User, RotateCw, Coffee, Lock, Clock } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import { WeekDayItem } from "../types";
import { TIME_ROWS } from "../constants";
import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getDayStatus,
  isSlotWithinWorkingHours,
  WorkingHoursConfig,
} from "../calendarUtils";

interface WeekViewProps {
  currentWeekDays: WeekDayItem[];
  onSelectDate: (dateStr: string) => void;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onEventClick: (event: CalendarEvent, date: string) => void;
  onAvailableSlotClick: (date: string, start: string, end: string) => void;
  onQuickAddSlot: (date: string, start: string, end: string) => void;
  onEmptySlotClick?: (date: string, start: string, end: string) => void;
  workingHoursConfig?: WorkingHoursConfig;
}

// Full-width grid definition without horizontal scroll: 68px for Time, all 7 days distributed equally
const GRID_COLS_CLASS = "grid grid-cols-[68px_repeat(7,minmax(0,1fr))]";

export default function WeekView({
  currentWeekDays,
  onSelectDate,
  getEventsForDate,
  onEventClick,
  onAvailableSlotClick,
  onQuickAddSlot,
  onEmptySlotClick,
  workingHoursConfig,
}: WeekViewProps) {
  // Current real-world date for highlight
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  return (
    <div className="w-full select-none">
      <div className="w-full">
        {/* Calendar Legend Bar on Top */}
        <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 border border-blue-700 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Appointment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 border border-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Available Slot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 border border-amber-600 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Doctor Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 border border-purple-600 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Blocked Period</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-blue-400 bg-blue-50 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Bookable Shift Slot</span>
            </div>
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            30-Minute Operating Intervals
          </div>
        </div>

        {/* Sticky Day Header Row */}
        <div
          className={`${GRID_COLS_CLASS} border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs backdrop-blur-xs`}
        >
          {/* Top-left Time column label */}
          <div className="p-2 border-r border-slate-200 text-center flex items-center justify-center bg-slate-50/70">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-slate-500" />
              Time
            </span>
          </div>

          {/* 7 Days Headers */}
          {currentWeekDays.map((day) => {
            const isToday = day.dateStr === todayStr;
            return (
              <div
                key={day.dateStr}
                onClick={() => onSelectDate(day.dateStr)}
                className={`py-2 px-1 text-center border-r border-slate-200 last:border-r-0 cursor-pointer transition-all ${
                  day.isSelected
                    ? "bg-blue-50/70 shadow-inner"
                    : isToday
                    ? "bg-blue-50/25 hover:bg-blue-50/50"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span
                    className={`text-[11px] uppercase tracking-wider font-bold truncate ${
                      day.isSelected
                        ? "text-blue-700"
                        : isToday
                        ? "text-blue-600"
                        : "text-slate-500"
                    }`}
                  >
                    {day.dayName}
                  </span>
                  {isToday && !day.isSelected && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block shrink-0"
                      title="Today"
                    />
                  )}
                </div>
                <div
                  className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    day.isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : isToday
                      ? "border-2 border-blue-600 text-blue-600 bg-white font-black"
                      : "text-slate-800 hover:bg-slate-200/70"
                  }`}
                >
                  {day.dayNum}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-Day Clinic Status Row */}
        <div
          className={`${GRID_COLS_CLASS} border-b border-slate-200 bg-slate-50/70`}
        >
          <div className="p-1 border-r border-slate-200 text-center flex items-center justify-center bg-slate-100/50">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              Clinic
            </span>
          </div>
          {currentWeekDays.map((day) => {
            const status = getDayStatus(day.dateStr);
            return (
              <div
                key={`status-${day.dateStr}`}
                className="p-1 border-r border-slate-200 last:border-r-0 text-center flex items-center justify-center"
              >
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border inline-block w-full max-w-[85px] truncate text-center shadow-2xs ${status.color}`}
                >
                  {status.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* 30-Minute Time Slots Grid - All 7 Days Fully Rendered */}
        <div className="divide-y divide-slate-100">
          {TIME_ROWS.map((timeRow) => {
            const isHour = timeRow.endsWith(":00 AM") || timeRow.endsWith(":00 PM");
            const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);

            return (
              <div
                key={timeRow}
                className={`${GRID_COLS_CLASS} min-h-[48px] ${
                  isHour
                    ? "border-t border-slate-200 bg-white"
                    : "border-t border-dashed border-slate-200/70 bg-slate-50/20"
                }`}
              >
                {/* Left Time Column - Bold Monospace Labels */}
                <div
                  className={`p-1.5 border-r border-slate-200 flex items-center justify-end pr-2 select-none ${
                    isHour ? "bg-slate-50/60" : "bg-slate-50/30"
                  }`}
                >
                  <span
                    className={`font-mono font-bold tracking-tight text-[11px] whitespace-nowrap ${
                      isHour ? "text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {timeRow}
                  </span>
                </div>

                {/* 7 Day Columns - All Grid Slots Visible Without Scroll */}
                {currentWeekDays.map((day) => {
                  const dayEvents = getEventsForDate(day.dateStr);

                  // Find events overlapping this 30-minute window
                  const cellEvents = dayEvents.filter((ev) =>
                    doesEventOverlapSlot(ev, slotStart, slotEnd)
                  );

                  return (
                    <div
                      key={`${day.dateStr}-${timeRow}`}
                      className={`p-1 border-r border-slate-200 last:border-r-0 relative group transition-colors ${
                        day.isSelected ? "bg-blue-50/15" : "hover:bg-slate-50/60"
                      }`}
                    >
                      {cellEvents.length > 0 ? (
                        <div className="space-y-1">
                          {cellEvents.map((event, idx) => {
                            const isAppointment = event.type === "APPOINTMENT";
                            const isAvailable = event.type === "AVAILABLE";
                            const isLeave = event.type === "LEAVE" || event.type === "HOLIDAY";
                            const isBlocked = event.type === "BLOCKED";

                            // DOCTOR LEAVE / CLINIC HOLIDAY
                            if (isLeave) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() => onEventClick(event, day.dateStr)}
                                  className="p-1 rounded-md bg-amber-50/95 border border-amber-300 border-l-[3px] border-l-amber-500 text-amber-950 hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`${event.type === "LEAVE" ? "Doctor Leave" : "Clinic Holiday"}: ${format12Hour(event.start)} - ${format12Hour(event.end)}${event.reason ? ` (${event.reason})` : ""}`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <Coffee className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span className="text-[10px] font-bold text-amber-950 truncate">
                                      {event.type === "LEAVE" ? "Doctor Leave" : "Clinic Holiday"}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-amber-800 font-bold mt-0.5 font-mono tracking-tight truncate">
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
                                  className="p-1 rounded-md bg-purple-50/90 border border-purple-200 border-l-[3px] border-l-purple-600 text-purple-950 hover:border-purple-400 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`Blocked: ${format12Hour(event.start)} - ${format12Hour(event.end)}${event.reason ? ` (${event.reason})` : ""}`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <Lock className="w-3 h-3 text-purple-600 shrink-0" />
                                    <span className="text-[10px] font-bold text-purple-950 truncate">
                                      {event.reason || "Blocked Period"}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-purple-700 font-bold mt-0.5 font-mono tracking-tight truncate">
                                    {format12Hour(event.start)} – {format12Hour(event.end)}
                                  </div>
                                </div>
                              );
                            }

                            // BOOKED APPOINTMENT
                            if (isAppointment) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() => onEventClick(event, day.dateStr)}
                                  className="p-1 rounded-md bg-blue-50/90 border border-blue-200 border-l-[3px] border-l-blue-600 text-blue-950 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer select-none group/appt"
                                  title={`Appointment: ${event.patient_name} (${format12Hour(event.start)} - ${format12Hour(event.end)})`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <User className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span className="text-[10px] font-bold text-blue-950 truncate">
                                      {event.patient_name || "Patient"}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-blue-700 font-bold mt-0.5 flex items-center justify-between">
                                    <span className="font-mono tracking-tight truncate">
                                      {format12Hour(event.start)} – {format12Hour(event.end)}
                                    </span>
                                    {event.reason && (
                                      <span className="text-slate-500 truncate max-w-[40px] text-[8px] font-normal group-hover/appt:text-slate-700">
                                        {event.reason}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // AVAILABLE SLOT
                            if (isAvailable) {
                              return (
                                <div
                                  key={idx}
                                  onClick={() =>
                                    onAvailableSlotClick(day.dateStr, event.start, event.end)
                                  }
                                  className="p-1 rounded-md bg-emerald-50/90 border border-emerald-200 border-l-[3px] border-l-emerald-600 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100/70 hover:shadow-xs transition-all cursor-pointer select-none"
                                  title={`Click to book appointment (${format12Hour(event.start)} - ${format12Hour(event.end)})`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <RotateCw className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="text-[10px] font-bold text-emerald-950 truncate">
                                      Available
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-emerald-700 font-bold mt-0.5 font-mono tracking-tight truncate">
                                    {format12Hour(event.start)} – {format12Hour(event.end)}
                                  </div>
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      ) : (() => {
                        const isWorkingHour = isSlotWithinWorkingHours(
                          day.dateStr,
                          slotStart,
                          slotEnd,
                          workingHoursConfig
                        );

                        if (isWorkingHour) {
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (onEmptySlotClick) {
                                  onEmptySlotClick(day.dateStr, slotStart, slotEnd);
                                } else {
                                  onQuickAddSlot(day.dateStr, slotStart, slotEnd);
                                }
                              }}
                              className="w-full h-full min-h-[38px] border border-dashed border-blue-200/80 hover:border-blue-500 bg-blue-50/15 hover:bg-blue-50/60 rounded-md flex items-center justify-center text-[10px] font-bold text-blue-600 transition-all cursor-pointer group/slot shadow-2xs hover:shadow-xs px-1"
                              title={`Click to book patient or mark leave (${format12Hour(slotStart)} - ${format12Hour(slotEnd)})`}
                            >
                              <span className="opacity-0 group-hover/slot:opacity-100 transition-opacity font-bold truncate">
                                Book / Leave
                              </span>
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            onClick={() => onQuickAddSlot(day.dateStr, slotStart, slotEnd)}
                            className="w-full h-full min-h-[38px] opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-md transition-all cursor-pointer px-1"
                            title={`Add available slot (${format12Hour(slotStart)} - ${format12Hour(slotEnd)})`}
                          >
                            <span className="truncate">Add Slot</span>
                          </button>
                        );
                      })()}
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
