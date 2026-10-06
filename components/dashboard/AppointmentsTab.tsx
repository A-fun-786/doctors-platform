"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Search,
  Filter,
  AlertCircle,
  Loader2,
  Calendar,
  RotateCcw,
} from "lucide-react";
import {
  DoctorMeResponse,
  AppointmentEntry,
  AppointmentStatus,
  AvailableSlot,
  getDoctorAppointments,
  createAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getDoctorAvailableSlots,
} from "@/lib/api";

interface AppointmentsTabProps {
  doctor: DoctorMeResponse;
}

export default function AppointmentsTab({ doctor }: AppointmentsTabProps) {
  const [appointments, setAppointments] = useState<AppointmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal: New Appointment
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientContact, setNewPatientContact] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [newReason, setNewReason] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newSubmitting, setNewSubmitting] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  // Modal: Reschedule
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentEntry | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailableSlot[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSlotIndex, setRescheduleSlotIndex] = useState(0);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Modal: Cancel
  const [cancelTarget, setCancelTarget] = useState<AppointmentEntry | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Action in-progress IDs
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { status?: AppointmentStatus; from?: string; to?: string } = {};
      if (statusFilter !== "ALL") {
        params.status = statusFilter as AppointmentStatus;
      }
      if (dateFilter) {
        params.from = dateFilter;
        params.to = dateFilter;
      }
      const res = await getDoctorAppointments(params);
      setAppointments(res.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Load available slots whenever newDate changes (Test 6.4)
  useEffect(() => {
    if (!showNewModal || !newDate) return;
    let isMounted = true;
    async function fetchSlots() {
      try {
        setSlotsLoading(true);
        setNewError(null);
        const slots = await getDoctorAvailableSlots(newDate);
        if (!isMounted) return;
        setAvailableSlots(slots || []);
        setSelectedSlotIndex(0);
      } catch (err: unknown) {
        if (!isMounted) return;
        setNewError(err instanceof Error ? err.message : "Failed to fetch available slots for date");
        setAvailableSlots([]);
      } finally {
        if (isMounted) setSlotsLoading(false);
      }
    }
    fetchSlots();
    return () => {
      isMounted = false;
    };
  }, [newDate, showNewModal]);

  // Load available slots whenever rescheduleDate changes
  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) return;
    let isMounted = true;
    async function fetchRescheduleSlots() {
      try {
        setRescheduleSlotsLoading(true);
        setRescheduleError(null);
        const slots = await getDoctorAvailableSlots(rescheduleDate);
        if (!isMounted) return;
        setRescheduleSlots(slots || []);
        setRescheduleSlotIndex(0);
      } catch (err: unknown) {
        if (!isMounted) return;
        setRescheduleError(err instanceof Error ? err.message : "Failed to load slots");
        setRescheduleSlots([]);
      } finally {
        if (isMounted) setRescheduleSlotsLoading(false);
      }
    }
    fetchRescheduleSlots();
    return () => {
      isMounted = false;
    };
  }, [rescheduleDate, rescheduleTarget]);

  // Optimistic Complete Action (Test 6.5)
  const handleComplete = async (appt: AppointmentEntry) => {
    const originalAppointments = [...appointments];
    // Optimistically update status to COMPLETED immediately
    setAppointments((prev) =>
      prev.map((a) => (a.id === appt.id ? { ...a, status: "COMPLETED" as AppointmentStatus } : a))
    );
    setActionInProgressId(appt.id);
    setSuccess(`Appointment with ${appt.patient_name} marked as COMPLETED.`);
    setTimeout(() => setSuccess(null), 4000);

    try {
      await completeAppointment(appt.id);
    } catch (err: unknown) {
      // Revert optimistic update on failure
      setAppointments(originalAppointments);
      setError(err instanceof Error ? err.message : "Failed to complete appointment");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Cancel Action
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;

    try {
      setCancelSubmitting(true);
      await cancelAppointment(cancelTarget.id);
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === cancelTarget.id ? { ...a, status: "CANCELLED" as AppointmentStatus } : a
        )
      );
      setSuccess(`Appointment with ${cancelTarget.patient_name} cancelled.`);
      setCancelTarget(null);
      setCancelReason("");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel appointment");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Reschedule Action
  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    const slot = rescheduleSlots[rescheduleSlotIndex];
    if (!slot) {
      setRescheduleError("Please select a valid time slot");
      return;
    }

    try {
      setRescheduleSubmitting(true);
      const updated = await rescheduleAppointment(rescheduleTarget.id, {
        date: rescheduleDate,
        start_time: slot.start,
        end_time: slot.end,
      });
      setAppointments((prev) =>
        prev.map((a) => (a.id === rescheduleTarget.id ? updated : a))
      );
      setSuccess(`Appointment rescheduled to ${rescheduleDate} at ${slot.start}.`);
      setRescheduleTarget(null);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setRescheduleError(err instanceof Error ? err.message : "Failed to reschedule appointment");
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Create New Appointment Action
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availableSlots.length === 0) {
      setNewError("No available time slots on this date. Configure working hours first.");
      return;
    }
    const slot = availableSlots[selectedSlotIndex];
    if (!slot) {
      setNewError("Please select an available slot");
      return;
    }

    try {
      setNewSubmitting(true);
      setNewError(null);
      const created = await createAppointment({
        patient_name: newPatientName.trim(),
        patient_contact: newPatientContact.trim() || undefined,
        date: newDate,
        start_time: slot.start,
        end_time: slot.end,
        reason: newReason.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });

      setAppointments((prev) => [created, ...prev]);
      setSuccess(`Appointment for ${created.patient_name} booked successfully!`);
      setShowNewModal(false);
      setNewPatientName("");
      setNewPatientContact("");
      setNewReason("");
      setNewNotes("");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setNewError(err instanceof Error ? err.message : "Failed to book appointment");
    } finally {
      setNewSubmitting(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.patient_name.toLowerCase().includes(q) ||
      (a.patient_contact && a.patient_contact.toLowerCase().includes(q)) ||
      (a.reason && a.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Appointments Management
            </h2>
            <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-2 py-0.5 rounded border border-brand-200">
              Lifecycle
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor, book, reschedule, complete, or cancel consultations with real-time slot synchronization.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewError(null);
            setShowNewModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ New Appointment</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {["ALL", "BOOKED", "COMPLETED", "CANCELLED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search patient, contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none cursor-pointer"
            title="Filter by Date"
          />

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={loadAppointments}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200"
            title="Refresh List"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Appointment Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Loading appointments...</span>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No appointments found</p>
            <p className="text-xs text-slate-500">
              No appointments match the active filters. Create an appointment or adjust filter options.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.map((appt) => {
                  const isBooked = appt.status === "BOOKED";
                  const isCompleted = appt.status === "COMPLETED";
                  const isCancelled = appt.status === "CANCELLED";

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{appt.date}</div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {appt.start_time} - {appt.end_time}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{appt.patient_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {appt.patient_contact || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        <div>{appt.reason || "General Consultation"}</div>
                        {appt.notes && (
                          <div className="text-[11px] text-slate-400 italic truncate">
                            Note: {appt.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isBooked
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isBooked ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleComplete(appt)}
                              disabled={actionInProgressId === appt.id}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                              title="Mark as Completed"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleTarget(appt);
                                setRescheduleDate(appt.date);
                                setRescheduleError(null);
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                              title="Reschedule to New Slot"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(appt);
                                setCancelReason("");
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                              title="Cancel Appointment"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: CREATE NEW APPOINTMENT (Spec 6.5 & Test 6.4) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create New Appointment</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {newError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{newError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Patient Contact (Phone or Email)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +1 555-0199 or patient@example.com"
                  value={newPatientContact}
                  onChange={(e) => setNewPatientContact(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Available Time Slot <span className="text-red-500">*</span>
                  </label>
                  {slotsLoading ? (
                    <div className="h-9 px-3 border border-slate-200 rounded-lg flex items-center text-xs text-slate-400 gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      <span>Fetching slots...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="h-9 px-3 border border-dashed border-red-200 bg-red-50/50 rounded-lg flex items-center text-[11px] text-red-600">
                      No slots on this date
                    </div>
                  ) : (
                    <select
                      value={selectedSlotIndex}
                      onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Visit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular Checkup, Fever, Prescription renewal"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Private Doctor Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Clinical notes or internal remarks (not visible to patient)"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newSubmitting || availableSlots.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {newSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Create Appointment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE APPOINTMENT */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Reschedule Appointment</h3>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Rescheduling appointment for <strong>{rescheduleTarget.patient_name}</strong> (currently{" "}
              {rescheduleTarget.date} at {rescheduleTarget.start_time}).
            </p>

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReschedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  New Date
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  New Available Slot
                </label>
                {rescheduleSlotsLoading ? (
                  <div className="h-9 px-3 border border-slate-200 rounded-lg flex items-center text-xs text-slate-400 gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                    <span>Fetching slots...</span>
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <div className="h-9 px-3 border border-dashed border-red-200 bg-red-50/50 rounded-lg flex items-center text-[11px] text-red-600">
                    No available slots on this date
                  </div>
                ) : (
                  <select
                    value={rescheduleSlotIndex}
                    onChange={(e) => setRescheduleSlotIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  >
                    {rescheduleSlots.map((slot, idx) => (
                      <option key={`${slot.start}-${slot.end}`} value={idx}>
                        {slot.start} - {slot.end}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleSubmitting || rescheduleSlots.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {rescheduleSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Reschedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL APPOINTMENT */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Cancel Appointment</h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel the appointment with{" "}
              <strong>{cancelTarget.patient_name}</strong> on {cancelTarget.date} at{" "}
              {cancelTarget.start_time}? The slot will be returned to available inventory.
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cancellation Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Patient requested cancellation, Doctor unavailable"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {cancelSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Cancel Appointment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
