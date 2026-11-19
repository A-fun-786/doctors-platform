import React from "react";
import Badge, { BadgeVariant, VARIANT_STYLES } from "./Badge";
import { cn } from "@/lib/utils";

export type StatusType =
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED"
  | "PENDING"
  | "CONFIRMED"
  | "LEAVE"
  | "HOLIDAY"
  | "BLOCKED"
  | (string & {});

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  size?: "sm" | "md";
}

/**
 * Maps appointment/schedule statuses to design system Badge variants.
 */
export function getStatusBadgeVariant(status: StatusType): BadgeVariant {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "BOOKED":
    case "CONFIRMED":
      return "default";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
    case "REJECTED":
      return "danger";
    case "PENDING":
    case "LEAVE":
    case "HOLIDAY":
      return "warning";
    case "BLOCKED":
      return "purple";
    default:
      return "outline";
  }
}

/**
 * Backward-compatible helper returning the color token string for a status.
 * Reuses single-source-of-truth tokens from Badge.tsx.
 */
export function getStatusBadgeStyles(status: StatusType): string {
  const variant = getStatusBadgeVariant(status);
  return VARIANT_STYLES[variant];
}

export default function StatusBadge({
  status,
  size = "sm",
  className = "",
  children,
  ...props
}: StatusBadgeProps) {
  const variant = getStatusBadgeVariant(status);
  const sizeStyles =
    size === "sm"
      ? "text-[10px] sm:text-[11px] px-2 py-0.5"
      : "text-xs px-2.5 py-1";

  return (
    <Badge
      variant={variant}
      className={cn("font-semibold rounded-full", sizeStyles, className)}
      {...props}
    >
      {children || status}
    </Badge>
  );
}
