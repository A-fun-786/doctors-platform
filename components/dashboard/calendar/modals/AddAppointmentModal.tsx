"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

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
}: AddAppointmentModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Patient Appointment">
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Patient Full Name
          </label>
          <input
            type="text"
            placeholder="e.g. Neha Verma"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

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

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Visit
          </label>
          <input
            type="text"
            placeholder="e.g. Regular Health Checkup"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

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
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Booking
          </button>
        </div>
      </form>
    </Modal>
  );
}
