"use client";

import React from "react";
import { Sun, Sunset, ChevronRight } from "lucide-react";
import { DashboardTabId } from "../../DashboardShell";

interface WorkingHoursCardProps {
  onNavigateTab?: (tab: DashboardTabId) => void;
}

export default function WorkingHoursCard({ onNavigateTab }: WorkingHoursCardProps) {
  const handleClick = () => {
    onNavigateTab?.("schedule");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900">Working Hours</h3>
        <button
          type="button"
          onClick={handleClick}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Edit
        </button>
      </div>

      <div className="space-y-2">
        {/* Shift 1: Morning */}
        <div
          onClick={handleClick}
          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                10:00 AM – 1:00 PM
              </div>
              <div className="text-[11px] text-slate-500">6 slots (30 min each)</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>

        {/* Shift 2: Evening */}
        <div
          onClick={handleClick}
          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <Sunset className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                4:00 PM – 8:00 PM
              </div>
              <div className="text-[11px] text-slate-500">8 slots (30 min each)</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>
      </div>
    </div>
  );
}
