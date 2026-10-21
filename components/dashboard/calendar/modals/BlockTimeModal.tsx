"use client";

import React, { useState, useMemo } from "react";
import { Loader2, AlertTriangle, Coffee, Clock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { BlockType } from "../types";
import { CalendarEvent } from "@/lib/api";
import { TIME_OPTIONS_30M } from "../constants";
import { format12Hour, timeToMinutes, isIntervalOverlapping } from "../calendarUtils";

interface BlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockType: BlockType;
  setBlockType: (t: BlockType) => void;
  date: string;
  setDate: (d: string) => void;
  startTime: string;
  setStartTime: (t: string) => void;
  endTime: string;
  setEndTime: (t: string) => void;
  reason: string;
  setReason: (r: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  existingEvents?: CalendarEvent[];
}

export default function BlockTimeModal({
  isOpen,
  onClose,
  blockType,
  setBlockType,
  date,
  setDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  reason,
  setReason,
  submitting,
  onSubmit,
  existingEvents = [],
}: BlockTimeModalProps) {
  const [isAllDay, setIsAllDay] = useState(false);

  // Toggle All Day
  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDay(checked);
    if (checked) {
      setStartTime("00:00");
      setEndTime("23:59");
    } else {
      setStartTime("10:00");
      setEndTime("13:00");
    }
  };

  // Range validation
  const isInvalidRange = useMemo(() => {
    if (isAllDay) return false;
    return timeToMinutes(endTime) <= timeToMinutes(startTime);
  }, [isAllDay, startTime, endTime]);

  // Check for collision with existing booked appointments
  const conflictingAppointments = useMemo(() => {
    return existingEvents.filter((ev) => {
      if (ev.type !== "APPOINTMENT" || ev.status === "CANCELLED") return false;
      return isIntervalOverlapping(startTime, endTime, ev.start, ev.end);
    });
  }, [startTime, endTime, existingEvents]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Block Time / Mark Doctor Leave">
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {/* Exclusion Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Exclusion Type
          </label>
          <div className="relative">
            <select
              value={blockType}
              onChange={(e) => setBlockType(e.target.value as BlockType)}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="LEAVE">Leave (Doctor Off Duty / Out of Clinic)</option>
              <option value="BLOCKED">Blocked (Personal interval / Internal meeting)</option>
              <option value="HOLIDAY">Clinic Holiday (Full Clinic Closed)</option>
            </select>
          </div>
        </div>

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

        {/* All-Day Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-600" />
            <div>
              <div className="text-xs font-semibold text-slate-800">Full Day Exclusion</div>
              <div className="text-[11px] text-slate-500">
                Mark doctor as on leave for the entire day
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => handleAllDayToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {/* 30-Minute Time Selectors (if not all day) */}
        {!isAllDay && (
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Leave / Block Duration (30m Increments)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Start Time
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
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
        )}

        {/* Invalid Range Alert */}
        {isInvalidRange && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>End Time must be after Start Time.</span>
          </div>
        )}

        {/* Warning: Conflicts with existing Booked Appointments */}
        {conflictingAppointments.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">
                  {conflictingAppointments.length} Booked Appointment(s) in this Window
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  The following patients are booked during this time and may require rescheduling:
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900 font-medium list-disc list-inside">
                  {conflictingAppointments.map((appt, idx) => (
                    <li key={idx}>
                      {appt.patient_name || "Patient"} ({format12Hour(appt.start)} –{" "}
                      {format12Hour(appt.end)})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Reason / Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason / Description
          </label>
          <input
            type="text"
            placeholder="e.g. Medical Conference / Off Duty / Annual Vacation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons */}
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
            disabled={submitting || isInvalidRange}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm {blockType === "LEAVE" ? "Leave" : blockType === "HOLIDAY" ? "Holiday" : "Block"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
