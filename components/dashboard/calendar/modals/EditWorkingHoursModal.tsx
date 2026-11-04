"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Clock, Plus, Trash2, Check, AlertCircle, Loader2, Calendar } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { TIME_OPTIONS_30M } from "../constants";
import {
  WorkingHoursConfig,
  WorkingHoursShift,
  calculateShiftSlotCount,
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
  const [shifts, setShifts] = useState<WorkingHoursShift[]>(config.shifts || []);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialShifts = (config.shifts && config.shifts.length > 0)
        ? config.shifts.map((s) => ({ ...s }))
        : [
          {
            id: "shift_1",
            label: "Schedule 1",
            start: "09:00",
            end: "13:00",
            enabled: true,
          },
        ];
      setShifts(initialShifts);
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

  const handleLabelChange = (shiftId: string, value: string) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === shiftId ? { ...s, label: value } : s))
    );
  };

  const handleAddSchedule = () => {
    if (shifts.length >= 4) {
      setError("Maximum 4 schedule sessions allowed per day.");
      return;
    }

    // Determine smart default start and end based on last shift
    const lastShift = shifts[shifts.length - 1];
    let defStart = "14:00";
    let defEnd = "18:00";

    if (lastShift) {
      const lastEndM = timeToMinutes(lastShift.end);
      let nextStartM = 14 * 60;
      let nextEndM = 18 * 60;

      if (lastEndM < 20 * 60) {
        nextStartM = Math.min(lastEndM + 60, 20 * 60);
        nextEndM = Math.min(nextStartM + 4 * 60, 22 * 60);
      } else if (lastEndM < 21 * 60 + 30) {
        // Prevent clamping down to 20:00 when last shift ends at or after 20:00
        nextStartM = lastEndM + 30;
        nextEndM = Math.min(nextStartM + 2 * 60, 22 * 60);
      } else {
        // Evening window is full; find the first available morning/afternoon slot without overlap
        const isOverlapping = (sM: number, eM: number) =>
          shifts.some((s) => sM < timeToMinutes(s.end) && eM > timeToMinutes(s.start));

        let found = false;
        for (let sM = 8 * 60; sM + 60 <= 22 * 60; sM += 30) {
          const eM = Math.min(sM + 2 * 60, 22 * 60);
          if (!isOverlapping(sM, eM)) {
            nextStartM = sM;
            nextEndM = eM;
            found = true;
            break;
          }
        }
        if (!found) {
          nextStartM = 8 * 60;
          nextEndM = 9 * 60;
        }
      }

      const sH = Math.floor(nextStartM / 60).toString().padStart(2, "0");
      const sM = (nextStartM % 60).toString().padStart(2, "0");
      const eH = Math.floor(nextEndM / 60).toString().padStart(2, "0");
      const eM = (nextEndM % 60).toString().padStart(2, "0");

      if (nextEndM > nextStartM) {
        defStart = `${sH}:${sM}`;
        defEnd = `${eH}:${eM}`;
      }
    }

    const newShift: WorkingHoursShift = {
      id: `shift_${Date.now()}`,
      label: `Schedule ${shifts.length + 1}`,
      start: defStart,
      end: defEnd,
      enabled: true,
    };

    setShifts((prev) => [...prev, newShift]);
    setError(null);
  };

  const handleRemoveSchedule = (shiftId: string) => {
    if (shifts.length <= 1) {
      setError("At least one schedule session is required.");
      return;
    }
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    setError(null);
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
          err = `${shift.label || "Schedule"}: End time must be after start time`;
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
            err = `Conflict: ${s1.label || "Schedule " + (i + 1)} and ${s2.label || "Schedule " + (j + 1)} overlap in time`;
          }
        }
      }
    }

    return {
      totalSlots: total,
      shiftSlotCounts: counts,
      validationError: err,
    };
  }, [shifts]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError(null);

    // Save purely shifts without any breakTime field
    const newConfig: WorkingHoursConfig = {
      shifts,
      closed_days: config.closed_days ?? [0],
    };

    try {
      const updated = await updateDoctorWorkingHours(newConfig);
      const merged: WorkingHoursConfig = {
        ...updated,
        shifts,
        closed_days: config.closed_days ?? [0],
      };
      saveDoctorWorkingHours(merged);
      onSave(merged);
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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Doctor Working Hours & Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Configure daily operating sessions, start & end timings, and slot capacity
            </p>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Total Slot Capacity Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 border border-blue-100 text-blue-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-900">Daily Operating Capacity</span>
              <p className="text-[11px] text-slate-500 font-medium">
                {shifts.filter((s) => s.enabled).length} Active {shifts.filter((s) => s.enabled).length === 1 ? "Session" : "Sessions"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs">
              {totalSlots} slots
            </span>
            <span className="text-[11px] font-semibold text-slate-600 bg-white/80 px-2 py-1 rounded-lg border border-slate-200/80">
              {Math.floor((totalSlots * 30) / 60)}h {(totalSlots * 30) % 60}m
            </span>
          </div>
        </div>

        {/* Validation Error Banner */}
        {(validationError || error) && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{validationError || error}</span>
          </div>
        )}

        {/* Schedules List */}
        <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
          {shifts.map((shift, index) => {
            const slots = shiftSlotCounts[shift.id] || 0;
            const canDelete = shifts.length > 1;
            const startM = timeToMinutes(shift.start);
            const endM = timeToMinutes(shift.end);
            const durationM = Math.max(0, endM - startM);
            const durH = Math.floor(durationM / 60);
            const durRemM = durationM % 60;

            return (
              <div
                key={shift.id}
                className={`p-3.5 rounded-2xl border transition-all duration-200 ${shift.enabled
                    ? "bg-white border-slate-200 shadow-xs hover:border-blue-200"
                    : "bg-slate-50/70 border-slate-200/60 opacity-60"
                  }`}
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 font-bold text-xs">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={shift.label}
                        onChange={(e) => handleLabelChange(shift.id, e.target.value)}
                        placeholder={`Schedule ${index + 1}`}
                        className="text-xs font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-hidden w-full max-w-[200px] transition-all py-0.5"
                      />
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                        shift.enabled
                          ? "bg-blue-50 text-blue-700 border border-blue-100"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {shift.enabled ? `${slots} slots (${durH}h${durRemM ? ` ${durRemM}m` : ""})` : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer" title={shift.enabled ? "Disable schedule" : "Enable schedule"}>
                      <input
                        type="checkbox"
                        checked={shift.enabled}
                        onChange={() => handleToggleShift(shift.id)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>

                    {/* Delete Session Button */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSchedule(shift.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Remove schedule window"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
                          className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
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
                          className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
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

        {/* Add Another Schedule Window Button - Strictly 1 Plus Icon */}
        {shifts.length < 4 && (
          <button
            type="button"
            onClick={handleAddSchedule}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Add Another Schedule Window ({shifts.length}/4)</span>
          </button>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!!validationError || isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Save Working Hours</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
