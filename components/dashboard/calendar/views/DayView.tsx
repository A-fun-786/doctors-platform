"use client";

import React, { useMemo } from "react";
import { Lock, Calendar, Clock, Plus } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getWorkingHoursTimeRows,
  WorkingHoursConfig,
  WorkingHoursShift,
  timeToMinutes,
  getSlotShiftTheme,
  SHIFT_THEME_PALETTES,
  DEFAULT_WORKING_HOURS,
} from "../calendarUtils";
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

  const activeShifts = (workingHoursConfig || DEFAULT_WORKING_HOURS).shifts.filter(
    (s: WorkingHoursShift) => s.enabled
  );

  return (
    <div className="w-full select-none">
      {/* Calendar Legend Bar on Top with Dynamic Schedule/Shift indicators */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {activeShifts.map((shift: WorkingHoursShift, idx: number) => {
            const theme = SHIFT_THEME_PALETTES[idx % SHIFT_THEME_PALETTES.length];
            return (
              <div
                key={shift.id || idx}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${theme.pillBg} ${theme.pillText} ${theme.pillBorder}`}
              >
                <span className={`w-2 h-2 rounded-full ${theme.indicator} shrink-0`} />
                <span className="font-semibold text-[11px]">
                  {shift.label || `Schedule ${idx + 1}`} ({format12Hour(shift.start)} – {format12Hour(shift.end)})
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
          <span className="hidden sm:inline">Dynamic Schedule Slots</span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Appointment (Patient)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Doctor Leave
          </span>
        </div>
      </div>

      <div className="p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            Day Schedule — {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational 30-minute stream with schedule-divided borders and clean UI.
          </p>
        </div>

        {/* Summary KPI Cards */}
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
              <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <p className="text-lg sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
              {leaveCount}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-tight line-clamp-2">
              Leaves / Exclusions
            </p>
          </div>
        </div>

        {/* 30-Minute Operating Stream with Schedule-Divided Borders (No Break) */}
        <div className="space-y-2.5">
          {workingTimeRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              No working slots scheduled for this day.
            </div>
          ) : (
            (() => {
              let prevShiftName: string | null = null;
              return workingTimeRows.map((timeRow, rowIndex) => {
                const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);
                const prefStyles = getSlotShiftTheme(slotStart, workingHoursConfig);

                // Subtle pure thin line divider on schedule transition (no timing/badge text)
                const isShiftChange =
                  rowIndex > 0 &&
                  prevShiftName !== null &&
                  prevShiftName !== prefStyles.name;
                prevShiftName = prefStyles.name;

                const shiftDivider = isShiftChange ? (
                  <div key={`divider-${timeRow}`} className="py-2.5">
                    <div className="border-t border-slate-200 w-full" />
                  </div>
                ) : null;

                // Find events overlapping this 30-minute window
                const cellEvents = events.filter((ev) =>
                  doesEventOverlapSlot(ev, slotStart, slotEnd)
                );

                const apptEvent = cellEvents.find((ev) => ev.type === "APPOINTMENT");
                const leaveEvent = cellEvents.find(
                  (ev) => ev.type === "LEAVE" || ev.type === "HOLIDAY"
                );
                const blockedEvent = cellEvents.find((ev) => ev.type === "BLOCKED");

                // 1. Booked Patient Appointment (Clean: only Name & Visit Reason)
                if (apptEvent) {
                  const event = apptEvent;
                  const patientName = event.patient_name || "Patient";
                  const reason = event.reason || "General Visit";

                  return (
                    <React.Fragment key={timeRow}>
                      {shiftDivider}
                      <div
                        onClick={() => onEventClick(event, selectedDate)}
                        className={`p-2.5 sm:p-3.5 rounded-xl transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer ${prefStyles.bookedBorder}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
                          <div
                            className={`font-mono text-[11px] sm:text-xs font-bold ${prefStyles.timeText} min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap`}
                          >
                            {format12Hour(event.start)} – {format12Hour(event.end)}
                          </div>

                          <div className="min-w-0 flex-1 truncate text-xs text-slate-900 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                            <span className="font-bold text-slate-900 truncate">
                              {patientName}
                            </span>
                            <span className="text-slate-500 font-normal truncate">
                              {" — "}{reason}
                            </span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                // 2. Doctor Leave or Clinic Holiday
                if (leaveEvent) {
                  const event = leaveEvent;
                  return (
                    <React.Fragment key={timeRow}>
                      {shiftDivider}
                      <div
                        onClick={() => onEventClick(event, selectedDate)}
                        className="p-2.5 sm:p-3.5 rounded-xl border-2 transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:shadow-xs"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-800 min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap">
                            {format12Hour(event.start)} – {format12Hour(event.end)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-amber-950 flex items-center gap-1.5 truncate">
                              <span className="truncate">
                                {event.type === "LEAVE" ? "Doctor Leave" : "Clinic Holiday"}
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
                    </React.Fragment>
                  );
                }

                // 3. Blocked Interval
                if (blockedEvent) {
                  const event = blockedEvent;
                  return (
                    <React.Fragment key={timeRow}>
                      {shiftDivider}
                      <div
                        onClick={() => onEventClick(event, selectedDate)}
                        className="p-2.5 sm:p-3.5 rounded-xl border-2 transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer border-purple-300 bg-purple-50/30 hover:border-purple-400 hover:shadow-xs"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="font-mono text-[11px] sm:text-xs font-bold text-slate-800 min-w-[130px] sm:min-w-[155px] shrink-0 whitespace-nowrap">
                            {format12Hour(event.start)} – {format12Hour(event.end)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-purple-950 flex items-center gap-1.5 truncate">
                              <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span className="truncate">
                                Blocked: {event.reason || "Doctor Duty / Personal"}
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
                    </React.Fragment>
                  );
                }

                // 4. Clean Empty Slot (Schedule-colored border, zero text clutter)
                return (
                  <React.Fragment key={timeRow}>
                    {shiftDivider}
                    <div
                      onClick={() => {
                        if (onEmptySlotClick) {
                          onEmptySlotClick(selectedDate, slotStart, slotEnd);
                        } else if (onBookPatient) {
                          onBookPatient();
                        }
                      }}
                      className={`p-2.5 sm:p-3.5 rounded-xl transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:shadow-xs group ${prefStyles.emptyCard}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                        <div
                          className={`font-mono text-[11px] sm:text-xs font-semibold ${prefStyles.emptyTimeText} transition-colors whitespace-nowrap`}
                        >
                          {format12Hour(slotStart)} – {format12Hour(slotEnd)}
                        </div>
                      </div>

                      {/* Clean Minimal Hover Action Icon */}
                      <div
                        className={`opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md bg-white border transition-all shadow-2xs ${prefStyles.plusBtn}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()
          )}
        </div>
      </div>
    </div>
  );
}
