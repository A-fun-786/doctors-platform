import React from "react";

export type StatusType =
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED"
  | "PENDING"
  | "CONFIRMED"
  | "LEAVE"
  | "HOLIDAY"
  | "BLOCKED"
  | string;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  size?: "sm" | "md";
}

export function getStatusBadgeStyles(status: StatusType): string {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "BOOKED":
    case "CONFIRMED":
      return "bg-brand-50 text-brand-800 border-brand-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CANCELLED":
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200";
    case "PENDING":
    case "LEAVE":
    case "HOLIDAY":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "BLOCKED":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export default function StatusBadge({
  status,
  size = "sm",
  className = "",
  children,
  ...props
}: StatusBadgeProps) {
  const styles = getStatusBadgeStyles(status);
  const sizeStyles =
    size === "sm"
      ? "text-[10px] sm:text-[11px] px-2 py-0.5"
      : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border transition-colors ${styles} ${sizeStyles} ${className}`}
      {...props}
    >
      {children || status}
    </span>
  );
}

