"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Clock, Check, Loader2, AlertCircle } from "lucide-react";
import { getDoctorAvailableSlots, AvailableSlot, CalendarEvent } from "@/lib/api";
import { format12Hour, doesEventOverlapSlot, isSlotWithinWorkingHours, WorkingHoursConfig } from "../calendarUtils";

interface SlotSelectorGridProps {
  date: string;
  selectedSlot: { start: string; end: string } | null;
  onSelectSlot: (slot: { start: string; end: string }) => void;
  existingEvents?: CalendarEvent[];
  workingHoursConfig?: WorkingHoursConfig;
  currentAppointmentId?: string; // allow the appointment being rescheduled to ignore its own old slot
}

interface CandidateSlot {
  start: string;
  end: string;
  isAvailable: boolean;
  conflictReason?: string;
}

export default function SlotSelectorGrid({
  date,
  selectedSlot,
  onSelectSlot,
  existingEvents = [],
  workingHoursConfig,
  currentAppointmentId,
}: SlotSelectorGridProps) {
  const [loading, setLoading] = useState(false);
  const [apiSlots, setApiSlots] = useState<AvailableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available slots from backend whenever date changes
  useEffect(() => {
    let isMounted = true;
    async function fetchSlots() {
      if (!date) return;
      try {
        setLoading(true);
        setError(null);
        const slots = await getDoctorAvailableSlots(date);
        if (isMounted) {
          setApiSlots(slots);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.warn("Could not load backend available slots, falling back to local calculation:", err);
          setApiSlots(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSlots();
    return () => {
      isMounted = false;
    };
  }, [date]);

  // Generate complete sequence of 30-minute daytime candidate slots (09:00 - 20:00)
  const candidateSlots: CandidateSlot[] = useMemo(() => {
    const list: CandidateSlot[] = [];
    const startHour = 9;
    const endHour = 20;

    for (let h = startHour; h < endHour; h++) {
      for (const m of [0, 30]) {
        const hStr = h.toString().padStart(2, "0");
        const mStr = m.toString().padStart(2, "0");
        const start = `${hStr}:${mStr}`;

        let nextH = h;
        let nextM = m + 30;
        if (nextM >= 60) {
          nextH += 1;
          nextM = 0;
        }
        const end = `${nextH.toString().padStart(2, "0")}:${nextM.toString().padStart(2, "0")}`;

        // Check if within working hours
        const withinShift = isSlotWithinWorkingHours(date, start, end, workingHoursConfig);

        // Check conflicts against existing calendar events
        let isBlocked = false;
        let reason = "";

        if (!withinShift) {
          isBlocked = true;
          reason = "Outside Shift";
        }

        // Check conflicts in existingEvents
        for (const ev of existingEvents) {
          if (ev.status === "CANCELLED") continue;
          // Ignore current appointment's own slot so they can re-select it if desired
          if (currentAppointmentId && ev.appointment_id === currentAppointmentId) {
            continue;
          }

          if (ev.type === "AVAILABLE") continue;

          if (doesEventOverlapSlot(ev, start, end)) {
            isBlocked = true;
            if (ev.type === "LEAVE" || ev.type === "HOLIDAY") {
              reason = "Doctor Leave";
            } else if (ev.type === "BLOCKED") {
              reason = "Blocked";
            } else if (ev.type === "APPOINTMENT") {
              reason = "Already Booked";
            } else {
              reason = "Unavailable";
            }
            break;
          }
        }

        // Check if backend specifically marked this slot as available (if API returned data)
        let isAvailable = !isBlocked;
        if (apiSlots && apiSlots.length > 0) {
          const matchInApi = apiSlots.some((s) => s.start === start && s.end === end);
          if (isBlocked) {
            isAvailable = false;
          } else if (!matchInApi) {
            // If backend didn't list it, mark as booked
            isAvailable = false;
            if (!reason) reason = "Unavailable";
          }
        }

        list.push({
          start,
          end,
          isAvailable,
          conflictReason: reason,
        });
      }
    }

    return list;
  }, [date, existingEvents, workingHoursConfig, currentAppointmentId, apiSlots]);

  const availableCount = candidateSlots.filter((s) => s.isAvailable).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Select 30-Minute Time Slot</span>
        </label>
        <span className="text-[11px] font-semibold text-slate-500">
          {loading ? (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking slots...
            </span>
          ) : (
            `${availableCount} available`
          )}
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of 30-minute slot pills */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
        {candidateSlots.map((slot) => {
          const isSelected = selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;

          if (!slot.isAvailable) {
            return (
              <button
                key={slot.start}
                type="button"
                disabled
                title={slot.conflictReason || "Unavailable"}
                className="p-2 rounded-lg text-center bg-slate-100 border border-slate-200/80 text-slate-400 cursor-not-allowed select-none transition-all flex flex-col items-center justify-center min-h-[46px]"
              >
                <span className="text-xs font-semibold line-through">
                  {format12Hour(slot.start)}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-medium text-slate-400 mt-0.5 truncate max-w-full px-1">
                  {slot.conflictReason || "Booked"}
                </span>
              </button>
            );
          }

          return (
            <button
              key={slot.start}
              type="button"
              onClick={() => onSelectSlot({ start: slot.start, end: slot.end })}
              className={`p-2 rounded-lg text-center transition-all flex flex-col items-center justify-center min-h-[46px] select-none ${
                isSelected
                  ? "bg-blue-600 text-white font-bold shadow-xs border-2 border-blue-600 ring-2 ring-blue-500/30"
                  : "bg-white border border-blue-200/80 text-blue-900 hover:border-blue-400 hover:bg-blue-50/80 active:scale-95"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold">
                  {format12Hour(slot.start)}
                </span>
                {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
              </div>
              <span
                className={`text-[9px] font-medium mt-0.5 ${
                  isSelected ? "text-blue-100" : "text-blue-600"
                }`}
              >
                30 mins
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
