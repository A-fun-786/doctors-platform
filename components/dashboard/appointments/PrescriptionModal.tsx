import React, { useState } from "react";
import { Pill, Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { AppointmentEntry } from "./types";

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: AppointmentEntry | null;
  onSave: (prescriptionText: string) => void;
}

export default function PrescriptionModal({
  isOpen,
  onClose,
  target,
  onSave,
}: PrescriptionModalProps) {
  const [prescriptionText, setPrescriptionText] = useState("");

  if (!target) return null;

  const handleSave = () => {
    onSave(prescriptionText);
    setPrescriptionText("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prescription & Medication Notes"
      icon={
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Pill className="w-4 h-4" />
        </div>
      }
      maxWidth="lg"
    >
      <div className="mt-3 space-y-4">
        <p className="text-xs text-slate-500">
          Patient: <strong className="text-slate-800">{target.patient_name}</strong> (Appointment: {target.id})
        </p>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Clinical Prescription Details
          </label>
          <textarea
            rows={4}
            placeholder="e.g. Amoxicillin 500mg - 1 capsule TDS for 7 days after meals&#10;Paracetamol 500mg PRN for pain"
            value={prescriptionText}
            onChange={(e) => setPrescriptionText(e.target.value)}
            aria-label="Clinical prescription details"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-[11px] text-slate-500 leading-normal">
            Prescription records will be attached to patient consultation history and made accessible to pharmacy fulfillment if medicine inventory service is active.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Prescription</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
