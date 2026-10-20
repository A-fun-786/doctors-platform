import React, { useState } from "react";
import {
  X,
  Calendar,
  Phone,
  Mail,
  Building2,
  Video,
  CheckCircle2,
  CalendarDays,
  XCircle,
  History,
  FileEdit,
  Video as VideoIcon,
  ChevronRight,
} from "lucide-react";
import { AppointmentEntry } from "./types";
import AppointmentStatusBadge from "./AppointmentStatusBadge";
import {
  getAvatarGradient,
  getInitials,
  formatDisplayDate,
  formatTime,
  calculateDuration,
  isVideoConsultation,
  cleanReasonText,
  getPatientDemographics,
} from "./utils";

interface AppointmentDetailsPanelProps {
  appointment: AppointmentEntry;
  allAppointments: AppointmentEntry[];
  onClose: () => void;
  onSelectAppointment: (id: string) => void;
  onConfirm: (appt: AppointmentEntry) => void;
  onReschedule: (appt: AppointmentEntry) => void;
  onCancel: (appt: AppointmentEntry) => void;
  onOpenPrescription: (appt: AppointmentEntry) => void;
  onOpenTelehealth: (appt: AppointmentEntry) => void;
  actionInProgressId: string | null;
  clinicName?: string | null;
}

export default function AppointmentDetailsPanel({
  appointment,
  allAppointments,
  onClose,
  onSelectAppointment,
  onConfirm,
  onReschedule,
  onCancel,
  onOpenPrescription,
  onOpenTelehealth,
  actionInProgressId,
  clinicName,
}: AppointmentDetailsPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  const demographics = getPatientDemographics(appointment.patient_name);
  const isVideo = isVideoConsultation(appointment);
  const duration = calculateDuration(appointment.start_time, appointment.end_time);

  // Derive email from contact if it contains @, or synthetic email for display
  const email =
    appointment.patient_contact && appointment.patient_contact.includes("@")
      ? appointment.patient_contact
      : `${appointment.patient_name.toLowerCase().replace(/\s+/g, ".")}@email.com`;

  // Find previous/other visits for this patient
  const patientHistory = allAppointments.filter(
    (a) =>
      a.id !== appointment.id &&
      (a.patient_name.toLowerCase() === appointment.patient_name.toLowerCase() ||
        (appointment.patient_contact && a.patient_contact === appointment.patient_contact))
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-5 sticky top-20">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">Appointment Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close details panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Patient Profile Card */}
      <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                appointment.patient_name
              )} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs`}
            >
              {getInitials(appointment.patient_name)}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                {appointment.patient_name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Age {demographics.age} · {demographics.gender}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-white border border-blue-200/80 px-2.5 py-1 rounded-lg shadow-2xs hover:border-blue-300 transition-colors"
          >
            {showHistory ? "Hide Profile" : "View Profile"}
          </button>
        </div>

        <div className="space-y-1 pt-1 text-xs text-slate-600">
          {appointment.patient_contact && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{appointment.patient_contact}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        </div>
      </div>

      {/* Optional Patient History Accordion */}
      {showHistory && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Patient Consultation History</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
              {patientHistory.length} other visits
            </span>
          </div>

          {patientHistory.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">
              No prior recorded visits found for this patient.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {patientHistory.map((hist) => (
                <div
                  key={hist.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectAppointment(hist.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectAppointment(hist.id);
                    }
                  }}
                  aria-label={`View visit from ${formatDisplayDate(hist.date)}: ${cleanReasonText(hist.reason)}`}
                  className="p-2 rounded-lg bg-white border border-slate-200/80 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer text-xs flex items-center justify-between transition-colors shadow-2xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800">
                      {formatDisplayDate(hist.date)}
                    </span>
                    <p className="text-[11px] text-slate-500 truncate max-w-[150px]">
                      {cleanReasonText(hist.reason)}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={hist.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Appointment Information Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>Appointment Information</span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400">Date &amp; Time</span>
            <span className="font-semibold text-slate-900 text-right">
              {formatDisplayDate(appointment.date)} • {formatTime(appointment.start_time)} ({duration})
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Type</span>
            {isVideo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
                <Video className="w-3 h-3 text-purple-500" />
                <span>Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                <Building2 className="w-3 h-3 text-sky-500" />
                <span>In-Person</span>
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400">Reason for Visit</span>
            <span className="font-medium text-slate-800 text-right max-w-[200px]">
              {cleanReasonText(appointment.reason)}
            </span>
          </div>

          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400">Consultation Type</span>
            <span className="font-medium text-slate-800 text-right">
              {isVideo ? "Telehealth Video" : "General Consultation"}
            </span>
          </div>

          {clinicName && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-400">Clinic Facility</span>
              <span className="font-medium text-slate-800 text-right">{clinicName}</span>
            </div>
          )}

          {appointment.notes && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block mb-1">Notes:</span>
              <p className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700 text-xs italic">
                {appointment.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Status Indicator */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">Status</span>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      {/* 5. Main Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        {appointment.status === "BOOKED" && (
          <button
            type="button"
            onClick={() => onConfirm(appointment)}
            disabled={actionInProgressId === appointment.id}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-semibold text-xs transition-all shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm / Complete</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {appointment.status === "BOOKED" && (
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs border border-slate-200 shadow-2xs transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
              <span>Reschedule</span>
            </button>
          )}

          {appointment.status === "BOOKED" && (
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-red-50 text-red-600 rounded-xl font-semibold text-xs border border-red-200 shadow-2xs transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. Quick Actions Section */}
      <div className="space-y-2 pt-3 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-800 block">Quick Actions</span>

        <div className="space-y-1.5">
          {/* View Patient History */}
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 border border-slate-200/70 hover:border-slate-300 transition-colors text-xs text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <History className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-slate-800">View Patient History</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Add Prescription */}
          <button
            type="button"
            onClick={() => onOpenPrescription(appointment)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 border border-slate-200/70 hover:border-slate-300 transition-colors text-xs text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileEdit className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-slate-800">Add Prescription</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Start Consultation */}
          <button
            type="button"
            onClick={() => onOpenTelehealth(appointment)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 border border-slate-200/70 hover:border-slate-300 transition-colors text-xs text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <VideoIcon className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-slate-800">
                {isVideo ? "Start Video Consultation" : "Start Consultation"}
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
