"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  ArrowLeft,
  FileText,
  AlertCircle,
  Save,
  Check,
  RotateCcw,
} from "lucide-react";
import { CalendarEvent, rescheduleAppointment, getDoctorCalendar } from "@/lib/api";
import { WorkingHoursConfig, format12Hour } from "../calendarUtils";
import SlotSelectorGrid from "./SlotSelectorGrid";
import RescheduleConfirmModal from "./RescheduleConfirmModal";

const COMMON_REASONS = [
  "General Consultation",
  "Follow-up Consultation",
  "Routine Health Check",
  "Prescription Refill",
  "Lab Report Review",
  "Specialist Evaluation",
];

interface AppointmentRescheduleFormProps {
  event: CalendarEvent;
  date: string;
  onCancel: () => void;
  onSuccess: (updatedDate: string, updatedStart: string, updatedEnd: string) => void;
  existingEvents?: CalendarEvent[];
  workingHoursConfig?: WorkingHoursConfig;
  showToast?: (msg: string) => void;
}

export default function AppointmentRescheduleForm({
  event,
  date,
  onCancel,
  onSuccess,
  existingEvents = [],
  workingHoursConfig,
  showToast,
}: AppointmentRescheduleFormProps) {
  const [targetDate, setTargetDate] = useState<string>(date);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>({
    start: event.start,
    end: event.end,
  });
  const [reason, setReason] = useState<string>(event.reason || "");
  const [notes, setNotes] = useState<string>(event.notes || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fallback events for SlotSelectorGrid:
  // If targetDate matches original date, evaluate against existingEvents.
  // If doctor picks a different targetDate, clear immediately to avoid evaluating
  // against the previous date's events, and fetch target date events in background.
  const [targetEvents, setTargetEvents] = useState<CalendarEvent[]>(existingEvents);

  useEffect(() => {
    if (targetDate === date) {
      setTargetEvents(existingEvents);
      return;
    }

    let isMounted = true;
    // Clear immediately to prevent cross-date slot collision
    setTargetEvents([]);

    async function fetchTargetEvents() {
      try {
        const cal = await getDoctorCalendar(targetDate, targetDate);
        if (isMounted && cal?.dates?.[0]?.events) {
          setTargetEvents(cal.dates[0].events);
        }
      } catch {
        // Fallback remains safely empty
      }
    }

    if (targetDate) {
      fetchTargetEvents();
    }

    return () => {
      isMounted = false;
    };
  }, [targetDate, date, existingEvents]);

  // Validate inputs before opening confirmation modal
  const handleInitiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!targetDate) {
      setFormError("Please select a target appointment date.");
      return;
    }

    if (!selectedSlot || !selectedSlot.start || !selectedSlot.end) {
      setFormError("Please select an available 30-minute time slot.");
      return;
    }

    // Check if slot changed or reason changed
    const isSlotUnchanged =
      targetDate === date &&
      selectedSlot.start === event.start &&
      selectedSlot.end === event.end;

    if (isSlotUnchanged && reason === (event.reason || "") && notes === (event.notes || "")) {
      setFormError("No changes detected. Select a new date, time, or update visit details.");
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute API call on confirmation
  const handleConfirmReschedule = async () => {
    if (!event.appointment_id || !selectedSlot) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await rescheduleAppointment(event.appointment_id, {
        date: targetDate,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
      });

      if (showToast) {
        showToast(
          `Appointment rescheduled for ${event.patient_name || "Patient"} on ${targetDate} (${format12Hour(
            selectedSlot.start
          )} – ${format12Hour(selectedSlot.end)})!`
        );
      }

      setShowConfirmModal(false);
      onSuccess(targetDate, selectedSlot.start, selectedSlot.end);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to reschedule appointment";
      setFormError(errMsg);
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleInitiateSave} className="space-y-5">
      {/* Back to View Mode Button */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Details</span>
        </button>
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
          Edit Mode
        </span>
      </div>

      {/* Current Slot Info Callout */}
      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900">
        <div className="font-semibold text-[11px] text-blue-700 uppercase tracking-wider mb-0.5">
          Currently Scheduled For:
        </div>
        <div className="font-bold">
          {date} • {format12Hour(event.start)} – {format12Hour(event.end)}
        </div>
      </div>

      {/* Error Feedback Banner */}
      {formError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{formError}</div>
        </div>
      )}

      {/* Field: Appointment Date */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>Target Appointment Date</span>
        </label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => {
            setTargetDate(e.target.value);
            setSelectedSlot(null); // reset slot selection when date changes
          }}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
          required
        />
      </div>

      {/* Field: Interactive Available 30-min Slot Picker */}
      <SlotSelectorGrid
        date={targetDate}
        selectedSlot={selectedSlot}
        onSelectSlot={(slot) => setSelectedSlot(slot)}
        existingEvents={targetEvents}
        workingHoursConfig={workingHoursConfig}
        currentAppointmentId={event.appointment_id}
      />

      {/* Field: Visit Reason */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>Visit Reason / Consultation Note</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Follow-up Consultation"
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
        />
        {/* Quick Reason Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {COMMON_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                reason === r
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Field: Additional Clinical Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">
          Additional Clinical Notes (Optional)
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes for medical team..."
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs resize-none"
        />
      </div>

      {/* Action Buttons Footer */}
      <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 text-center cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 text-center cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Confirmation Safety Modal */}
      <RescheduleConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmReschedule}
        submitting={submitting}
        patientName={event.patient_name || "Patient"}
        originalDate={date}
        originalStartTime={event.start}
        originalEndTime={event.end}
        newDate={targetDate}
        newStartTime={selectedSlot?.start || ""}
        newEndTime={selectedSlot?.end || ""}
      />
    </form>
  );
}
