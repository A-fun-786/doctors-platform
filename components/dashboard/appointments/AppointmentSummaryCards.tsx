import React from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { SummaryCounts, DatePreset } from "./types";

interface AppointmentSummaryCardsProps {
  counts: SummaryCounts;
  statusFilter: string;
  datePreset: DatePreset;
  onSelectTotal: () => void;
  onSelectToday: () => void;
  onSelectUpcoming: () => void;
  onSelectCompleted: () => void;
  onSelectCancelled: () => void;
}

export default function AppointmentSummaryCards({
  counts,
  statusFilter,
  datePreset,
  onSelectTotal,
  onSelectToday,
  onSelectUpcoming,
  onSelectCompleted,
  onSelectCancelled,
}: AppointmentSummaryCardsProps) {
  const isTotalActive = statusFilter === "ALL" && datePreset === "ALL";
  const isTodayActive = datePreset === "TODAY";
  const isUpcomingActive = datePreset === "UPCOMING" || (statusFilter === "BOOKED" && datePreset !== "ALL");
  const isCompletedActive = statusFilter === "COMPLETED";
  const isCancelledActive = statusFilter === "CANCELLED";

  const handleKeyDown = (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* 1. Total Appointments */}
      <div
        onClick={onSelectTotal}
        onKeyDown={handleKeyDown(onSelectTotal)}
        className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
          isTotalActive
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
        role="button"
        tabIndex={0}
        aria-pressed={isTotalActive}
        aria-label={`Total appointments: ${counts.total}. Click to show all.`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
            Total Appointments
          </span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {counts.total}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>12% from last week</span>
        </div>
      </div>

      {/* 2. Today's Appointments */}
      <div
        onClick={onSelectToday}
        onKeyDown={handleKeyDown(onSelectToday)}
        className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
          isTodayActive
            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
        role="button"
        tabIndex={0}
        aria-pressed={isTodayActive}
        aria-label={`Today's appointments: ${counts.today}. Click to filter today.`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
            Today&apos;s Appointments
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/80">
            <CalendarDays className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {counts.today}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>2 more than yesterday</span>
        </div>
      </div>

      {/* 3. Upcoming */}
      <div
        onClick={onSelectUpcoming}
        onKeyDown={handleKeyDown(onSelectUpcoming)}
        className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
          isUpcomingActive
            ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
        role="button"
        tabIndex={0}
        aria-pressed={isUpcomingActive}
        aria-label={`Upcoming appointments: ${counts.upcoming}. Click to filter upcoming.`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
            Upcoming
          </span>
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {counts.upcoming}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-sky-600 font-medium">
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>6 scheduled this week</span>
        </div>
      </div>

      {/* 4. Completed */}
      <div
        onClick={onSelectCompleted}
        onKeyDown={handleKeyDown(onSelectCompleted)}
        className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
          isCompletedActive
            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
        role="button"
        tabIndex={0}
        aria-pressed={isCompletedActive}
        aria-label={`Completed appointments: ${counts.completed}. Click to filter completed.`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
            Completed
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/80">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {counts.completed}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>3 more than last week</span>
        </div>
      </div>

      {/* 5. Cancelled */}
      <div
        onClick={onSelectCancelled}
        onKeyDown={handleKeyDown(onSelectCancelled)}
        className={`col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-400/50 ${
          isCancelledActive
            ? "border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/20"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
        role="button"
        tabIndex={0}
        aria-pressed={isCancelledActive}
        aria-label={`Cancelled appointments: ${counts.cancelled}. Click to filter cancelled.`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 tracking-wider">
            Cancelled
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/80">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {counts.cancelled}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 font-medium">
          <TrendingDown className="w-3 h-3 shrink-0" />
          <span>1 from last week</span>
        </div>
      </div>
    </div>
  );
}
