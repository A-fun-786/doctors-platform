import React from "react";
import { XCircle, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { AppointmentEntry } from "./types";
import { formatTime, formatDisplayDate } from "./utils";

interface CancelAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  target: AppointmentEntry | null;
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CancelAppointmentDialog({
  isOpen,
  onClose,
  target,
  cancelReason,
  setCancelReason,
  submitting,
  onSubmit,
}: CancelAppointmentDialogProps) {
  if (!target) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Appointment"
      icon={
        <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
          <XCircle className="w-4 h-4" />
        </div>
      }
      maxWidth="md"
    >
      <div className="mt-3 space-y-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to cancel the appointment with{" "}
          <strong className="text-slate-900">{target.patient_name}</strong> on{" "}
          {formatDisplayDate(target.date)} at {formatTime(target.start_time)}? The slot
          will be released back to the clinic availability inventory.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Cancellation Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Patient requested cancellation, Doctor emergency"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Keep Appointment
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              <span>Cancel Appointment</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
