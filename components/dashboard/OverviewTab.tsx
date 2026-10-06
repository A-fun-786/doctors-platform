"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  ClipboardList,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  DoctorMeResponse,
  DoctorProfileResponse,
  AppointmentEntry,
  getDoctorAppointments,
  getDoctorCalendar,
  DoctorCalendarResponse,
} from "@/lib/api";
import { DashboardTabId } from "./DashboardShell";

interface OverviewTabProps {
  doctor: DoctorMeResponse;
  profile: DoctorProfileResponse | null;
  onNavigateTab: (tab: DashboardTabId) => void;
}

export default function OverviewTab({
  doctor,
  profile,
  onNavigateTab,
}: OverviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentEntry[]>([]);
  const [totalBookedCount, setTotalBookedCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [todayAvailableSlots, setTodayAvailableSlots] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let isMounted = true;
    async function loadOverviewData() {
      try {
        setLoading(true);
        setError(null);

        const [todayApptRes, allApptRes, calRes] = await Promise.allSettled([
          getDoctorAppointments({ from: todayStr, to: todayStr }),
          getDoctorAppointments({ page_size: 100 }),
          getDoctorCalendar(todayStr, todayStr),
        ]);

        if (!isMounted) return;

        if (todayApptRes.status === "fulfilled") {
          setTodayAppointments(todayApptRes.value.items || []);
        }

        if (allApptRes.status === "fulfilled") {
          const items = allApptRes.value.items || [];
          const booked = items.filter((a) => a.status === "BOOKED").length;
          const completed = items.filter((a) => a.status === "COMPLETED").length;
          setTotalBookedCount(booked);
          setCompletedCount(completed);
        }

        if (calRes.status === "fulfilled") {
          const day = calRes.value.dates?.[0];
          const available = day?.events?.filter((e) => e.type === "AVAILABLE").length || 0;
          setTodayAvailableSlots(available);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load overview data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOverviewData();
    return () => {
      isMounted = false;
    };
  }, [todayStr]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-600 via-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium border border-white/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Practice Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {doctor.full_name}
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
            Here is your daily operational summary. Manage working hours, view appointments, and monitor patient bookings.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Appointments */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today&apos;s Appointments
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{todayAppointments.length}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Booked for today</p>
          </div>
        </div>

        {/* Card 2: Upcoming Bookings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Upcoming Booked
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{totalBookedCount}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Confirmed appointments</p>
          </div>
        </div>

        {/* Card 3: Completed Appointments */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Consultations finished</p>
          </div>
        </div>

        {/* Card 4: Today's Available Slots */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Slots Today
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{todayAvailableSlots}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Open 30-min windows</p>
          </div>
        </div>
      </div>

      {/* Today's Appointments Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Appointments</h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              {todayStr}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("appointments")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-slate-500 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>Loading appointments...</span>
          </div>
        ) : todayAppointments.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No appointments scheduled for today</p>
            <p className="text-xs text-slate-500">
              When patients book consultations on your public page, they appear here.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab("appointments")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <span>+ Create Appointment</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {appt.start_time} - {appt.end_time}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{appt.patient_name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{appt.patient_contact || "—"}</td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{appt.reason || "General Consultation"}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          appt.status === "BOOKED"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : appt.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab("calendar")}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left flex items-start justify-between group"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
              Operational Calendar
            </h3>
            <p className="text-xs text-slate-500">
              Inspect your unified day and week event stream across slots, leaves, and appointments.
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("schedule")}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left flex items-start justify-between group"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
              Manage Working Hours
            </h3>
            <p className="text-xs text-slate-500">
              Define daily consultation windows and configure leaves, holidays, or blocked slots.
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("profile")}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left flex items-start justify-between group"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
              Practice Profile &amp; Services
            </h3>
            <p className="text-xs text-slate-500">
              Update clinic address, consultation fees, bio, services offered, and photo.
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ExternalLink className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
