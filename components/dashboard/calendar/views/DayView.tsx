"use client";

import React, { useMemo } from "react";
import { Coffee, Lock, Calendar, Clock } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getWorkingHoursTimeRows,
  WorkingHoursConfig,
  getDoctorBreakInterval,
  formatBreakTimeTitle,
  timeToMinutes,
} from "../calendarUtils";
import {
  BREAK_TIME_LABEL,
  BREAK_TIME_BADGE,
  BREAK_TIME_SUBTITLE,
} from "../constants";
import Badge from "@/components/ui/Badge";

interface DayViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  workingHoursConfig?: WorkingHoursConfig;
  onBookPatient?: () => void;
  onEventClick: (event: CalendarEvent, date: string) => void;
  onEmptySlotClick?: (date: string, start: string, end: string) => void;
}

export default function DayView({
  selectedDate,
  events,
  workingHoursConfig,
  onBookPatient,
  onEventClick,
  onEmptySlotClick,
}: DayViewProps) {
  const bookedCount = events.filter((e) => e.type === "APPOINTMENT").length;
  const leaveCount = events.filter(
    (e) => e.type === "LEAVE" || e.type === "HOLIDAY"
  ).length;

  // Retrieve configured/calculated doctor break interval
  const breakInfo = useMemo(() => {
    return getDoctorBreakInterval(workingHoursConfig);
  }, [workingHoursConfig]);

  // Only show working hours slots (active shifts) or slots that contain scheduled events
  const workingTimeRows = useMemo(() => {
    return getWorkingHoursTimeRows(workingHoursConfig, events);
  }, [workingHoursConfig, events]);

  // Calculate unbooked empty 30-minute slots count within active working shifts
  const emptySlotsCount = useMemo(() => {
    return workingTimeRows.filter((timeRow) => {
      const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);
      return !events.some((ev) => doesEventOverlapSlot(ev, slotStart, slotEnd));
    }).length;
  }, [workingTimeRows, events]);

  return (
    <div className="w-full select-none">
      {/* Calendar Legend Bar on Top */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 border border-blue-700 shrink-0" />
            <span className="font-semibold text-slate-700 text-[11px]">
              Appointment (Patient)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-300 bg-white shrink-0" />
            <span className="font-semibold text-slate-700 text-[11px]">
              Empty Slot (Click to Book)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 border border-amber-600 shrink-0" />
            <span className="font-semibold text-slate-700 text-[11px]">
              Doctor Leave
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 border border-purple-600 shrink-0" />
            <span className="font-semibold text-slate-700 text-[11px]">
              Blocked Period
            </span>
          </div>
          {breakInfo && breakInfo.enabled && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-100 border border-amber-300 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">
                {BREAK_TIME_LABEL}
              </span>
            </div>
          )}
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          30-Minute Operating Intervals
        </div>
      </div>

      <div className="p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            Day Schedule — {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational 30-minute stream for appointments, doctor leaves, and empty booking slots.
          </p>
        </div>

        {/* Summary KPI Cards (Matching OverviewTab Pattern) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs p-2.5 sm:p-5 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
              {bookedCount}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-tight line-clamp-2">
              Appointments (30m)
            </p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs p-2.5 sm:p-5 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
              {emptySlotsCount}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-tight line-clamp-2">
              Empty Slots
            </p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs p-2.5 sm:p-5 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Coffee className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
              {leaveCount}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-tight line-clamp-2">
              Leaves / Exclusions
            </p>
          </div>
        </div>

        {/* 30-Minute Operating Stream with Accurate Start/End Times */}
        <div className="space-y-2.5">
          {workingTimeRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              No working slots scheduled for this day.
            </div>
          ) : (
            (() => {
              const breakStartM = breakInfo && breakInfo.enabled ? timeToMinutes(breakInfo.start) : -1;
              let breakRendered = false;

              const renderBreakSlotCard = () => {
                if (!breakInfo || !breakInfo.enabled) return null;
                return (
                  <div
                    key="break-time-slot-card"
                    className="p-2.5 sm:p-3.5 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs select-none"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/80">
                          <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div className="font-mono text-[11px] sm:text-xs font-bold text-amber-950 shrink-0 whitespace-nowrap">
                          {breakInfo.startLabel} – {breakInfo.endLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                        <span className="text-xs font-bold text-amber-900 tracking-wide uppercase truncate">
                          {formatBreakTimeTitle(breakInfo.startLabel, breakInfo.endLabel)}
                        </span>
                        <span className="text-[11px] text-amber-700/80 font-medium hidden sm:inline truncate">
                          • {BREAK_TIME_SUBTITLE}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 shadow-2xs self-center">
                      {BREAK_TIME_BADGE}
                    </span>
                  </div>
                );
              };

              const items: React.ReactNode[] = [];

              workingTimeRows.forEach((timeRow) => {
                const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);
                const currentSlotStartM = timeToMinutes(slotStart);

                // Insert break row right at chronological point
                if (breakInfo && breakInfo.enabled && !breakRendered && currentSlotStartM >= breakStartM) {
                  items.push(renderBreakSlotCard());
                  breakRendered = true;
                }

                // Find events overlapping this 30-minute window
                const cellEvents = events.filter((ev) =>
                  doesEventOverlapSlot(ev, slotStart, slotEnd)
                );

                const apptEvent = cellEvents.find((ev) => ev.type === "APPOINTMENT");
                const leaveEvent = cellEvents.find(
                  (ev) => ev.type === "LEAVE" || ev.type === "HOLIDAY"
                );
                const blockedEvent = cellEvents.find((ev) => ev.type === "BLOCKED");

                // 1. Booked Patient Appointment
                if (apptEvent) {
                  const event = apptEvent;
                  const patientName = event.patient_name || "Patient";
                  const reason = event.reason || "General Visit";

                  items.push(
                    <div
                      key={timeRow}
                      onClick={() => onEventClick(event, selectedDate)}
                      className="p-2.5 sm:p-3.5 rounded-xl border transition-all flex items-center gap-2 sm:gap-3 cursor-pointer border-blue-200 bg-blue-50/30 hover:border-blue-400 hover:shadow-xs"
                    >
                      <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-800 min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap">
                        {format12Hour(event.start)} – {format12Hour(event.end)}
                      </div>

                      <div className="min-w-0 flex-1 truncate text-xs text-slate-900">
                        <span className="font-bold text-slate-900">
                          {patientName}
                        </span>
                        <span className="text-slate-600 font-normal">
                          {" - "}{reason}
                        </span>
                      </div>
                    </div>
                  );
                  return;
                }

                // 2. Doctor Leave or Clinic Holiday
                if (leaveEvent) {
                  const event = leaveEvent;
                  items.push(
                    <div
                      key={timeRow}
                      onClick={() => onEventClick(event, selectedDate)}
                      className="p-2.5 sm:p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-xs"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-800 min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap">
                          {format12Hour(event.start)} – {format12Hour(event.end)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-amber-950 flex items-center gap-1.5 truncate">
                            <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span className="truncate">
                              {event.type === "LEAVE"
                                ? "Doctor Leave"
                                : "Clinic Holiday"}
                            </span>
                            {event.reason && (
                              <span className="text-amber-700 font-normal truncate">
                                • {event.reason}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="warning"
                        className="text-[10px] font-bold uppercase tracking-wider shrink-0 self-center"
                      >
                        {event.type}
                      </Badge>
                    </div>
                  );
                  return;
                }

                // 3. Blocked Interval
                if (blockedEvent) {
                  const event = blockedEvent;
                  items.push(
                    <div
                      key={timeRow}
                      onClick={() => onEventClick(event, selectedDate)}
                      className="p-2.5 sm:p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer border-purple-200 bg-purple-50/40 hover:border-purple-400 hover:shadow-xs"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-800 min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap">
                          {format12Hour(event.start)} – {format12Hour(event.end)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-purple-950 flex items-center gap-1.5 truncate">
                            <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span className="truncate">
                              Blocked:{" "}
                              {event.reason || "Doctor Duty / Personal"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold uppercase tracking-wider shrink-0 self-center"
                      >
                        BLOCKED
                      </Badge>
                    </div>
                  );
                  return;
                }

                // 4. Clean Empty Slot (Click to Book)
                items.push(
                  <div
                    key={timeRow}
                    onClick={() => {
                      if (onEmptySlotClick) {
                        onEmptySlotClick(selectedDate, slotStart, slotEnd);
                      } else if (onBookPatient) {
                        onBookPatient();
                      }
                    }}
                    className="p-2.5 sm:p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 hover:bg-blue-50/40 hover:border-blue-300 transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:shadow-xs group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-blue-700 min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap transition-colors">
                        {format12Hour(slotStart)} – {format12Hour(slotEnd)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs text-slate-600 flex items-center gap-1.5 sm:gap-2 truncate">
                          <span className="w-2 h-2 rounded-full border border-slate-300 bg-white group-hover:border-blue-400 inline-block shrink-0 transition-colors" />
                          <span className="font-bold text-slate-700 group-hover:text-blue-800 transition-colors truncate">
                            Empty Slot
                          </span>
                          <span className="text-[11px] text-slate-400 group-hover:text-blue-500 font-normal transition-colors truncate hidden xs:inline sm:inline">
                            — Click to book
                          </span>
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-600 border-slate-300 bg-white group-hover:border-blue-300 group-hover:text-blue-700 transition-colors shrink-0 self-center"
                    >
                      {"EMPTY"}
                    </Badge>
                  </div>
                );
              });

              // If break time is after all working slots (or only morning was configured)
              if (breakInfo && breakInfo.enabled && !breakRendered) {
                items.push(renderBreakSlotCard());
                breakRendered = true;
              }

              return items;
            })()
          )}
        </div>
      </div>
    </div>
  );
}
