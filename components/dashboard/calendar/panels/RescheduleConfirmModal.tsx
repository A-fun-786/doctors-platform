"use client";

import React from "react";
import { Calendar, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { format12Hour } from "../calendarUtils";

interface RescheduleConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  patientName: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
}

export default function RescheduleConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  patientName,
  originalDate,
  originalStartTime,
  originalEndTime,
  newDate,
  newStartTime,
  newEndTime,
}: RescheduleConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Confirm Reschedule"
      icon={<Calendar className="w-5 h-5 text-blue-600" />}
    >
      <div className="space-y-4 pt-2">
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to move the appointment for{" "}
          <strong className="text-slate-900 font-semibold">{patientName}</strong>?
        </p>

        {/* Comparison Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center text-xs">
          {/* Previous Time */}
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Previous Time
            </span>
            <div className="font-semibold text-slate-700">{originalDate}</div>
            <div className="text-slate-500 font-mono mt-0.5">
              {format12Hour(originalStartTime)} – {format12Hour(originalEndTime)}
            </div>
          </div>

          {/* New Time */}
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                New Time
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="font-bold text-blue-950">{newDate}</div>
            <div className="text-blue-800 font-mono font-medium mt-0.5">
              {format12Hour(newStartTime)} – {format12Hour(newEndTime)}
            </div>
          </div>
        </div>

        {/* Notice */}
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            The previous slot will be immediately freed and made available for other bookings.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 text-center cursor-pointer"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="w-full sm:w-auto px-4.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 text-center cursor-pointer"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{submitting ? "Saving Changes..." : "Confirm & Reschedule"}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
