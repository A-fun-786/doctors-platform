import React from "react";
import { Clock, Loader2, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { AppointmentEntry, AvailableSlot } from "./types";
import { formatTime, formatDisplayDate } from "./utils";

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: AppointmentEntry | null;
  date: string;
  setDate: (d: string) => void;
  slots: AvailableSlot[];
  slotsLoading: boolean;
  selectedSlotIndex: number;
  setSelectedSlotIndex: (idx: number) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export default function RescheduleAppointmentModal({
  isOpen,
  onClose,
  target,
  date,
  setDate,
  slots,
  slotsLoading,
  selectedSlotIndex,
  setSelectedSlotIndex,
  submitting,
  error,
  onSubmit,
}: RescheduleAppointmentModalProps) {
  if (!target) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reschedule Appointment"
      icon={
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Clock className="w-4 h-4" />
        </div>
      }
      maxWidth="md"
    >
      <div className="mt-3 space-y-4">
        <p className="text-xs text-slate-600">
          Rescheduling consultation for{" "}
          <strong className="text-slate-900">{target.patient_name}</strong> (currently on{" "}
          {formatDisplayDate(target.date)} at {formatTime(target.start_time)}).
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select New Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Available Slot <span className="text-red-500">*</span>
            </label>
            {slotsLoading ? (
              <div className="h-9 px-3 border border-slate-200 rounded-xl flex items-center text-xs text-slate-400 gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Fetching slots...</span>
              </div>
            ) : slots.length === 0 ? (
              <div className="h-9 px-3 border border-dashed border-red-200 bg-red-50/50 rounded-xl flex items-center text-[11px] text-red-600">
                No available slots on this date
              </div>
            ) : (
              <select
                value={selectedSlotIndex}
                onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}
                aria-label="Select new available time slot"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              >
                {slots.map((slot, idx) => (
                  <option key={`${slot.start}-${slot.end}`} value={idx}>
                    {slot.start} - {slot.end}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || slots.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>Confirm Reschedule</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
