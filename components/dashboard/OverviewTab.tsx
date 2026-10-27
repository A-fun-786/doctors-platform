"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
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
} from "@/lib/api";
import { DashboardTabId } from "./DashboardShell";
import { ResponsiveGrid, AdaptiveStack, AdaptiveDataView } from "@/components/layout";

interface OverviewTabProps {
  doctor: DoctorMeResponse;
  profile: DoctorProfileResponse | null;
  onNavigateTab: (tab: DashboardTabId) => void;
}

export default function OverviewTab({
  doctor,
  profile: _profile,
  onNavigateTab,
}: OverviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentEntry[]>([]);
  const [totalBookedCount, setTotalBookedCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let isMounted = true;
    async function loadOverviewData() {
      try {
        setLoading(true);
        setError(null);

        const [todayApptRes, allApptRes] = await Promise.allSettled([
          getDoctorAppointments({ from: todayStr, to: todayStr }),
          getDoctorAppointments({ page_size: 100 }),
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
      <div className="bg-gradient-to-r from-brand-600 via-blue-600 to-indigo-700 rounded-2xl p-5 sm:p-7 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium border border-white/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Practice Active</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
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

      {/* ── Smart KPI Grid ──
           3 cards → 3 cols (1 row)
           4 cards → 2 cols (2×2)
           5 cards → 3 cols (3+2)
           6 cards → 3 cols (3×3)
           Mobile  → 1 col, horizontal card layout
      */}
      {(() => {
        const colorMap: Record<string, { bg: string; text: string }> = {
          blue:    { bg: "bg-blue-50",    text: "text-blue-600"    },
          indigo:  { bg: "bg-indigo-50",  text: "text-indigo-600"  },
          emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
          amber:   { bg: "bg-amber-50",   text: "text-amber-600"   },
          rose:    { bg: "bg-rose-50",    text: "text-rose-600"    },
          violet:  { bg: "bg-violet-50",  text: "text-violet-600"  },
        };

        const kpiCards = [
          {
            id: "today",
            label: "Today's Appointments",
            sublabel: "Booked for today",
            value: todayAppointments.length,
            Icon: Calendar,
            color: "blue",
          },
          {
            id: "booked",
            label: "Upcoming Booked",
            sublabel: "Confirmed appointments",
            value: totalBookedCount,
            Icon: ClipboardList,
            color: "indigo",
          },
          {
            id: "completed",
            label: "Completed",
            sublabel: "Consultations finished",
            value: completedCount,
            Icon: UserCheck,
            color: "emerald",
          },
          // 👇 Future cards — uncomment to test layouts:
          // { id: "cancelled", label: "Cancelled",  sublabel: "Appointments cancelled", value: 0, Icon: AlertCircle, color: "rose"   },
          // { id: "noshow",    label: "No-shows",   sublabel: "Patients did not arrive", value: 0, Icon: UserCheck,   color: "amber"  },
          // { id: "reschedule",label: "Rescheduled",sublabel: "Moved to new slot",       value: 0, Icon: CalendarDays,color: "violet" },
        ];

        const n = kpiCards.length;

        // Same grid logic on ALL screens (mobile + desktop):
        // 3 → 3 cols (1 row)
        // 4 → 2 cols (2×2)
        // 5 → 3 cols (3+2)
        // 6 → 3 cols (3×3)
        const colsClass = n === 4 ? "grid-cols-2" : "grid-cols-3";

        return (
          <div className={`grid ${colsClass} gap-2 sm:gap-4`}>
            {kpiCards.map(({ id, label, sublabel, value, Icon, color }) => {
              const { bg, text } = colorMap[color] ?? colorMap.blue;
              return (
                <div
                  key={id}
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs
                             p-2.5 sm:p-5
                             flex flex-col items-center text-center gap-1 sm:gap-2"
                >
                  {/* Icon */}
                  <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${bg} ${text} flex items-center justify-center shrink-0`}>
                    <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </div>

                  {/* Number */}
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : (
                    <p className="text-lg sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
                      {value}
                    </p>
                  )}

                  {/* Label */}
                  <p className="text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-tight line-clamp-2">
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Today's Appointments Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
        <AdaptiveStack align="between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Appointments</h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              {todayStr}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("appointment")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            <span>View Full Calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </AdaptiveStack>

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
                onClick={() => onNavigateTab("appointment")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <span>View Calendar</span>
              </button>
            </div>
          </div>
        ) : (
          /* Dual-Mode Adaptive Data View (Laptop Table <-> Mobile Cards) */
          <AdaptiveDataView<AppointmentEntry>
            data={todayAppointments}
            renderDesktopTable={() => (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {appt.start_time} - {appt.end_time}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{appt.patient_name}</td>
                      <td className="py-3 px-4 text-slate-600">{appt.patient_contact || "â€”"}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{appt.reason || "General Consultation"}</td>
                      <td className="py-3 px-4">
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
            )}
            renderMobileCard={(appt) => (
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{appt.patient_name}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      appt.status === "BOOKED"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : appt.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center justify-between">
                  <span className="font-semibold text-brand-700">ðŸ•’ {appt.start_time} - {appt.end_time}</span>
                  <span className="text-slate-500">{appt.patient_contact || "No phone"}</span>
                </div>
                {appt.reason && (
                  <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                    {appt.reason}
                  </p>
                )}
              </div>
            )}
          />
        )}
      </div>

      {/* Auto-Responsive Quick Actions Grid */}
      <ResponsiveGrid minItemWidth={260} gap="md">
        <button
          type="button"
          onClick={() => onNavigateTab("appointment")}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-md transition-all text-left flex items-start justify-between group"
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
          onClick={() => onNavigateTab("profile")}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-brand-300 hover:shadow-md transition-all text-left flex items-start justify-between group"
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
      </ResponsiveGrid>
    </div>
  );
}
