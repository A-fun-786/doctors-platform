"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  ClipboardList,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Loader2,
  User,
  Clock,
} from "lucide-react";
import {
  DoctorMeResponse,
  DoctorProfileResponse,
  AppointmentEntry,
  getDoctorAppointments,
  isDoctorRole,
} from "@/lib/api";
import { formatDateToYYYYMMDD } from "./calendar/calendarUtils";
import { DashboardTabId } from "./DashboardShell";
import { ResponsiveGrid, AdaptiveStack, AdaptiveDataView } from "@/components/layout";

function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case "BOOKED":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
}

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
  const [error, setError] = useState<string | null>(null);

  const isStaff = doctor.user_type === "staff";
  const isStaffDoctor = isStaff && isDoctorRole(doctor.role);
  const isNonDoctorStaff = isStaff && !isStaffDoctor;

  // Maintain local calendar date state, initialized to current date ("now")
  const [todayStr, setTodayStr] = useState<string>(() =>
    formatDateToYYYYMMDD(new Date())
  );

  const formattedDoctorName = useMemo(() => {
    const name = doctor.full_name?.trim() || "User";
    if (isNonDoctorStaff) return name;
    return name.toLowerCase().startsWith("dr.") ? name : `Dr. ${name}`;
  }, [doctor.full_name, isNonDoctorStaff]);

  const bannerBadgeText = useMemo(() => {
    if (!isStaff) return "Practice Active";
    const roleLabel = doctor.role?.trim() || (isStaffDoctor ? "Staff Doctor" : "Clinic Staff");
    const contextLabel = isStaffDoctor
      ? doctor.speciality?.trim() || profile?.clinic_name?.trim() || "Clinic Team"
      : profile?.clinic_name?.trim() || "Clinic Operations";
    return `${roleLabel} • ${contextLabel}`;
  }, [isStaff, isStaffDoctor, doctor.role, doctor.speciality, profile?.clinic_name]);

  const bannerSubtitle = useMemo(() => {
    if (isStaffDoctor) {
      return "Here is your personal consultation summary for today. Review your assigned patients and track completed visits.";
    }
    if (isNonDoctorStaff) {
      return "Here is today's clinic operational summary. Coordinate patient check-ins, manage bookings, and monitor doctor schedules.";
    }
    return "Here is your daily operational summary. Manage working hours, view appointments, and monitor patient bookings.";
  }, [isStaffDoctor, isNonDoctorStaff]);

  useEffect(() => {
    let isMounted = true;
    async function loadOverviewData() {
      try {
        setLoading(true);
        setError(null);

        // Re-evaluate current local date on every refresh
        const currentToday = formatDateToYYYYMMDD(new Date());
        setTodayStr(currentToday);

        // Scalable server-side counting with O(1) payload size
        const [todayApptRes, bookedApptRes, completedApptRes] = await Promise.allSettled([
          getDoctorAppointments({ from: currentToday, to: currentToday, page_size: 100 }),
          getDoctorAppointments({ status: "BOOKED", page_size: 1 }),
          getDoctorAppointments({ status: "COMPLETED", page_size: 1 }),
        ]);

        if (!isMounted) return;

        const fetchErrors: string[] = [];

        if (todayApptRes.status === "fulfilled") {
          setTodayAppointments(todayApptRes.value.items || []);
        } else {
          fetchErrors.push(todayApptRes.reason?.message || "Failed to load today's appointments");
        }

        if (bookedApptRes.status === "fulfilled") {
          setTotalBookedCount(bookedApptRes.value.total ?? 0);
        } else {
          fetchErrors.push(bookedApptRes.reason?.message || "Failed to load booked appointment count");
        }

        if (completedApptRes.status === "fulfilled") {
          setCompletedCount(completedApptRes.value.total ?? 0);
        } else {
          fetchErrors.push(completedApptRes.reason?.message || "Failed to load completed appointment count");
        }

        if (fetchErrors.length > 0) {
          setError(fetchErrors[0]);
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
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-800 rounded-2xl p-5 sm:p-7 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium border border-white/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-300 shrink-0" />
            <span className="truncate">{bannerBadgeText}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {formattedDoctorName}
          </h1>
          <p className="text-brand-100 text-xs sm:text-sm leading-relaxed">
            {bannerSubtitle}
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
        blue: { bg: "bg-brand-50", text: "text-brand-700" },
        indigo: { bg: "bg-emerald-50", text: "text-emerald-700" },
        emerald: { bg: "bg-teal-50", text: "text-teal-700" },
        amber: { bg: "bg-amber-50", text: "text-amber-700" },
        rose: { bg: "bg-rose-50", text: "text-rose-700" },
        violet: { bg: "bg-slate-100", text: "text-slate-700" },
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
                className="bg-white border border-slate-200 shadow-xs rounded-xl sm:rounded-2xl
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

                {/* Label & Sublabel */}
                <p className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-tight">
                  {label}
                </p>
                <p className="hidden sm:block text-[11px] text-slate-400">
                  {sublabel}
                </p>
              </div>
            );
          })}
        </div>
      );
    })()}

      {/* Today's Appointments Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
        <AdaptiveStack align="between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900">
              {isStaffDoctor ? "My Today's Appointments" : "Today's Appointments"}
            </h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              {todayStr}
            </span>
            {isStaff && (
              <span className="text-[11px] bg-brand-50 text-brand-700 border border-brand-200/70 font-semibold px-2 py-0.5 rounded-full">
                {isStaffDoctor ? "Assigned to You" : "All Practitioners"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("appointment")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            <span>{isNonDoctorStaff ? "Manage Appointments" : "View Full Calendar"}</span>
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
            <p className="text-xs font-semibold text-slate-700">
              {isStaffDoctor
                ? "No appointments assigned to you for today"
                : "No appointments scheduled for today"}
            </p>
            <p className="text-xs text-slate-500">
              {isStaffDoctor
                ? "Consultations assigned to you by reception or booked with you will appear here."
                : isNonDoctorStaff
                ? "When patients book consultations or reception schedules a visit, they appear here."
                : "When patients book consultations on your public page, they appear here."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab("appointment")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <span>{isNonDoctorStaff ? "Open Appointments" : "View Calendar"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Dual-Mode Adaptive Data View (Laptop Table <-> Mobile Cards) */
          <AdaptiveDataView<AppointmentEntry>
            data={todayAppointments}
            renderDesktopTable={() => (
              <table className="w-full text-left text-xs" aria-label="Today's Appointments">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Patient</th>
                    {!isStaffDoctor && <th className="py-3 px-4">Doctor</th>}
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAppointments.map((appt) => {
                    const practitionerName = appt.staff_name || appt.doctor_name || "Primary Doctor";
                    return (
                      <tr key={appt.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {appt.start_time} - {appt.end_time}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{appt.patient_name}</td>
                        {!isStaffDoctor && (
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {practitionerName}
                          </td>
                        )}
                        <td className="py-3 px-4 text-slate-600">{appt.patient_contact || "—"}</td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{appt.reason || "General Consultation"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeStyle(
                              appt.status
                            )}`}
                          >
                            {appt.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            renderMobileCard={(appt) => {
              const practitionerName = appt.staff_name || appt.doctor_name || "Primary Doctor";
              return (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">{appt.patient_name}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeStyle(
                        appt.status
                      )}`}
                    >
                      {appt.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center justify-between gap-2">
                    <span className="font-semibold text-brand-700 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> {appt.start_time} - {appt.end_time}
                    </span>
                    <span className="text-slate-500 truncate">{appt.patient_contact || "No phone"}</span>
                  </div>
                  {!isStaffDoctor && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-1">
                      <span className="font-medium text-slate-500">Doctor:</span>
                      <span className="font-semibold text-slate-800 truncate">{practitionerName}</span>
                    </div>
                  )}
                  {appt.reason && (
                    <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                      {appt.reason}
                    </p>
                  )}
                </div>
              );
            }}
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
              {isNonDoctorStaff ? "Manage Appointments" : "Operational Calendar"}
            </h3>
            <p className="text-xs text-slate-500">
              {isStaffDoctor
                ? "View your assigned consultations and mark completed patient visits."
                : isNonDoctorStaff
                ? "Schedule patient visits, manage bookings, and coordinate doctor calendars."
                : "Inspect your unified day and week event stream across slots, leaves, and appointments."}
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
              {isStaff ? "My Profile" : "Admin Profile"}
            </h3>
            <p className="text-xs text-slate-500">
              {isStaff
                ? "View your personal staff profile, role details, and account settings."
                : "Update clinic address, consultation fees, bio, services offered, and photo."}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
        </button>
      </ResponsiveGrid>
    </div>
  );
}
