"use client";

import React from "react";
import { Clock, Edit2, Sparkles } from "lucide-react";
import {
  WorkingHoursConfig,
  DEFAULT_WORKING_HOURS,
  format12Hour,
  calculateShiftSlotCount,
  timeToMinutes,
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
  const enabledShifts = shifts.filter((s) => s.enabled);

  const totalSlots = enabledShifts.reduce(
    (sum, shift) => sum + calculateShiftSlotCount(shift.start, shift.end),
    0
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">Working Hours</h3>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {enabledShifts.length} {enabledShifts.length === 1 ? "Shift" : "Shifts"} Active
            </span>
          </div>
        </div>

        {onEditHours && (
          <button
            type="button"
            onClick={onEditHours}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 px-2.5 py-1 rounded-lg border border-blue-100 transition-all cursor-pointer shadow-2xs"
            title="Edit Working Hours"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Shifts List */}
      <div className="space-y-2">
        {enabledShifts.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No operating shifts configured.
          </div>
        ) : (
          enabledShifts.map((shift, index) => {
            const slots = calculateShiftSlotCount(shift.start, shift.end);
            const start12 = format12Hour(shift.start);
            const end12 = format12Hour(shift.end);
            const startM = timeToMinutes(shift.start);
            const endM = timeToMinutes(shift.end);
            const durH = Math.floor((endM - startM) / 60);

            return (
              <div
                key={shift.id || index}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/30 border border-slate-100 hover:border-blue-200 transition-all duration-150"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-white text-slate-700 border border-slate-200/80 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {shift.label || `Schedule ${index + 1}`}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium font-mono">
                      {start12} – {end12}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 block">
                    {slots} slots
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    {durH} hrs
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Daily Total Capacity Capsule */}
      {enabledShifts.length > 0 && (
        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium px-0.5">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            Total Capacity:
          </span>
          <span className="font-bold text-slate-800">
            {totalSlots} slots ({Math.floor((totalSlots * 30) / 60)}h)
          </span>
        </div>
      )}
    </div>
  );
}
