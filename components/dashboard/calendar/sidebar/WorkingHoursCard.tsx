"use client";

import React from "react";
import { Sun, Sunset, Edit2 } from "lucide-react";
import {
  WorkingHoursConfig,
  DEFAULT_WORKING_HOURS,
  format12Hour,
  calculateShiftSlotCount,
} from "../calendarUtils";

interface WorkingHoursCardProps {
  config?: WorkingHoursConfig;
  onEditHours?: () => void;
}

export default function WorkingHoursCard({
  config = DEFAULT_WORKING_HOURS,
  onEditHours,
}: WorkingHoursCardProps) {
  const shifts = config.shifts || DEFAULT_WORKING_HOURS.shifts;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900">Working Hours</h3>
        {onEditHours && (
          <button
            type="button"
            onClick={onEditHours}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-all"
            title="Edit Working Hours"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit Hours</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {shifts.map((shift) => {
          if (!shift.enabled) return null;
          const isMorning = shift.id === "morning";
          const slots = calculateShiftSlotCount(shift.start, shift.end);
          const start12 = format12Hour(shift.start);
          const end12 = format12Hour(shift.end);

          return (
            <div
              key={shift.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isMorning
                      ? "bg-amber-50 text-amber-500"
                      : "bg-orange-50 text-orange-500"
                  }`}
                >
                  {isMorning ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Sunset className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {start12} – {end12}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {slots} slots (30 min each)
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
