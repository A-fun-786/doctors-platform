"use client";

import React, { useMemo } from "react";
import { Loader2, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { CalendarEvent } from "@/lib/api";
import { TIME_OPTIONS_30M } from "../constants";
import {
  format12Hour,
  timeToMinutes,
  addMinutesToTime,
  findConflictingEvents,
} from "../calendarUtils";

interface AddAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  setDate: (d: string) => void;
  startTime: string;
  setStartTime: (t: string) => void;
  endTime: string;
  setEndTime: (t: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  existingEvents?: CalendarEvent[];
}

export default function AddAvailabilityModal({
  isOpen,
  onClose,
  date,
  setDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  submitting,
  onSubmit,
  existingEvents = [],
}: AddAvailabilityModalProps) {
  // When start time changes, ensure end time is at least start + 30m
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (timeToMinutes(endTime) <= timeToMinutes(newStart)) {
      setEndTime(addMinutesToTime(newStart, 30));
    }
  };
  // Compute duration and number of 30-minute slots created
  const { durationMinutes, numSlots, isInvalidRange } = useMemo(() => {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);
    const diff = endM - startM;
    return {
      durationMinutes: diff,
      numSlots: Math.max(0, Math.floor(diff / 30)),
      isInvalidRange: diff <= 0,
    };
  }, [startTime, endTime]);

  // Check if this availability window overlaps with any Doctor Leave or Holiday
  const leaveConflicts = useMemo(() => {
    if (isInvalidRange) return [];
    return findConflictingEvents(startTime, endTime, existingEvents).filter(
      (e) => e.type === "LEAVE" || e.type === "HOLIDAY"
    );
  }, [startTime, endTime, existingEvents, isInvalidRange]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Doctor Availability">
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            required
          />
        </div>

        {/* 30-Minute Range Selectors */}
        <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Availability Hours (30m Increments)</span>
            </div>
            {!isInvalidRange && numSlots > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {numSlots} {numSlots === 1 ? "Slot" : "Slots"} ({numSlots * 30} mins)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Start Time
              </label>
              <select
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              >
                {TIME_OPTIONS_30M.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                End Time
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              >
                {TIME_OPTIONS_30M.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Validation Alert: Invalid Range */}
        {isInvalidRange && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>End Time must be after Start Time.</span>
          </div>
        )}

        {/* Validation Alert: Doctor Leave Conflict */}
        {leaveConflicts.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
            <div className="flex items-start gap-2 text-amber-900 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Overlap with Doctor Leave</span>
            </div>
            <div className="text-[11px] text-amber-700 pl-6">
              Doctor has a scheduled leave or clinic holiday ({format12Hour(leaveConflicts[0].start)} – {format12Hour(leaveConflicts[0].end)}).
              The system will automatically exclude those slots.
            </div>
          </div>
        )}

        {/* Valid Slot Generation Preview */}
        {!isInvalidRange && numSlots > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Will create <strong>{numSlots} fixed 30-minute booking slots</strong> from{" "}
              <strong>{format12Hour(startTime)}</strong> to <strong>{format12Hour(endTime)}</strong>.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || isInvalidRange || numSlots === 0 || leaveConflicts.length > 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Availability
          </button>
        </div>
      </form>
    </Modal>
  );
}
