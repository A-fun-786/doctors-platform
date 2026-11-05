"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  Stethoscope,
  Search,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
  Plus,
} from "lucide-react";
import { CalendarEvent, Practitioner } from "@/lib/api";
import { format12Hour } from "../calendarUtils";
import { WeekDayItem } from "../types";

interface AgendaViewProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  currentWeekDays: WeekDayItem[];
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onEventClick: (event: CalendarEvent, date: string) => void;
  onBookAppointment: () => void;
  practitioners?: Practitioner[];
  selectedPractitionerId?: string | null;
  onPractitionerChange?: (staffId: string | null) => void;
  onCompleteAppointment?: (appointmentId: string) => Promise<void> | void;
}

type StatusFilter = "ALL" | "BOOKED" | "COMPLETED";

export default function AgendaView({
  selectedDate,
  onSelectDate: _onSelectDate,
  currentWeekDays: _currentWeekDays,
  getEventsForDate,
  onEventClick,
  onBookAppointment,
  selectedPractitionerId = null,
}: AgendaViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Collect appointment events for the active date (driven by top date picker)
  const relevantEvents = useMemo(() => {
    const activeDate = selectedDate || todayStr;
    const evs = getEventsForDate(activeDate);
    const raw = evs.map((e) => ({ date: activeDate, event: e }));

    // Filter to real appointments only (exclude LEAVE, HOLIDAY, BLOCKED from agenda list)
    return raw.filter((item) => item.event.type === "APPOINTMENT");
  }, [selectedDate, todayStr, getEventsForDate]);

  // Apply filters (search, status, practitioner)
  const filteredEvents = useMemo(() => {
    return relevantEvents.filter(({ event }) => {
      // Practitioner filter
      if (selectedPractitionerId) {
        if (selectedPractitionerId === "PRIMARY") {
          if (event.staff_id !== null && event.staff_id !== undefined) return false;
        } else {
          if (event.staff_id !== selectedPractitionerId) return false;
        }
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const s = (event.status || "BOOKED").toUpperCase();
        if (s !== statusFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (event.patient_name || "").toLowerCase();
        const contact = (event.patient_contact || "").toLowerCase();
        const reason = (event.reason || "").toLowerCase();
        const doc = (event.doctor_name || "").toLowerCase();
        if (!pName.includes(q) && !contact.includes(q) && !reason.includes(q) && !doc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [relevantEvents, selectedPractitionerId, statusFilter, searchQuery]);

  // Sort chronologically by start_time
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      return (a.event.start || "").localeCompare(b.event.start || "");
    });
  }, [filteredEvents]);

  // Quick statistics counters
  const totalCount = relevantEvents.length;
  const bookedCount = relevantEvents.filter(
    (i) => (i.event.status || "BOOKED").toUpperCase() === "BOOKED"
  ).length;
  const completedCount = relevantEvents.filter(
    (i) => (i.event.status || "").toUpperCase() === "COMPLETED"
  ).length;

  return (
    <div className="w-full bg-white select-none">
      {/* Streamlined Clinic Filter Toolbar (Second Row: Status tabs & Search) */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Status Filter Tabs */}
        <div className="inline-flex items-center p-0.5 bg-white border border-slate-200 rounded-xl shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
              statusFilter === "ALL"
                ? "bg-brand-50 text-brand-700 font-bold border border-brand-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("BOOKED")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
              statusFilter === "BOOKED"
                ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Confirmed ({bookedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
              statusFilter === "COMPLETED"
                ? "bg-slate-200 text-slate-800 font-bold border border-slate-300"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Right: Search Input & Count Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient or phone..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <span className="hidden sm:inline-flex text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-2xs whitespace-nowrap shrink-0">
            {sortedEvents.length} {sortedEvents.length === 1 ? "Appointment" : "Appointments"}
          </span>
        </div>
      </div>

      {/* Appointment Table (Strictly No Horizontal Scrolling) */}
      {sortedEvents.length === 0 ? (
        <div className="py-16 px-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">No appointments found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No patients match "${searchQuery}". Try adjusting your search query.`
                : "No patient visits scheduled for this date. Click below to book an appointment."}
            </p>
          </div>
          <button
            type="button"
            onClick={onBookAppointment}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book Appointment</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-hidden overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-335px)] min-h-[380px] custom-scrollbar w-full">
          <table className="w-full table-fixed text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 shadow-2xs">
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3 sm:px-4 bg-slate-50 w-28 sm:w-36">Time</th>
                <th className="py-3 px-3 sm:px-4 bg-slate-50">Patient</th>
                <th className="py-3 px-3 sm:px-4 bg-slate-50 hidden md:table-cell w-36 lg:w-44">Doctor</th>
                <th className="py-3 px-2 sm:px-3 bg-slate-50 text-center w-24 sm:w-28">Status</th>
                <th className="py-3 px-3 sm:px-4 bg-slate-50 text-right w-16 sm:w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedEvents.map(({ date, event }, idx) => {
                const patientName = event.patient_name || "Patient";
                const docName = event.doctor_name || event.staff_name || "Primary Doctor";
                const isCompleted = (event.status || "").toUpperCase() === "COMPLETED";

                return (
                  <tr
                    key={event.appointment_id || idx}
                    onClick={() => onEventClick(event, date)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Time */}
                    <td className="py-3.5 px-3 sm:px-4 align-middle">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0 hidden xs:inline" />
                        <span>{format12Hour(event.start)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                        30 mins
                      </div>
                    </td>

                    {/* Patient */}
                    <td className="py-3.5 px-3 sm:px-4 align-middle min-w-0">
                      <div className="font-bold text-slate-900 text-xs group-hover:text-brand-700 transition-colors truncate">
                        {patientName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                        {event.patient_contact && (
                          <span className="truncate">{event.patient_contact}</span>
                        )}
                        {/* On screens where Doctor column is hidden, display doctor inline */}
                        <span className="md:hidden text-slate-400 truncate">
                          {event.patient_contact ? "• " : ""}{docName}
                        </span>
                      </div>
                    </td>

                    {/* Doctor (hidden on mobile, visible on md+) */}
                    <td className="py-3.5 px-3 sm:px-4 align-middle hidden md:table-cell min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 max-w-full truncate">
                        <Stethoscope className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="truncate">{docName}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-2 sm:px-3 text-center align-middle whitespace-nowrap">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="hidden xs:inline">Completed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="hidden xs:inline">Confirmed</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-3 sm:px-4 text-right align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-brand-600 transition-colors">
                        <span className="hidden sm:inline">View</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-slate-400 group-hover:text-brand-600" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
