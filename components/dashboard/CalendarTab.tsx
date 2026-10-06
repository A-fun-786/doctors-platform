"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  User,
  AlertTriangle,
  Coffee,
  CheckCircle2,
  Loader2,
  CalendarDays,
  PlusCircle,
} from "lucide-react";
import {
  DoctorMeResponse,
  getDoctorCalendar,
  CalendarDay,
  CalendarEvent,
} from "@/lib/api";
import { DashboardTabId } from "./DashboardShell";

interface CalendarTabProps {
  doctor: DoctorMeResponse;
  onNavigateTab?: (tab: DashboardTabId) => void;
}

export default function CalendarTab({
  doctor,
  onNavigateTab,
}: CalendarTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);
  const [dayData, setDayData] = useState<CalendarDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = async (dateStr: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDoctorCalendar(dateStr, dateStr);
      const day = res.dates?.find((d) => d.date === dateStr) || null;
      setDayData(day);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load calendar events");
      setDayData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar(selectedDate);
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const events = dayData?.events || [];
  const availableCount = events.filter((e) => e.type === "AVAILABLE").length;
  const appointmentCount = events.filter((e) => e.type === "APPOINTMENT").length;
  const leaveCount = events.filter((e) => e.type === "LEAVE" || e.type === "HOLIDAY").length;
  const blockedCount = events.filter((e) => e.type === "BLOCKED").length;

  return (
    <div className="space-y-6">
      {/* Calendar Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Operational Calendar
              </h2>
              <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-2 py-0.5 rounded border border-brand-200">
                Day View
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified chronological stream of available slots, bookings, breaks, leaves, and holidays.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 hover:bg-white rounded-md text-slate-700 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="px-2 py-1 text-xs font-semibold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={handleNextDay}
                className="p-1.5 hover:bg-white rounded-md text-slate-700 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => fetchCalendar(selectedDate)}
              className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-colors"
              title="Refresh"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Date Display and Event Stats Pill Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-brand-600" />
            <span className="text-sm font-bold text-slate-900">
              {formatDateDisplay(selectedDate)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Available: {availableCount}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-50 text-brand-800 border border-brand-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-brand-600" />
              Booked: {appointmentCount}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Leave/Holiday: {leaveCount}
            </span>
            {blockedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Blocked: {blockedCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Time Grid Stream */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[400px]">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
            <span>Aggregating operational events for {selectedDate}...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                No Working Hours or Events on this Date
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                No schedule entries exist for {selectedDate}. Add your available consultation hours in the Schedule tab to open booking slots.
              </p>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("schedule")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Configure Working Hours</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => {
              const isAvailable = event.type === "AVAILABLE";
              const isAppt = event.type === "APPOINTMENT";
              const isBlocked = event.type === "BLOCKED";
              const isLeave = event.type === "LEAVE";
              const isHoliday = event.type === "HOLIDAY";

              return (
                <div
                  key={`${event.start}-${event.end}-${index}`}
                  className="flex items-center gap-4 group"
                >
                  {/* Time Column */}
                  <div className="w-28 shrink-0 text-right font-mono text-xs font-semibold text-slate-700">
                    {event.start} - {event.end}
                  </div>

                  {/* Event Block */}
                  <div className="flex-1">
                    {isAvailable && (
                      <div className="px-4 py-3 rounded-xl bg-emerald-50/70 border border-dashed border-emerald-300 text-emerald-800 flex items-center justify-between transition-all hover:bg-emerald-100/50">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-semibold tracking-wide">
                            AVAILABLE FOR BOOKING
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-mono">
                          30 min slot
                        </span>
                      </div>
                    )}

                    {isAppt && (
                      <div className="px-4 py-3.5 rounded-xl bg-brand-600 text-white shadow-sm border border-brand-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <User className="w-4 h-4 text-blue-200 shrink-0" />
                          <div>
                            <span className="text-xs font-bold tracking-tight">
                              {event.patient_name || "Patient Appointment"}
                            </span>
                            {event.reason && (
                              <p className="text-[11px] text-blue-100 font-normal mt-0.5">
                                Reason: {event.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-white/20 text-white">
                            {event.status || "BOOKED"}
                          </span>
                        </div>
                      </div>
                    )}

                    {isBlocked && (
                      <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold">
                            BLOCKED: {event.reason || "Unavailable Period"}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-amber-700 uppercase">
                          Blocked
                        </span>
                      </div>
                    )}

                    {isLeave && (
                      <div className="px-4 py-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">
                            LEAVE: {event.reason || "Doctor Off Duty"}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">
                          Leave
                        </span>
                      </div>
                    )}

                    {isHoliday && (
                      <div className="px-4 py-3 rounded-xl bg-purple-50 border border-purple-300 text-purple-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="text-xs font-bold text-purple-900">
                            HOLIDAY: {event.reason || "Public Holiday"}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-purple-700 uppercase">
                          Holiday
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
