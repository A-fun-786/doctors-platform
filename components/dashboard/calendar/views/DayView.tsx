"use client";

import React from "react";
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
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Day Schedule — {selectedDate}
          </h3>
          <p className="text-xs text-slate-500">
            Detailed operational stream for this clinic date.
          </p>
        </div>
        <button
          type="button"
          onClick={onBookPatient}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
        >
          Book Patient
        </button>
      </div>

      <div className="space-y-2.5">
        {events.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No events scheduled for this day.
          </div>
        ) : (
          events.map((event, i) => (
            <div
              key={i}
              onClick={() => onEventClick(event, selectedDate)}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs font-bold text-slate-700 w-24">
                  {format12Hour(event.start)}
                </div>
                <div>
                  {event.type === "APPOINTMENT" ? (
                    <div className="font-semibold text-xs text-blue-900">
                      Patient: {event.patient_name}
                      {event.reason && (
                        <span className="text-slate-500 font-normal ml-2">
                          • {event.reason}
                        </span>
                      )}
                    </div>
                  ) : event.type === "AVAILABLE" ? (
                    <div className="font-semibold text-xs text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Open for Booking
                    </div>
                  ) : (
                    <div className="font-semibold text-xs text-purple-900">
                      {event.reason || "Special Period"}
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] font-semibold uppercase">
                {event.type}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
