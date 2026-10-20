import React, { useState, useEffect } from "react";
import {
  MoreHorizontal,
  Loader2,
  Phone,
  Copy,
  Check,
  Building2,
  Video,
  ClipboardList,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Pill,
  User,
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
  formatAppointmentId,
  getPatientDemographics,
} from "./utils";

interface AppointmentTableProps {
  appointments: AppointmentEntry[];
  selectedAppointmentId: string | null;
  onSelectAppointment: (id: string) => void;
  loading: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onOpenNewModal: () => void;
  onComplete: (appt: AppointmentEntry) => void;
  onReschedule: (appt: AppointmentEntry) => void;
  onCancel: (appt: AppointmentEntry) => void;
  onOpenPrescription: (appt: AppointmentEntry) => void;
  onOpenTelehealth: (appt: AppointmentEntry) => void;
  actionInProgressId: string | null;
}

export default function AppointmentTable({
  appointments,
  selectedAppointmentId,
  onSelectAppointment,
  loading,
  hasActiveFilters,
  onResetFilters,
  onOpenNewModal,
  onComplete,
  onReschedule,
  onCancel,
  onOpenPrescription,
  onOpenTelehealth,
  actionInProgressId,
}: AppointmentTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close action menu on click outside or Escape key press
  useEffect(() => {
    if (!activeMenuId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuId(null);
      }
    };

    const handleClickOutside = () => {
      setActiveMenuId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [activeMenuId]);

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Table Top Header Bar */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 tracking-wider">
            Appointment Records
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
            {appointments.length}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Select any row to view details &amp; patient dossier
        </span>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Loading appointments...</span>
        </div>
      ) : appointments.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No appointments found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "No appointments match your active filter criteria. Try adjusting your search query, status, or date range."
              : "No appointments scheduled yet. Click '+ Add Appointment' to create the first patient booking."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              Clear All Filters
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Appointment</span>
            </button>
          )}
        </div>
      ) : (
        /* Data Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/40 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-3">Appointment ID</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((appt) => {
                const isSelected = selectedAppointmentId === appt.id;
                const isVideo = isVideoConsultation(appt);
                const isBooked = appt.status === "BOOKED";
                const demographics = getPatientDemographics(appt.patient_name);
                const displayId = formatAppointmentId(appt.id);
                const duration = calculateDuration(appt.start_time, appt.end_time);

                return (
                  <tr
                    key={appt.id}
                    tabIndex={0}
                    role="row"
                    aria-selected={isSelected}
                    onClick={() => onSelectAppointment(appt.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectAppointment(appt.id);
                      }
                    }}
                    className={`group transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      isSelected
                        ? "bg-blue-50/60 border-l-4 border-l-blue-600 font-medium"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Patient Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                            appt.patient_name
                          )} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                        >
                          {getInitials(appt.patient_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {appt.patient_name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>
                              Age {demographics.age} · {demographics.gender}
                            </span>
                          </div>
                          {appt.patient_contact && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                              <Phone className="w-2.5 h-2.5 shrink-0" />
                              <span>{appt.patient_contact}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Appointment ID Column */}
                    <td className="py-3.5 px-3">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100/80 hover:bg-slate-200/80 px-2 py-0.5 rounded font-mono text-[11px] text-slate-700 transition-colors">
                        <span>{displayId}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(appt.id, e)}
                          className="text-slate-400 hover:text-slate-600"
                          title="Copy ID"
                          aria-label={`Copy appointment ID ${displayId}`}
                        >
                          {copiedId === appt.id ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Date & Time Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {formatDisplayDate(appt.date)}
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-slate-400" />
                        <span>
                          {formatTime(appt.start_time)} ({duration})
                        </span>
                      </div>
                    </td>

                    {/* Type Column */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
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
                    </td>

                    {/* Reason Column */}
                    <td className="py-3.5 px-4 max-w-[170px]">
                      <div
                        className="font-medium text-slate-800 truncate"
                        title={appt.reason || "General Consultation"}
                      >
                        {cleanReasonText(appt.reason)}
                      </div>
                      {appt.notes && (
                        <div
                          className="text-[11px] text-slate-400 italic truncate mt-0.5"
                          title={appt.notes}
                        >
                          {appt.notes}
                        </div>
                      )}
                    </td>

                    {/* Status Column */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <AppointmentStatusBadge status={appt.status} />
                    </td>

                    {/* Actions Column */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div
                        className="inline-flex items-center gap-1 relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === appt.id ? null : appt.id)
                          }
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          title="Actions menu"
                          aria-label={`Actions for appointment ${displayId}`}
                          aria-haspopup="true"
                          aria-expanded={activeMenuId === appt.id}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Action Dropdown Menu */}
                        {activeMenuId === appt.id && (
                          <div
                            role="menu"
                            aria-label={`Actions menu for appointment ${displayId}`}
                            className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 text-left divide-y divide-slate-100 animate-in fade-in duration-100"
                          >
                            <div className="py-1">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  onSelectAppointment(appt.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>View Details</span>
                              </button>

                              {isBooked && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    onComplete(appt);
                                    setActiveMenuId(null);
                                  }}
                                  disabled={actionInProgressId === appt.id}
                                  className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Confirm / Complete</span>
                                </button>
                              )}

                              {isBooked && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    onReschedule(appt);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Reschedule</span>
                                </button>
                              )}

                              {isBooked && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    onCancel(appt);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </div>

                            <div className="py-1">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  onOpenPrescription(appt);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Pill className="w-3.5 h-3.5 text-slate-400" />
                                <span>Add Prescription</span>
                              </button>

                              {isVideo && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    onOpenTelehealth(appt);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2"
                                >
                                  <Video className="w-3.5 h-3.5 text-purple-500" />
                                  <span>Join Video Room</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
