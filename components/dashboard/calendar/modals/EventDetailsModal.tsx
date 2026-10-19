"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { SelectedEventState } from "../types";
import { format12Hour } from "../calendarUtils";

interface EventDetailsModalProps {
  selectedEvent: SelectedEventState | null;
  onClose: () => void;
}

export default function EventDetailsModal({
  selectedEvent,
  onClose,
}: EventDetailsModalProps) {
  if (!selectedEvent) return null;

  const { event, date } = selectedEvent;

  return (
    <Modal
      isOpen={Boolean(selectedEvent)}
      onClose={onClose}
      maxWidth="sm"
      title={
        <span className="text-xs uppercase tracking-wider font-bold text-blue-600">
          {event.type}
        </span>
      }
    >
      <div className="mt-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {event.patient_name || event.reason || "Scheduled Slot"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {date} • {format12Hour(event.start)} – {format12Hour(event.end)}
          </div>
        </div>

        {event.reason && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Reason:</span> {event.reason}
          </div>
        )}

        {event.status && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            <Badge variant="default" className="uppercase font-bold text-[10px]">
              {event.status}
            </Badge>
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
