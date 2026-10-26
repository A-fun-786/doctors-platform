"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Clock, Sun, Sunset, Check, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { TIME_OPTIONS_30M } from "../constants";
import {
  WorkingHoursConfig,
  WorkingHoursShift,
  calculateShiftSlotCount,
  format12Hour,
  saveDoctorWorkingHours,
  timeToMinutes,
} from "../calendarUtils";
import { updateDoctorWorkingHours } from "@/lib/api";

interface EditWorkingHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WorkingHoursConfig;
  onSave: (newConfig: WorkingHoursConfig) => void;
}

export default function EditWorkingHoursModal({
  isOpen,
  onClose,
  config,
  onSave,
}: EditWorkingHoursModalProps) {
  const [shifts, setShifts] = useState<WorkingHoursShift[]>(config.shifts);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setShifts(config.shifts.map((s) => ({ ...s })));
      setError(null);
    }
  }, [isOpen, config]);

  const handleToggleShift = (shiftId: string) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === shiftId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleTimeChange = (
    shiftId: string,
    field: "start" | "end",
    value: string
  ) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === shiftId ? { ...s, [field]: value } : s))
    );
  };

  // Validation & Slot calculation
  const { totalSlots, shiftSlotCounts, validationError } = useMemo(() => {
    let total = 0;
    const counts: Record<string, number> = {};
    let err: string | null = null;

    for (const shift of shifts) {
      if (shift.enabled) {
        const startM = timeToMinutes(shift.start);
        const endM = timeToMinutes(shift.end);

        if (endM <= startM) {
          err = `${shift.label}: End time must be after start time`;
        }
        const count = calculateShiftSlotCount(shift.start, shift.end);
        counts[shift.id] = count;
        total += count;
      } else {
        counts[shift.id] = 0;
      }
    }

    // Check overlap between enabled shifts
    const enabledShifts = shifts.filter((s) => s.enabled);
    if (enabledShifts.length > 1) {
      for (let i = 0; i < enabledShifts.length; i++) {
        for (let j = i + 1; j < enabledShifts.length; j++) {
          const s1 = enabledShifts[i];
          const s2 = enabledShifts[j];
          const s1Start = timeToMinutes(s1.start);
          const s1End = timeToMinutes(s1.end);
          const s2Start = timeToMinutes(s2.start);
          const s2End = timeToMinutes(s2.end);

          if (s1Start < s2End && s1End > s2Start) {
            err = `Conflict: ${s1.label} and ${s2.label} overlap in time`;
          }
        }
      }
    }

    return { totalSlots: total, shiftSlotCounts: counts, validationError: err };
  }, [shifts]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError(null);
    const newConfig: WorkingHoursConfig = {
      shifts,
      closed_days: config.closed_days ?? [0],
    };

    try {
      const updated = await updateDoctorWorkingHours(newConfig);
      saveDoctorWorkingHours(updated);
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      console.error("Failed to persist working hours to server:", err);
      setError(err instanceof Error ? err.message : "Failed to update working hours");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Customize Doctor Working Hours
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure shifts to dynamically recalculate 30-minute calendar slots
          </p>
        </div>
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-6">
        {/* Total Slot Capacity Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold">Total Daily Capacity</span>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
            {totalSlots} slots ({totalSlots * 30} min)
          </span>
        </div>

        {/* Validation Error Banner */}
        {(validationError || error) && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{validationError || error}</span>
          </div>
        )}

        {/* Shifts List */}
        <div className="space-y-4">
          {shifts.map((shift) => {
            const isMorning = shift.id === "morning";
            const slots = shiftSlotCounts[shift.id] || 0;

            return (
              <div
                key={shift.id}
                className={`p-4 rounded-2xl border transition-all duration-200 ${
                  shift.enabled
                    ? "bg-white border-slate-200 shadow-xs"
                    : "bg-slate-50/70 border-slate-200/60 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2.5">
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
                      <h4 className="text-xs font-bold text-slate-900">
                        {shift.label}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {shift.enabled
                          ? `${slots} slots (30 min each)`
                          : "Disabled"}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shift.enabled}
                      onChange={() => handleToggleShift(shift.id)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {shift.enabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                        Start Time
                      </label>
                      <div className="relative">
                        <select
                          value={shift.start}
                          onChange={(e) =>
                            handleTimeChange(shift.id, "start", e.target.value)
                          }
                          className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                          {TIME_OPTIONS_30M.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                        End Time
                      </label>
                      <div className="relative">
                        <select
                          value={shift.end}
                          onChange={(e) =>
                            handleTimeChange(shift.id, "end", e.target.value)
                          }
                          className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                          {TIME_OPTIONS_30M.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!!validationError || isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Working Hours
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
