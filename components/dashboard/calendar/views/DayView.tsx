"use client";

import React, { useMemo } from "react";
import { User, Coffee, Lock } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getWorkingHoursTimeRows,
  WorkingHoursConfig,
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
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          30-Minute Operating Intervals
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            Day Schedule — {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational 30-minute stream for appointments, doctor leaves, and empty booking slots.
          </p>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-center">
            <div className="text-lg font-black text-blue-900">{bookedCount}</div>
            <div className="text-[11px] font-medium text-blue-700">
              Appointments (30m)
            </div>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
            <div className="text-lg font-black text-emerald-900">
              {emptySlotsCount}
            </div>
            <div className="text-[11px] font-medium text-emerald-700">
              Empty Slots
            </div>
          </div>
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
            <div className="text-lg font-black text-amber-900">{leaveCount}</div>
            <div className="text-[11px] font-medium text-amber-700">
              Leaves / Exclusions
            </div>
          </div>
        </div>

        {/* 30-Minute Operating Stream with Accurate Start/End Times */}
        <div className="space-y-2.5">
          {workingTimeRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              No working slots scheduled for this day.
            </div>
          ) : (
            workingTimeRows.map((timeRow) => {
              const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);

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
                return (
                  <div
                    key={timeRow}
                    onClick={() => onEventClick(event, selectedDate)}
                    className="p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer border-blue-200 bg-blue-50/30 hover:border-blue-400 hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs font-bold text-slate-800 w-36 shrink-0">
                        {format12Hour(event.start)} – {format12Hour(event.end)}
                      </div>

                      <div>
                        <div className="font-semibold text-xs text-blue-950 flex items-center gap-1.5 flex-wrap">
                          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-900">
                            {event.patient_name || "Patient"}
                          </span>
                          <span className="text-slate-500 font-normal">
                            • {event.reason || "General Visit"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="default"
                      className="text-[10px] font-bold uppercase tracking-wider"
                    >
                      {event.status || "BOOKED"}
                    </Badge>
                  </div>
                );
              }

              // 2. Doctor Leave or Clinic Holiday
              if (leaveEvent) {
                const event = leaveEvent;
                return (
                  <div
                    key={timeRow}
                    onClick={() => onEventClick(event, selectedDate)}
                    className="p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs font-bold text-slate-800 w-36 shrink-0">
                        {format12Hour(event.start)} – {format12Hour(event.end)}
                      </div>

                      <div>
                        <div className="font-semibold text-xs text-amber-950 flex items-center gap-1.5">
                          <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>
                            {event.type === "LEAVE"
                              ? "Doctor Leave"
                              : "Clinic Holiday"}
                          </span>
                          {event.reason && (
                            <span className="text-amber-700 font-normal ml-1">
                              • {event.reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="warning"
                      className="text-[10px] font-bold uppercase tracking-wider"
                    >
                      {event.type}
                    </Badge>
                  </div>
                );
              }

              // 3. Blocked Interval
              if (blockedEvent) {
                const event = blockedEvent;
                return (
                  <div
                    key={timeRow}
                    onClick={() => onEventClick(event, selectedDate)}
                    className="p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer border-purple-200 bg-purple-50/40 hover:border-purple-400 hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs font-bold text-slate-800 w-36 shrink-0">
                        {format12Hour(event.start)} – {format12Hour(event.end)}
                      </div>

                      <div>
                        <div className="font-semibold text-xs text-purple-950 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>
                            Blocked Interval:{" "}
                            {event.reason || "Doctor Duty / Personal"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold uppercase tracking-wider"
                    >
                      BLOCKED
                    </Badge>
                  </div>
                );
              }

              // 4. Clean Empty Slot (Click to Book)
              return (
                <div
                  key={timeRow}
                  onClick={() => {
                    if (onEmptySlotClick) {
                      onEmptySlotClick(selectedDate, slotStart, slotEnd);
                    } else if (onBookPatient) {
                      onBookPatient();
                    }
                  }}
                  className="p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 hover:bg-blue-50/40 hover:border-blue-300 transition-all flex items-center justify-between cursor-pointer hover:shadow-xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs font-bold text-slate-700 group-hover:text-blue-700 w-36 shrink-0 transition-colors">
                      {format12Hour(slotStart)} – {format12Hour(slotEnd)}
                    </div>

                    <div>
                      <div className="font-medium text-xs text-slate-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border border-slate-300 bg-white group-hover:border-blue-400 inline-block shrink-0 transition-colors" />
                        <span className="font-bold text-slate-700 group-hover:text-blue-800 transition-colors">
                          Empty Slot
                        </span>
                        <span className="text-[11px] text-slate-400 group-hover:text-blue-500 font-normal transition-colors">
                          — Click to book
                        </span>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-600 border-slate-300 bg-white group-hover:border-blue-300 group-hover:text-blue-700 transition-colors"
                  >
                    {"EMPTY SLOT"}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
