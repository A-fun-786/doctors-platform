"use client";

import React from "react";

export interface AdaptiveDataViewProps<T> {
  /** Array of data items to render */
  data: T[];
  /** Render function for desktop/tablet table view */
  renderDesktopTable: () => React.ReactNode;
  /** Optional custom card renderer for mobile screens (< 768px). If omitted, table scrolls horizontally with protection */
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  /** Empty state message or component */
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * Adaptive Data View Primitive.
 * Renders an expansive Table layout on desktop/laptop, and automatically switches to
 * touch-friendly Cards on mobile screens (or wraps table in an isolated safe scroll container).
 */
export function AdaptiveDataView<T>({
  data,
  renderDesktopTable,
  renderMobileCard,
  emptyState,
  className = "",
}: AdaptiveDataViewProps<T>) {
  if (!data || data.length === 0) {
    return (
      emptyState || (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
          No records found.
        </div>
      )
    );
  }

  // If mobile card renderer is provided, use dual-view strategy
  if (renderMobileCard) {
    return (
      <div className={`w-full ${className}`}>
        {/* Mobile Card List (< md) */}
        <div className="md:hidden flex flex-col gap-3">
          {data.map((item, idx) => (
            <div key={idx}>{renderMobileCard(item, idx)}</div>
          ))}
        </div>

        {/* Desktop / Laptop Table (>= md) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          {renderDesktopTable()}
        </div>
      </div>
    );
  }

  // Fallback: Isolated horizontal scroll wrapper with subtle indicator
  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs ${className}`}>
      <div className="overflow-x-auto custom-scrollbar w-full">
        <div className="min-w-full inline-block align-middle">
          {renderDesktopTable()}
        </div>
      </div>
    </div>
  );
}

export default AdaptiveDataView;
