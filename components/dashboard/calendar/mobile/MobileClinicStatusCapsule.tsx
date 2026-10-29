"use client";

import React, { useMemo } from "react";
import { Clock, ChevronRight, Sun, Sunset, Coffee } from "lucide-react";
import {
  WorkingHoursConfig,
  DEFAULT_WORKING_HOURS,
  format12Hour,
  timeToMinutes,
  getDoctorBreakInterval,
} from "../calendarUtils";

interface MobileClinicStatusCapsuleProps {
  config?: WorkingHoursConfig;
  onOpenHoursSheet: () => void;
}

export default function MobileClinicStatusCapsule({
  config = DEFAULT_WORKING_HOURS,
  onOpenHoursSheet,
}: MobileClinicStatusCapsuleProps) {
  const shifts = config.shifts || DEFAULT_WORKING_HOURS.shifts;

  // Determine current active shift / status based on current time
  const statusInfo = useMemo(() => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const enabledShifts = shifts.filter((s) => s.enabled);
    if (enabledShifts.length === 0) {
      return {
        type: "off",
        label: "Clinic Closed",
        subtext: "No active shifts today",
        badgeColor: "bg-slate-400",
        pulse: false,
        icon: Clock,
      };
    }

    // Check if in active shift
    for (const shift of enabledShifts) {
      const startM = timeToMinutes(shift.start);
      const endM = timeToMinutes(shift.end);
      if (currentMins >= startM && currentMins < endM) {
        return {
          type: "active",
          label: `In Shift: ${shift.label || (shift.id === "morning" ? "Morning Shift" : "Evening Shift")}`,
          subtext: `${format12Hour(shift.start)} – ${format12Hour(shift.end)}`,
          badgeColor: "bg-emerald-500",
          pulse: true,
          icon: shift.id === "morning" ? Sun : Sunset,
        };
      }
    }

    // Check if in break
    const breakInterval = getDoctorBreakInterval(config);
    if (breakInterval && breakInterval.enabled) {
      const bStart = timeToMinutes(breakInterval.start);
      const bEnd = timeToMinutes(breakInterval.end);
      if (currentMins >= bStart && currentMins < bEnd) {
        return {
          type: "break",
          label: "In Break",
          subtext: `${breakInterval.startLabel} – ${breakInterval.endLabel}`,
          badgeColor: "bg-amber-500",
          pulse: false,
          icon: Coffee,
        };
      }
    }

    // Find next upcoming shift today
    const upcoming = enabledShifts.find((s) => timeToMinutes(s.start) > currentMins);
    if (upcoming) {
      return {
        type: "upcoming",
        label: `Next: ${upcoming.label || (upcoming.id === "morning" ? "Morning Shift" : "Evening Shift")}`,
        subtext: `Starts ${format12Hour(upcoming.start)}`,
        badgeColor: "bg-blue-500",
        pulse: false,
        icon: upcoming.id === "morning" ? Sun : Sunset,
      };
    }

    // Past all shifts today
    return {
      type: "closed",
      label: "Clinic Closed",
      subtext: `Next shift tomorrow at ${format12Hour(enabledShifts[0].start)}`,
      badgeColor: "bg-slate-400",
      pulse: false,
      icon: Clock,
    };
  }, [shifts, config]);

  const StatusIcon = statusInfo.icon;

  return (
    <button
      type="button"
      onClick={onOpenHoursSheet}
      className="w-full flex items-center justify-between p-2.5 sm:p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80 hover:border-blue-200 rounded-2xl shadow-2xs text-left active:scale-[0.99] transition-all cursor-pointer group"
      title="Tap to view working hours"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Pulsing indicator */}
        <div className="relative flex items-center justify-center shrink-0 w-8 h-8 rounded-xl bg-white shadow-2xs border border-blue-100">
          <StatusIcon className="w-4 h-4 text-blue-600" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            {statusInfo.pulse && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusInfo.badgeColor}`}
            />
          </span>
        </div>

        {/* Text Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900 tracking-tight">
              {statusInfo.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{statusInfo.subtext}</p>
        </div>
      </div>

      {/* Action CTA */}
      <div className="flex items-center gap-1 pl-2 shrink-0">
        <span className="text-[11px] font-semibold text-blue-600 group-hover:text-blue-700 hidden xs:inline">
          Hours & Shifts
        </span>
        <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}
