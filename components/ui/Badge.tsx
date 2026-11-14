import React from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-600 border-red-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  outline: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
