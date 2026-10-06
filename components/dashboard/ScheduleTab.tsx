"use client";

import React, { useEffect, useState } from "react";
import {
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  AlertTriangle,
  Coffee,
  CalendarDays,
  ShieldAlert,
} from "lucide-react";
import {
  DoctorMeResponse,
  ScheduleEntry,
  ScheduleType,
  getDoctorSchedule,
  createDoctorSchedule,
  deleteDoctorSchedule,
} from "@/lib/api";

interface ScheduleTabProps {
  doctor: DoctorMeResponse;
}

export default function ScheduleTab({ doctor }: ScheduleTabProps) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State for Adding Working Hours
  const [showAddWorkingModal, setShowAddWorkingModal] = useState(false);
  const [whDate, setWhDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [whStartTime, setWhStartTime] = useState("09:00");
  const [whEndTime, setWhEndTime] = useState("17:00");
  const [whSubmitting, setWhSubmitting] = useState(false);
  const [whError, setWhError] = useState<string | null>(null);

  // Form State for Adding Leave / Holiday / Block
  const [showAddExclusionModal, setShowAddExclusionModal] = useState(false);
  const [exType, setExType] = useState<"LEAVE" | "HOLIDAY" | "BLOCKED">("LEAVE");
  const [exDate, setExDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [exStartTime, setExStartTime] = useState("09:00");
  const [exEndTime, setExEndTime] = useState("17:00");
  const [exReason, setExReason] = useState("");
  const [exSubmitting, setExSubmitting] = useState(false);
  const [exError, setExError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDoctorSchedule();
      setSchedules(res.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load schedule entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  // Submit Working Hours with validation (Test 6.3)
  const handleAddWorkingHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhError(null);

    // Test 6.3 client-side validation
    if (whEndTime <= whStartTime) {
      setWhError("End time must be after start time");
      return;
    }

    try {
      setWhSubmitting(true);
      await createDoctorSchedule({
        date: whDate,
        start_time: whStartTime,
        end_time: whEndTime,
        type: "AVAILABLE",
      });
      setSuccess("Working hours added successfully!");
      setShowAddWorkingModal(false);
      setWhDate(new Date().toISOString().split("T")[0]);
      setWhStartTime("09:00");
      setWhEndTime("17:00");
      setTimeout(() => setSuccess(null), 4000);
      await loadSchedules();
    } catch (err: unknown) {
      setWhError(err instanceof Error ? err.message : "Failed to add working hours");
    } finally {
      setWhSubmitting(false);
    }
  };

  // Submit Leave / Holiday / Block
  const handleAddExclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    setExError(null);

    if (exEndTime <= exStartTime) {
      setExError("End time must be after start time");
      return;
    }

    try {
      setExSubmitting(true);
      await createDoctorSchedule({
        date: exDate,
        start_time: exStartTime,
        end_time: exEndTime,
        type: exType,
        reason: exReason.trim() || undefined,
      });
      setSuccess(`${exType} period recorded successfully!`);
      setShowAddExclusionModal(false);
      setExReason("");
      setTimeout(() => setSuccess(null), 4000);
      await loadSchedules();
    } catch (err: unknown) {
      setExError(err instanceof Error ? err.message : `Failed to record ${exType}`);
    } finally {
      setExSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Are you sure you want to remove this schedule entry?")) return;
    try {
      setDeletingId(id);
      await deleteDoctorSchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      setSuccess("Schedule entry removed.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete schedule entry");
    } finally {
      setDeletingId(null);
    }
  };

  const workingHoursList = schedules.filter((s) => s.type === "AVAILABLE");
  const exclusionsList = schedules.filter(
    (s) => s.type === "LEAVE" || s.type === "HOLIDAY" || s.type === "BLOCKED"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Schedule &amp; Availability Management
            </h2>
            <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-2 py-0.5 rounded border border-brand-200">
              Live Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Define daily working windows, mark leaves, holidays, or block intervals to control booking slot generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setWhError(null);
              setShowAddWorkingModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Working Hours</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setExError(null);
              setExType("LEAVE");
              setShowAddExclusionModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
          >
            <Coffee className="w-3.5 h-3.5 text-slate-600" />
            <span>Mark Leave / Block</span>
          </button>
        </div>
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

      {/* SECTION 1: WORKING HOURS (AVAILABLE) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">Working Hours (Available for Booking)</h3>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
            {workingHoursList.length} Entries
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-slate-500 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>Loading schedule data...</span>
          </div>
        ) : workingHoursList.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No working hours configured</p>
            <p className="text-xs text-slate-500">
              Add your consultation windows to allow patients to book 30-minute appointments.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAddWorkingModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Working Hours</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {workingHoursList.map((entry) => (
              <div
                key={entry.id}
                className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      Date: <span className="font-mono text-slate-800">{entry.date}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Time: <span className="font-mono font-medium">{entry.start_time} - {entry.end_time}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSchedule(entry.id)}
                  disabled={deletingId === entry.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Entry"
                >
                  {deletingId === entry.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: LEAVE / HOLIDAYS / BLOCKS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Leave, Holidays &amp; Blocked Hours</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setExType("LEAVE");
                setShowAddExclusionModal(true);
              }}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md border border-slate-200 transition-colors"
            >
              Mark Leave
            </button>
            <button
              type="button"
              onClick={() => {
                setExType("HOLIDAY");
                setShowAddExclusionModal(true);
              }}
              className="text-xs px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-md border border-purple-200 transition-colors"
            >
              Add Holiday
            </button>
            <button
              type="button"
              onClick={() => {
                setExType("BLOCKED");
                setShowAddExclusionModal(true);
              }}
              className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-md border border-amber-200 transition-colors"
            >
              Block Slot
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-6 flex items-center justify-center text-slate-500 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>Loading exclusion records...</span>
          </div>
        ) : exclusionsList.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-medium text-slate-500">
              No leave, holidays, or blocked slots recorded.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {exclusionsList.map((entry) => (
              <div
                key={entry.id}
                className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      entry.type === "LEAVE"
                        ? "bg-slate-100 text-slate-700"
                        : entry.type === "HOLIDAY"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {entry.type === "LEAVE" ? (
                      <Coffee className="w-4 h-4" />
                    ) : entry.type === "HOLIDAY" ? (
                      <Calendar className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{entry.type}</span>
                      {entry.reason && (
                        <span className="text-xs text-slate-500 italic">
                          ({entry.reason})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Date: <span className="font-mono text-slate-800">{entry.date}</span> &bull; Time:{" "}
                      <span className="font-mono font-medium">{entry.start_time} - {entry.end_time}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSchedule(entry.id)}
                  disabled={deletingId === entry.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Entry"
                >
                  {deletingId === entry.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADD WORKING HOURS */}
      {showAddWorkingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Working Hours</h3>
              <button
                type="button"
                onClick={() => setShowAddWorkingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {whError && (
              <div
                id="wh-error-alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{whError}</span>
              </div>
            )}

            <form onSubmit={handleAddWorkingHours} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={whDate}
                  onChange={(e) => setWhDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={whStartTime}
                    onChange={(e) => setWhStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={whEndTime}
                    onChange={(e) => setWhEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddWorkingModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={whSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {whSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Save Working Hours</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD LEAVE / HOLIDAY / BLOCK */}
      {showAddExclusionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Mark Leave, Holiday, or Blocked Slot
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExclusionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {exError && (
              <div
                id="ex-error-alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{exError}</span>
              </div>
            )}

            <form onSubmit={handleAddExclusion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Exclusion Type
                </label>
                <select
                  value={exType}
                  onChange={(e) => setExType(e.target.value as "LEAVE" | "HOLIDAY" | "BLOCKED")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="LEAVE">LEAVE (Doctor off-duty)</option>
                  <option value="HOLIDAY">HOLIDAY (Official public holiday)</option>
                  <option value="BLOCKED">BLOCKED (Specific hours unavailable)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={exDate}
                  onChange={(e) => setExDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={exStartTime}
                    onChange={(e) => setExStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={exEndTime}
                    onChange={(e) => setExEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Eid Holiday, Medical Conference, Personal Work"
                  value={exReason}
                  onChange={(e) => setExReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExclusionModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={exSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {exSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Save Exclusion</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
