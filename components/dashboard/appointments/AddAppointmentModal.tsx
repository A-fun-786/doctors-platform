import React from "react";
import { Plus, Loader2, Building2, Video, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { AvailableSlot } from "./types";

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  setPatientName: (name: string) => void;
  patientContact: string;
  setPatientContact: (contact: string) => void;
  appointmentType: "in_clinic" | "video_consultation";
  setAppointmentType: (type: "in_clinic" | "video_consultation") => void;
  date: string;
  setDate: (d: string) => void;
  availableSlots: AvailableSlot[];
  slotsLoading: boolean;
  selectedSlotIndex: number;
  setSelectedSlotIndex: (idx: number) => void;
  reason: string;
  setReason: (r: string) => void;
  notes: string;
  setNotes: (n: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddAppointmentModal({
  isOpen,
  onClose,
  patientName,
  setPatientName,
  patientContact,
  setPatientContact,
  appointmentType,
  setAppointmentType,
  date,
  setDate,
  availableSlots,
  slotsLoading,
  selectedSlotIndex,
  setSelectedSlotIndex,
  reason,
  setReason,
  notes,
  setNotes,
  submitting,
  error,
  onSubmit,
}: AddAppointmentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Appointment"
      icon={
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </div>
      }
      maxWidth="lg"
    >
      <div className="mt-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Patient Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Patient Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Eleanor Vance"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Patient Contact */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Patient Contact (Phone or Email)
            </label>
            <input
              type="text"
              placeholder="e.g. +91 98765 43210 or patient@example.com"
              value={patientContact}
              onChange={(e) => setPatientContact(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Consultation Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Consultation Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAppointmentType("in_clinic")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  appointmentType === "in_clinic"
                    ? "bg-sky-50 text-sky-800 border-sky-300 ring-2 ring-sky-500/20"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>In-Clinic Visit</span>
              </button>
              <button
                type="button"
                onClick={() => setAppointmentType("video_consultation")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  appointmentType === "video_consultation"
                    ? "bg-purple-50 text-purple-800 border-purple-300 ring-2 ring-purple-500/20"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Telehealth</span>
              </button>
            </div>
          </div>

          {/* Date & Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Date <span className="text-red-500">*</span>
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
                Available Time Slot <span className="text-red-500">*</span>
              </label>
              {slotsLoading ? (
                <div className="h-9 px-3 border border-slate-200 rounded-xl flex items-center text-xs text-slate-400 gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Fetching slots...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="h-9 px-3 border border-dashed border-red-200 bg-red-50/50 rounded-xl flex items-center text-[11px] text-red-600">
                  No slots on this date
                </div>
              ) : (
                <select
                  value={selectedSlotIndex}
                  onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}
                  aria-label="Select available time slot"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                >
                  {availableSlots.map((slot, idx) => (
                    <option key={`${slot.start}-${slot.end}`} value={idx}>
                      {slot.start} - {slot.end}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Visit
            </label>
            <input
              type="text"
              placeholder="e.g. Hypertension Checkup, Routine Physical, Fever & Cold"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Private Clinical Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Confidential clinical notes or internal observations"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Modal Footer Actions */}
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
              disabled={submitting || availableSlots.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Create Appointment</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
