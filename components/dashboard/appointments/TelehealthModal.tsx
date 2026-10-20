import React, { useState } from "react";
import { Video, Copy, Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { AppointmentEntry } from "./types";

interface TelehealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: AppointmentEntry | null;
  onLaunch: () => void;
}

export default function TelehealthModal({
  isOpen,
  onClose,
  target,
  onLaunch,
}: TelehealthModalProps) {
  const [copied, setCopied] = useState(false);

  if (!target) return null;

  const meetingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/consult/${target.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase()}`
      : `https://medicare.portal/consult/${target.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Telehealth Video Consultation"
      icon={
        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
          <Video className="w-4 h-4" />
        </div>
      }
      maxWidth="lg"
    >
      <div className="mt-3 space-y-4">
        <p className="text-xs text-slate-500">
          Patient: <strong className="text-slate-800">{target.patient_name}</strong>
        </p>

        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-900">
              Encrypted Consultation Session
            </span>
            <span className="text-[10px] bg-purple-200/70 text-purple-900 px-2 py-0.5 rounded-full font-bold">
              HIPAA &amp; E2EE Ready
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-purple-200/80 text-xs text-slate-700 font-mono break-all flex items-center justify-between gap-2 shadow-2xs">
            <span className="truncate">{meetingUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-xs font-sans font-semibold shrink-0 p-1 rounded hover:bg-purple-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
            <li>Video &amp; audio streaming starts automatically upon patient admission.</li>
            <li>In-call clinical notes and diagnostic image sharing tools available.</li>
          </ul>
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
            onClick={() => {
              onLaunch();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Launch Telehealth Room</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
