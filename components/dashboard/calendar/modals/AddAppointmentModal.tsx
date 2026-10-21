"use client";

import React, { useMemo } from "react";
import { Loader2, AlertTriangle, Clock, CheckCircle2, User } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { CalendarEvent } from "@/lib/api";
import { TIME_OPTIONS_30M } from "../constants";
import {
  format12Hour,
  addMinutesToTime,
  findConflictingEvents,
} from "../calendarUtils";

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  setPatientName: (name: string) => void;
  patientContact: string;
  setPatientContact: (contact: string) => void;
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

export default function AddAppointmentModal({
  isOpen,
  onClose,
  patientName,
  setPatientName,
  patientContact,
  setPatientContact,
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
}: AddAppointmentModalProps) {
  // When start time changes, automatically set end time to exactly +30 minutes
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setEndTime(addMinutesToTime(newStart, 30));
  };

  // Find any conflicting booked appointments or doctor leaves
  const conflicts = useMemo(() => {
    if (!startTime || !endTime) return [];
    return findConflictingEvents(startTime, endTime, existingEvents);
  }, [startTime, endTime, existingEvents]);

  const hasConflict = conflicts.length > 0;

  // Extract open/available 30-minute slots for this day as suggestions
  const availableSlotsToday = useMemo(() => {
    return existingEvents
      .filter((e) => e.type === "AVAILABLE")
      .map((e) => ({
        start: e.start,
        end: e.end,
        label: `${format12Hour(e.start)} – ${format12Hour(e.end)}`,
      }));
  }, [existingEvents]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Patient Appointment">
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {/* Patient Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Patient Full Name *
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="e.g. Neha Verma"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Contact Phone (optional)
          </label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={patientContact}
            onChange={(e) => setPatientContact(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date Selection */}
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

        {/* Fixed 30-Minute Time Slot Selection */}
        <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>30-Minute Consultation Window</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Fixed 30m Slot
            </span>
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
                End Time (30 min)
              </label>
              <div className="px-2.5 py-1.5 text-xs border border-slate-200 bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center justify-between">
                <span>{format12Hour(endTime) || "End Time"}</span>
                <span className="text-[10px] text-slate-400 font-normal">+30m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Conflict Warning Banner */}
        {hasConflict && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5 animate-fadeIn">
            <div className="flex items-start gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">Booking Conflict Detected</div>
                <div className="text-[11px] text-red-700 mt-0.5">
                  {conflicts.map((c, i) => {
                    const isLeave = c.type === "LEAVE" || c.type === "HOLIDAY";
                    const isBlocked = c.type === "BLOCKED";
                    if (isLeave) {
                      return (
                        <div key={i}>
                          Doctor is on <strong>Leave</strong> ({format12Hour(c.start)} –{" "}
                          {format12Hour(c.end)})
                          {c.reason ? `: ${c.reason}` : ""}.
                        </div>
                      );
                    }
                    if (isBlocked) {
                      return (
                        <div key={i}>
                          Time is <strong>Blocked</strong> ({format12Hour(c.start)} –{" "}
                          {format12Hour(c.end)}): {c.reason || "Special interval"}.
                        </div>
                      );
                    }
                    return (
                      <div key={i}>
                        Already booked for <strong>{c.patient_name || "Patient"}</strong> (
                        {format12Hour(c.start)} – {format12Hour(c.end)}).
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Suggestions for Available 30-Minute Slots */}
            {availableSlotsToday.length > 0 && (
              <div className="pt-2 border-t border-red-100">
                <div className="text-[10px] font-semibold text-red-900 mb-1">
                  Available 30-min alternatives today:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableSlotsToday.slice(0, 4).map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStartTimeChange(slot.start)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md transition-colors"
                    >
                      {format12Hour(slot.start)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Confirmation when no conflict */}
        {!hasConflict && startTime && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/60 border border-emerald-200/80 p-2 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Slot available for booking: <strong>{format12Hour(startTime)} – {format12Hour(endTime)}</strong>
            </span>
          </div>
        )}

        {/* Reason for Visit */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Visit
          </label>
          <input
            type="text"
            placeholder="e.g. Regular Health Checkup / Diabetes Consultation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

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
            disabled={submitting || hasConflict}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Booking
          </button>
        </div>
      </form>
    </Modal>
  );
}
