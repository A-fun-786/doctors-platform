import React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

interface AppointmentPaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function AppointmentPagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 8, 10, 20],
}: AppointmentPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers with windowing
  const getPageNumbers = () => {
    const pages: number[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 3) {
        pages.push(1, 2, 3, 4, 5);
      } else if (safePage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2);
      }
    }
    return pages;
  };

  return (
    <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
      {/* Left: Summary text */}
      <div>
        Showing <span className="font-semibold text-slate-900">{startIndex}</span> –{" "}
        <span className="font-semibold text-slate-900">{endIndex}</span> of{" "}
        <span className="font-semibold text-slate-900">{totalItems}</span> appointments
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Pagination Buttons */}
        <div className="flex items-center gap-1" role="navigation" aria-label="Pagination Navigation">
          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((num) => {
            const isActive = num === safePage;
            return (
              <button
                key={num}
                type="button"
                onClick={() => onPageChange(num)}
                aria-label={`Page ${num}`}
                aria-current={isActive ? "page" : undefined}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {num}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rows per page selector */}
        <div className="relative flex items-center gap-1 text-slate-500 pl-2 border-l border-slate-200">
          <span className="text-[11px] whitespace-nowrap">Rows per page:</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-0 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}
