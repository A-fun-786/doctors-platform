import React from "react";

export interface AdaptiveStackProps {
  children: React.ReactNode;
  /** Breakpoint where stack switches to row. Defaults to 'md' (768px) */
  breakpoint?: "sm" | "md" | "lg";
  /** Reverse order on mobile screens */
  reverseOnMobile?: boolean;
  /** Alignment on larger screens */
  align?: "start" | "center" | "end" | "between";
  /** Gap between children */
  gap?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Adaptive Stack Primitive.
 * Stacks children vertically on mobile devices, and switches to a horizontal row on tablets/laptops.
 * Ideal for headers, filter bars, action bars, and search blocks.
 */
export function AdaptiveStack({
  children,
  breakpoint = "md",
  reverseOnMobile = false,
  align = "between",
  gap = "md",
  className = "",
}: AdaptiveStackProps) {
  const breakpointFlex = {
    sm: "sm:flex-row sm:items-center",
    md: "md:flex-row md:items-center",
    lg: "lg:flex-row lg:items-center",
  };

  const alignments = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
  };

  const gapClasses = {
    sm: "gap-2 sm:gap-3",
    md: "gap-3 sm:gap-4",
    lg: "gap-4 sm:gap-6",
  };

  const baseDirection = reverseOnMobile ? "flex-col-reverse" : "flex-col";

  return (
    <div
      className={`flex ${baseDirection} ${breakpointFlex[breakpoint]} ${alignments[align]} ${gapClasses[gap]} w-full ${className}`}
    >
      {children}
    </div>
  );
}

export default AdaptiveStack;
