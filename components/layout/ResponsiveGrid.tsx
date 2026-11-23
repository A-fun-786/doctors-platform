import React from "react";

export interface ResponsiveGridProps {
  children: React.ReactNode;
  /** Minimum width for auto-fit columns in pixels. Default is 280px */
  minItemWidth?: number;
  /** Predefined gap sizes: 'sm' (12px-16px), 'md' (16px-24px), 'lg' (24px-32px) */
  gap?: "none" | "sm" | "md" | "lg" | "xl";
  /** Optional explicit column counts per breakpoint if fixed column counts are preferred */
  cols?: {
    base?: 1 | 2;
    sm?: 1 | 2 | 3;
    md?: 1 | 2 | 3 | 4;
    lg?: 1 | 2 | 3 | 4 | 5 | 6;
    xl?: 1 | 2 | 3 | 4 | 5 | 6;
  };
  className?: string;
}

/**
 * Auto-responsive Grid Primitive.
 * Automatically wraps cards, stats, and widgets to fit any screen size
 * (from small phone to ultra-wide) without requiring manual media query management.
 */
export function ResponsiveGrid({
  children,
  minItemWidth = 280,
  gap = "md",
  cols,
  className = "",
}: ResponsiveGridProps) {
  const gapClasses = {
    none: "gap-0",
    sm: "gap-3 sm:gap-4",
    md: "gap-4 sm:gap-6",
    lg: "gap-6 sm:gap-8",
    xl: "gap-8 sm:gap-10",
  };

  if (cols) {
    const colClasses = [
      cols.base ? `grid-cols-${cols.base}` : "grid-cols-1",
      cols.sm ? `sm:grid-cols-${cols.sm}` : "",
      cols.md ? `md:grid-cols-${cols.md}` : "",
      cols.lg ? `lg:grid-cols-${cols.lg}` : "",
      cols.xl ? `xl:grid-cols-${cols.xl}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={`grid w-full ${colClasses} ${gapClasses[gap]} ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`grid w-full ${gapClasses[gap]} ${className}`}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minItemWidth}px), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

export default ResponsiveGrid;
