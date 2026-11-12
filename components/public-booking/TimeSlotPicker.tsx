"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { AvailableSlot } from "@/lib/api";
import { format12Hour } from "@/components/dashboard/calendar/calendarUtils";

export interface TimeSlotPickerProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableSlots: AvailableSlot[];
  slotsLoading: boolean;
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
  dateLabel?: string;
  slotLabel?: string;
  emptyMessage?: string;
}

export default function TimeSlotPicker({
  selectedDate,
  onDateChange,
  availableSlots,
  slotsLoading,
  selectedSlot,
  onSelectSlot,
  dateLabel = "Preferred Date",
  slotLabel = "Preferred Time Slot",
  emptyMessage = "No available slots on this date. Please choose another date.",
}: TimeSlotPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Date Picker */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          {dateLabel} <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          required
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Time Slot Picker */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          {slotLabel} <span className="text-red-500">*</span>
        </label>
        {!selectedDate ? (
          <div className="py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
            Please select a preferred date above to view available time slots.
          </div>
        ) : slotsLoading ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Loading available slots...</span>
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="py-4 px-4 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-800 text-center">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
            {availableSlots.map((slot) => {
              const slotLabelFormatted = format12Hour(slot.start);
              return (
                <button
                  key={`${slot.start}-${slot.end}`}
                  type="button"
                  onClick={() => onSelectSlot(slotLabelFormatted)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    selectedSlot === slotLabelFormatted
                      ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {slotLabelFormatted}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

