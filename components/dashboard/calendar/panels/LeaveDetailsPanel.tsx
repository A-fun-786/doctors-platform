"use client";

import React, { useState, useEffect } from "react";
import {
  Coffee,
  Calendar,
  Clock,
  Trash2,
  AlertTriangle,
  Check,
  Copy,
  Info,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { CalendarEvent, deleteDoctorSchedule, getDoctorSchedule } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { format12Hour } from "../calendarUtils";

interface LeaveDetailsPanelProps {
  event: CalendarEvent;
  date: string;
  doctorUuid?: string;
  onClose: () => void;
  onRefreshCalendar: () => void;
  showToast?: (msg: string) => void;
}

export default function LeaveDetailsPanel({
  event,
  date,
  doctorUuid,
  onClose,
  onRefreshCalendar,
  showToast,
}: LeaveDetailsPanelProps) {
  const [resolvedLeaveId, setResolvedLeaveId] = useState<string | null>(
    event.schedule_id || null
  );
  const [resolvingId, setResolvingId] = useState<boolean>(!event.schedule_id);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // If schedule_id is not already on event, fetch schedule entries for date to resolve real Schedule UUID
  useEffect(() => {
    let isMounted = true;
    async function resolveId() {
      if (event.schedule_id) {
        setResolvedLeaveId(event.schedule_id);
        setResolvingId(false);
        return;
      }

      try {
        setResolvingId(true);
        const res = await getDoctorSchedule({ from: date, to: date });
        if (isMounted && res.items && res.items.length > 0) {
          // Find the entry that matches start time, end time, and type
          const match = res.items.find(
            (s) =>
              s.start_time.startsWith(event.start) &&
              s.end_time.startsWith(event.end) &&
              (s.type === event.type || s.type === "LEAVE" || s.type === "HOLIDAY" || s.type === "BLOCKED")
          );
          if (match) {
            setResolvedLeaveId(match.id);
          } else {
            // fallback to first non-available schedule on this date
            const nonAvail = res.items.find((s) => (s.type as string) !== "AVAILABLE");
            if (nonAvail) setResolvedLeaveId(nonAvail.id);
          }
        }
      } catch (err) {
        console.warn("Could not resolve leave schedule ID from backend:", err);
      } finally {
        if (isMounted) setResolvingId(false);
      }
    }

    resolveId();
    return () => {
      isMounted = false;
    };
  }, [event, date]);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch {
      // Defensive handling for unsupported or insecure HTTP contexts
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleConfirmCancelLeave = async () => {
    if (!resolvedLeaveId) {
      setCancelError("Leave record ID is missing or could not be found.");
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      await deleteDoctorSchedule(resolvedLeaveId);
      if (showToast) {
        showToast(
          `Doctor leave for ${date} (${format12Hour(event.start)} – ${format12Hour(
            event.end
          )}) successfully cancelled! Slots reopened.`
        );
      }
      setShowConfirmModal(false);
      onRefreshCalendar();
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to cancel leave schedule";
      setCancelError(errMsg);
    } finally {
      setCancelling(false);
    }
  };

  const isHoliday = event.type === "HOLIDAY";
  const isBlocked = event.type === "BLOCKED";
  const leaveTitle = isHoliday
    ? "Clinic Holiday"
    : isBlocked
    ? "Blocked Time"
    : "Doctor Leave";

  const effectiveDoctorId = event.doctor_id || doctorUuid || "DOC-AUTH";
  const displayLeaveId = resolvedLeaveId || (resolvingId ? "Locating..." : "Unavailable");

  return (
    <div className="space-y-6">
      {/* 1. Leave Header Card with Prominent Leave ID */}
      <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/40 rounded-2xl border border-amber-200/80 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-full inline-block">
                {leaveTitle}
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {event.reason || "Scheduled Absence / Off Duty"}
              </h3>
            </div>
          </div>

          <Badge variant="default" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] uppercase font-bold">
            ACTIVE EXCLUSION
          </Badge>
        </div>

        {/* Prominent Leave ID Badge */}
        <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200/90 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Leave ID:
            </span>
            <span className="font-mono font-semibold text-slate-800 text-[11px]">
              {displayLeaveId}
            </span>
          </div>

          {resolvedLeaveId && (
            <button
              type="button"
              onClick={() => handleCopy(resolvedLeaveId, "leave_id")}
              className="p-1 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center gap-1 text-[11px]"
              title="Copy Leave ID"
            >
              {copiedKey === "leave_id" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-slate-500 text-[10px]">Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Leave Specifications Card */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Leave Schedule Specifications
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          {/* Doctor ID */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Doctor ID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-slate-800 font-semibold text-[11px] truncate max-w-[200px]">
                {effectiveDoctorId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(effectiveDoctorId, "doc_id")}
                className="p-1 text-slate-400 hover:text-slate-700"
                title="Copy Doctor ID"
              >
                {copiedKey === "doc_id" ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* Leave Date */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Leave Date</span>
            </span>
            <span className="font-bold text-slate-900">{date}</span>
          </div>

          {/* Time Span */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Time Span</span>
            </span>
            <span className="font-mono font-bold text-amber-900">
              {format12Hour(event.start)} – {format12Hour(event.end)}
            </span>
          </div>

          {/* Leave Status */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Leave Status</span>
            <span className="font-semibold text-amber-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Active Exclusion</span>
            </span>
          </div>

          {/* Reason Details */}
          {event.reason && (
            <div className="pt-1 text-xs">
              <span className="text-slate-500 font-medium block mb-1">Leave Reason</span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-medium text-slate-800">
                {event.reason}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Reassurance & Safety Card */}
      <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Automatic Availability Restoration</p>
          <p className="text-blue-800/90 leading-relaxed text-[11px]">
            Cancelling this leave will immediately recalculate and reopen 30-minute booking slots
            according to your working hours. Existing patient appointments are never deleted or modified.
          </p>
        </div>
      </div>

      {/* Error Feedback */}
      {cancelError && (
        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{cancelError}</span>
        </div>
      )}

      {/* 4. Action Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Close
        </button>

        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          disabled={!resolvedLeaveId && resolvingId}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Cancel Leave</span>
        </button>
      </div>

      {/* 5. Cancellation Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        maxWidth="md"
        title="Cancel Doctor Leave"
        icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to cancel this leave schedule?
          </p>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
            <div className="text-slate-500 font-sans text-[11px] font-semibold">
              Leave Details to be Removed:
            </div>
            <div className="text-slate-800">
              <strong className="font-sans">Leave ID:</strong> {displayLeaveId}
            </div>
            <div className="text-slate-800">
              <strong className="font-sans">Date:</strong> {date}
            </div>
            <div className="text-slate-800">
              <strong className="font-sans">Time:</strong> {format12Hour(event.start)} – {format12Hour(event.end)}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            This will restore standard booking availability for patients during this period.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              disabled={cancelling}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Keep Leave
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelLeave}
              disabled={cancelling}
              className="px-4.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{cancelling ? "Cancelling..." : "Confirm & Cancel Leave"}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
