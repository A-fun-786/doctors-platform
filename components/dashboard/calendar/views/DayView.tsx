"use client";

import React from "react";
import { User, Coffee, Lock, RotateCw, Plus } from "lucide-react";
import { CalendarEvent } from "@/lib/api";
import { format12Hour } from "../calendarUtils";
import Badge from "@/components/ui/Badge";

interface DayViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  onBookPatient: () => void;
  onEventClick: (event: CalendarEvent, date: string) => void;
}

export default function DayView({
  selectedDate,
  events,
  onBookPatient,
  onEventClick,
}: DayViewProps) {
  const bookedCount = events.filter((e) => e.type === "APPOINTMENT").length;
  const availCount = events.filter((e) => e.type === "AVAILABLE").length;
  const leaveCount = events.filter((e) => e.type === "LEAVE" || e.type === "HOLIDAY").length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Day Schedule — {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational 30-minute stream for appointments, availability, and doctor leave.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBookPatient}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Book Patient
          </button>
        </div>
      </div>

      {/* Summary Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-center">
          <div className="text-lg font-black text-blue-900">{bookedCount}</div>
          <div className="text-[11px] font-medium text-blue-700">Appointments (30m)</div>
        </div>
        <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
          <div className="text-lg font-black text-emerald-900">{availCount}</div>
          <div className="text-[11px] font-medium text-emerald-700">Available Slots</div>
        </div>
        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
          <div className="text-lg font-black text-amber-900">{leaveCount}</div>
          <div className="text-[11px] font-medium text-amber-700">Leaves / Exclusions</div>
        </div>
      </div>

      {/* Events Stream with Accurate Start/End Times */}
      <div className="space-y-2.5">
        {events.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            No events scheduled for this day.
          </div>
        ) : (
          events.map((event, i) => {
            const isLeave = event.type === "LEAVE" || event.type === "HOLIDAY";
            const isBlocked = event.type === "BLOCKED";
            const isAppt = event.type === "APPOINTMENT";
            const isAvail = event.type === "AVAILABLE";

            return (
              <div
                key={i}
                onClick={() => onEventClick(event, selectedDate)}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  isLeave
                    ? "border-amber-200 bg-amber-50/50 hover:border-amber-400"
                    : isBlocked
                    ? "border-purple-200 bg-purple-50/40 hover:border-purple-400"
                    : isAppt
                    ? "border-blue-200 bg-blue-50/30 hover:border-blue-400"
                    : "border-emerald-200 bg-emerald-50/30 hover:border-emerald-400"
                } hover:shadow-xs`}
              >
                <div className="flex items-center gap-3">
                  {/* Accurate Start & End Times */}
                  <div className="font-mono text-xs font-bold text-slate-800 w-36 shrink-0">
                    {format12Hour(event.start)} – {format12Hour(event.end)}
                  </div>

                  <div>
                    {isAppt ? (
                      <div className="font-semibold text-xs text-blue-950 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Patient: {event.patient_name}</span>
                        {event.reason && (
                          <span className="text-slate-500 font-normal ml-1">
                            • {event.reason}
                          </span>
                        )}
                      </div>
                    ) : isLeave ? (
                      <div className="font-semibold text-xs text-amber-950 flex items-center gap-1.5">
                        <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          {event.type === "LEAVE" ? "Doctor Leave" : "Clinic Holiday"}
                        </span>
                        {event.reason && (
                          <span className="text-amber-700 font-normal ml-1">
                            • {event.reason}
                          </span>
                        )}
                      </div>
                    ) : isBlocked ? (
                      <div className="font-semibold text-xs text-purple-950 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Blocked Interval: {event.reason || "Doctor Duty / Personal"}</span>
                      </div>
                    ) : isAvail ? (
                      <div className="font-semibold text-xs text-emerald-800 flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Open 30-Minute Booking Slot</span>
                      </div>
                    ) : (
                      <div className="font-semibold text-xs text-slate-800">
                        {event.reason || "Special Period"}
                      </div>
                    )}
                  </div>
                </div>

                <Badge
                  variant={isAppt ? "default" : isLeave ? "warning" : "outline"}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {event.type === "APPOINTMENT" ? event.status || "BOOKED" : event.type}
                </Badge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
