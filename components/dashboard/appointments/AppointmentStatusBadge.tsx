import React from "react";
import { Check, X } from "lucide-react";
import { AppointmentStatus } from "./types";

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus | string;
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

export default function AppointmentStatusBadge({
  status,
  size = "md",
  className = "",
  showIcon = true,
}: AppointmentStatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  const isBookedOrConfirmed = norm === "BOOKED" || norm === "CONFIRMED";
  const isCompleted = norm === "COMPLETED";
  const isCancelled = norm === "CANCELLED";
  const isPending = norm === "PENDING";
  const isCheckedIn = norm === "CHECKED_IN" || norm === "CHECKED IN";
  const isInProgress = norm === "IN_PROGRESS" || norm === "IN PROGRESS";

  let badgeStyle = "bg-slate-50 text-slate-700 border-slate-200";
  let dotStyle = "bg-slate-400";
  let label = status;

  if (isBookedOrConfirmed) {
    badgeStyle = "bg-emerald-50/90 text-emerald-700 border-emerald-200/90";
    dotStyle = "bg-emerald-500";
    label = norm === "BOOKED" ? "Confirmed" : "Confirmed";
  } else if (isPending) {
    badgeStyle = "bg-amber-50/90 text-amber-700 border-amber-200/90";
    dotStyle = "bg-amber-500 animate-pulse";
    label = "Pending";
  } else if (isCheckedIn) {
    badgeStyle = "bg-cyan-50/90 text-cyan-700 border-cyan-200/90";
    dotStyle = "bg-cyan-500";
    label = "Checked In";
  } else if (isInProgress) {
    badgeStyle = "bg-blue-50/90 text-blue-700 border-blue-200/90";
    dotStyle = "bg-blue-500 animate-pulse";
    label = "In Progress";
  } else if (isCompleted) {
    badgeStyle = "bg-emerald-50/90 text-emerald-700 border-emerald-200/90";
    dotStyle = "bg-emerald-600";
    label = "Completed";
  } else if (isCancelled) {
    badgeStyle = "bg-rose-50/90 text-rose-700 border-rose-200/90";
    dotStyle = "bg-rose-500";
    label = "Cancelled";
  }

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-2 py-0.5 font-medium gap-1"
      : "text-[11px] px-2.5 py-0.5 font-semibold gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-2xs whitespace-nowrap transition-colors ${badgeStyle} ${sizeClasses} ${className}`}
    >
      {showIcon && (
        <>
          {isCompleted ? (
            <Check className="w-3 h-3 text-emerald-600 shrink-0 stroke-[2.5]" />
          ) : isCancelled ? (
            <X className="w-3 h-3 text-rose-500 shrink-0 stroke-[2.5]" />
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyle}`} />
          )}
        </>
      )}
      <span>{label}</span>
    </span>
  );
}
