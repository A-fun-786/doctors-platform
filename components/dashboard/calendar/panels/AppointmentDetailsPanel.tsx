"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  HeartPulse,
  Activity,
  FileText,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit3,
  Shield,
  Loader2,
} from "lucide-react";
import {
  CalendarEvent,
  getAppointment,
  completeAppointment,
  cancelAppointment,
  AppointmentEntry,
} from "@/lib/api";
import Badge from "@/components/ui/Badge";
import { format12Hour, WorkingHoursConfig } from "../calendarUtils";
import AppointmentRescheduleForm from "./AppointmentRescheduleForm";

interface AppointmentDetailsPanelProps {
  event: CalendarEvent;
  date: string;
  doctorUuid?: string;
  onClose: () => void;
  onRefreshCalendar: () => void;
  showToast?: (msg: string) => void;
  existingEvents?: CalendarEvent[];
  workingHoursConfig?: WorkingHoursConfig;
}

export default function AppointmentDetailsPanel({
  event: initialEvent,
  date: initialDate,
  doctorUuid,
  onClose,
  onRefreshCalendar,
  showToast,
  existingEvents,
  workingHoursConfig,
}: AppointmentDetailsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CalendarEvent>(initialEvent);
  const [currentDate, setCurrentDate] = useState<string>(initialDate);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStatusBadgeStyle = (status?: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "NO_SHOW":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "BOOKED":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const handleComplete = async () => {
    if (!currentEvent.appointment_id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await completeAppointment(currentEvent.appointment_id);
      setCurrentEvent((prev) => ({ ...prev, status: "COMPLETED" }));
      onRefreshCalendar();
      showToast?.("Appointment marked as completed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to complete appointment";
      showToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!currentEvent.appointment_id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await cancelAppointment(currentEvent.appointment_id, cancelReason.trim() || undefined);
      setCurrentEvent((prev) => ({ ...prev, status: "CANCELLED" }));
      setShowCancelModal(false);
      onRefreshCalendar();
      showToast?.("Appointment cancelled successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel appointment";
      showToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Background hydration: fetch full appointment entry from backend to get full UUIDs, created_at, patient_id, email, etc.
  useEffect(() => {
    let isMounted = true;
    async function hydrateAppointment() {
      if (!initialEvent.appointment_id) return;
      try {
        setHydrating(true);
        const full = await getAppointment(initialEvent.appointment_id);
        if (isMounted && full) {
          setCurrentEvent((prev) => ({
            ...prev,
            patient_id: full.patient_id,
            doctor_id: full.doctor_id,
            patient_contact: full.patient_contact || prev.patient_contact,
            patient_gender: full.patient_gender || prev.patient_gender,
            patient_age: full.patient_age !== undefined ? full.patient_age : prev.patient_age,
            patient_height: full.patient_height || prev.patient_height,
            patient_weight: full.patient_weight || prev.patient_weight,
            patient_blood_group: full.patient_blood_group || prev.patient_blood_group,
            patient_address: full.patient_address || prev.patient_address,
            created_at: full.created_at || prev.created_at,
            reason: full.reason || prev.reason,
            notes: full.notes || prev.notes,
            status: full.status || prev.status,
          }));
        }
      } catch (err) {
        console.warn("Could not hydrate full appointment details:", err);
      } finally {
        if (isMounted) setHydrating(false);
      }
    }

    hydrateAppointment();
    return () => {
      isMounted = false;
    };
  }, [initialEvent.appointment_id]);

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

  const handleRescheduleSuccess = (
    newDate: string,
    newStart: string,
    newEnd: string
  ) => {
    setCurrentDate(newDate);
    setCurrentEvent((prev) => ({
      ...prev,
      start: newStart,
      end: newEnd,
    }));
    setIsEditing(false);
    onRefreshCalendar();
  };

  // Switch to in-place edit mode if requested
  if (isEditing) {
    return (
      <AppointmentRescheduleForm
        event={currentEvent}
        date={currentDate}
        onCancel={() => setIsEditing(false)}
        onSuccess={handleRescheduleSuccess}
        existingEvents={existingEvents}
        workingHoursConfig={workingHoursConfig}
        showToast={showToast}
      />
    );
  }

  // Format booking creation date
  let formattedCreatedDate = "";
  if (currentEvent.created_at) {
    try {
      const d = new Date(currentEvent.created_at);
      formattedCreatedDate = d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      formattedCreatedDate = currentEvent.created_at;
    }
  }

  const effectiveDoctorId = currentEvent.doctor_id || doctorUuid || "N/A";
  const effectivePatientId = currentEvent.patient_id || (currentEvent.appointment_id ? `PAT-${currentEvent.appointment_id.slice(0, 8)}` : null);
  const patientEmail = currentEvent.patient_email || (currentEvent.patient_contact?.includes("@") ? currentEvent.patient_contact : null);
  const patientPhone = currentEvent.patient_contact && !currentEvent.patient_contact.includes("@") ? currentEvent.patient_contact : null;

  return (
    <div className="space-y-6">
      {/* 1. Patient Profile Header Card */}
      <div className="p-4 bg-gradient-to-br from-blue-50/60 to-slate-50 rounded-2xl border border-blue-100/80 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {currentEvent.patient_name
                ? currentEvent.patient_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "PT"}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {currentEvent.patient_name || "Patient Record"}
              </h3>
              {effectivePatientId && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-mono text-slate-500 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md">
                    Patient ID: {effectivePatientId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(effectivePatientId, "patient_id")}
                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Copy Patient ID"
                  >
                    {copiedKey === "patient_id" ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <Badge
            variant="default"
            className={`${getStatusBadgeStyle(currentEvent.status)} text-[10px] uppercase font-bold`}
          >
            {currentEvent.status || "BOOKED"}
          </Badge>
        </div>

        {/* Contact Links */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {patientPhone && (
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <a
                href={`tel:${patientPhone}`}
                className="hover:underline font-medium truncate"
              >
                {patientPhone}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(patientPhone, "phone")}
                className="p-0.5 text-slate-400 hover:text-slate-700"
              >
                {copiedKey === "phone" ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          )}

          {patientEmail && (
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <a
                href={`mailto:${patientEmail}`}
                className="hover:underline font-medium truncate"
              >
                {patientEmail}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(patientEmail, "email")}
                className="p-0.5 text-slate-400 hover:text-slate-700"
              >
                {copiedKey === "email" ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {currentEvent.patient_address && (
          <div className="mt-2 text-xs text-slate-600 flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{currentEvent.patient_address}</span>
          </div>
        )}
      </div>

      {/* 2. Patient Vitals Matrix */}
      {(currentEvent.patient_age !== undefined ||
        currentEvent.patient_gender ||
        currentEvent.patient_blood_group ||
        currentEvent.patient_height ||
        currentEvent.patient_weight) && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Patient Demographics & Vitals
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {currentEvent.patient_age !== undefined && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Age
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {currentEvent.patient_age} yrs
                </span>
              </div>
            )}

            {currentEvent.patient_gender && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Gender
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {currentEvent.patient_gender}
                </span>
              </div>
            )}

            {currentEvent.patient_blood_group && (
              <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 text-center">
                <span className="text-[10px] text-rose-500 uppercase font-semibold block">
                  Blood Group
                </span>
                <span className="text-xs font-bold text-rose-700">
                  {currentEvent.patient_blood_group}
                </span>
              </div>
            )}

            {currentEvent.patient_height && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Height
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {currentEvent.patient_height}
                </span>
              </div>
            )}

            {currentEvent.patient_weight && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Weight
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {currentEvent.patient_weight}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Appointment Details Card */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Appointment Schedule & Specifications
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Date</span>
            </span>
            <span className="font-bold text-slate-900">{currentDate}</span>
          </div>

          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Time Slot (30 mins)</span>
            </span>
            <span className="font-mono font-bold text-blue-700">
              {format12Hour(currentEvent.start)} – {format12Hour(currentEvent.end)}
            </span>
          </div>

          {effectivePatientId && (
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Patient ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-700 text-[11px] truncate max-w-[200px]">
                  {effectivePatientId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(effectivePatientId, "patient_id_spec")}
                  className="p-1 text-slate-400 hover:text-slate-700"
                  title="Copy Patient ID"
                >
                  {copiedKey === "patient_id_spec" ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          {currentEvent.appointment_id && (
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Appointment ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-700 text-[11px]">
                  {currentEvent.appointment_id}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(currentEvent.appointment_id!, "appt_id")}
                  className="p-1 text-slate-400 hover:text-slate-700"
                  title="Copy Appointment ID"
                >
                  {copiedKey === "appt_id" ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Doctor ID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-slate-700 text-[11px] truncate max-w-[200px]">
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

          {formattedCreatedDate && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Booking Created Date</span>
              <span className="text-slate-700 font-medium">{formattedCreatedDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Clinical Visit Reason & Additional Notes */}
      {(currentEvent.reason || currentEvent.notes) && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Consultation Details
          </div>

          {currentEvent.reason && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Visit Reason</span>
              <span className="text-slate-800">{currentEvent.reason}</span>
            </div>
          )}

          {currentEvent.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Additional Notes</span>
              <p className="text-slate-800 whitespace-pre-wrap">{currentEvent.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Sticky Action Footer */}
      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Close
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {currentEvent.status !== "CANCELLED" &&
            currentEvent.status !== "COMPLETED" &&
            currentEvent.appointment_id && (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCancelModal(true)}
                  className="px-3.5 py-2.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Appointment</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleComplete}
                  className="px-3.5 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Mark Completed</span>
                </button>
              </>
            )}

          {currentEvent.status !== "CANCELLED" && currentEvent.status !== "COMPLETED" && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsEditing(true)}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit / Reschedule Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 id="cancel-dialog-title" className="text-sm font-bold text-slate-900">
                  Cancel Appointment?
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Cancelling this appointment will release this 30-minute slot for other patients.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="cancel-reason"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Reason for Cancellation (optional)
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Patient requested cancellation"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
