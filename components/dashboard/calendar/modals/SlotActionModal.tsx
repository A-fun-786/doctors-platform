"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  User,
  Coffee,
  Phone,
  Activity,
  AlertTriangle,
  Check,
  Loader2,
  HeartPulse,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { CalendarEvent } from "@/lib/api";
import { format12Hour, findConflictingEvents } from "../calendarUtils";

export interface SlotBookingFormData {
  patientName: string;
  patientContact: string;
  patientGender: string;
  patientAge: string;
  reason: string;
  patientHeight?: string;
  patientWeight?: string;
  patientBloodGroup?: string;
  patientAddress?: string;
  notes?: string;
}

export interface SlotLeaveFormData {
  reason: string;
}

interface SlotActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  startTime: string;
  endTime: string;
  initialTab?: "booking" | "leave";
  submitting?: boolean;
  onBookPatient: (data: SlotBookingFormData) => Promise<void> | void;
  onMarkLeave: (data: SlotLeaveFormData) => Promise<void> | void;
  existingEvents?: CalendarEvent[];
}

const COMMON_VISIT_REASONS = [
  "General Consultation",
  "Follow-up Consultation",
  "Fever & Cold",
  "Routine Health Check",
  "Prescription Refill",
  "Lab Report Review",
  "Chronic Disease Check",
];

const COMMON_LEAVE_REASONS = [
  "Personal Leave",
  "Emergency / Off Duty",
  "Medical Conference / CME",
  "Hospital Surgery Rounds",
  "Administrative Work",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function SlotActionModal({
  isOpen,
  onClose,
  date,
  startTime,
  endTime,
  initialTab = "booking",
  submitting = false,
  onBookPatient,
  onMarkLeave,
  existingEvents = [],
}: SlotActionModalProps) {
  const [activeTab, setActiveTab] = useState<"booking" | "leave">(initialTab);

  // Sync activeTab when modal opens with initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Booking Form State
  const [patientName, setPatientName] = useState("");
  const [patientContact, setPatientContact] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [reason, setReason] = useState("General Consultation");
  const [customReason, setCustomReason] = useState("");
  const [patientHeight, setPatientHeight] = useState("");
  const [patientWeight, setPatientWeight] = useState("");
  const [patientBloodGroup, setPatientBloodGroup] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Leave Form State
  const [leaveReason, setLeaveReason] = useState("Personal Leave");
  const [customLeaveReason, setCustomLeaveReason] = useState("");


  // Formatted date and time strings
  const formattedDateStr = useMemo(() => {
    if (!date) return "";
    try {
      const d = new Date(date + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }, [date]);

  const formattedTimeWindow = useMemo(() => {
    if (!startTime || !endTime) return "";
    return `${format12Hour(startTime)} – ${format12Hour(endTime)} (30 min)`;
  }, [startTime, endTime]);

  // Conflict detection with existing events
  const conflicts = useMemo(() => {
    if (!startTime || !endTime) return [];
    return findConflictingEvents(startTime, endTime, existingEvents);
  }, [startTime, endTime, existingEvents]);

  const hasConflict = conflicts.length > 0;

  // Validation: 5 mandatory fields for booking
  const effectiveReason = reason === "Other" ? customReason.trim() : reason.trim();
  const isBookingValid = useMemo(() => {
    return (
      patientName.trim().length >= 1 &&
      patientContact.trim().length >= 5 &&
      (patientGender === "Male" || patientGender === "Female" || patientGender === "Other") &&
      patientAge.trim().length > 0 &&
      !isNaN(Number(patientAge)) &&
      Number(patientAge) >= 0 &&
      Number(patientAge) <= 130 &&
      effectiveReason.length >= 1 &&
      !hasConflict
    );
  }, [
    patientName,
    patientContact,
    patientGender,
    patientAge,
    effectiveReason,
    hasConflict,
  ]);

  const effectiveLeaveReason =
    leaveReason === "Other" ? customLeaveReason.trim() : leaveReason.trim();
  const isLeaveValid = effectiveLeaveReason.length >= 1 && !hasConflict;

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBookingValid || submitting) return;

    await onBookPatient({
      patientName: patientName.trim(),
      patientContact: patientContact.trim(),
      patientGender,
      patientAge: patientAge.trim(),
      reason: effectiveReason,
      patientHeight: patientHeight.trim() || undefined,
      patientWeight: patientWeight.trim() || undefined,
      patientBloodGroup: patientBloodGroup || undefined,
      patientAddress: patientAddress.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLeaveValid || submitting) return;

    await onMarkLeave({
      reason: effectiveLeaveReason,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <h2 className="text-base font-bold text-slate-900">Slot Action</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formattedDateStr} • {formattedTimeWindow}
          </p>
        </div>
      }
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Slot Info Header Card */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              {formattedDateStr} • {formattedTimeWindow}
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800">
            Open Slot
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("booking")}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "booking"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Book Patient</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leave")}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "leave"
                ? "bg-white text-amber-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Doctor Leave</span>
          </button>
        </div>

        {/* Conflict Warning Banner */}
        {hasConflict && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Slot Collision Detected</p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                This slot overlaps with an existing{" "}
                {conflicts[0].type.toLowerCase()} (
                {conflicts[0].patient_name || conflicts[0].reason || "occupied"}
                ). Booking or leave is disabled until the slot is cleared.
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: BOOK PATIENT */}
        {activeTab === "booking" && (
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            {/* Mandatory Fields Notice */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-100">
              <span className="font-semibold text-slate-700">Patient Details</span>
              <span className="text-rose-500 font-medium">* Required fields</span>
            </div>

            {/* Row 1: Name & Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Neha Verma"
                    className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={patientContact}
                    onChange={(e) => setPatientContact(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 2: Gender & Age */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age (years) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="130"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="e.g. 28"
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Row 3: Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Visit Reason <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer mb-2"
              >
                {COMMON_VISIT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="Other">Other (Custom Reason)</option>
              </select>
              {reason === "Other" && (
                <input
                  type="text"
                  required
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter specific visit reason"
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              )}
            </div>

            {/* Optional Section: Clinical Vitals & Address */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-700">
                <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
                <span>Clinical Vitals & Address (Optional)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={patientBloodGroup}
                    onChange={(e) => setPatientBloodGroup(e.target.value)}
                    className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">Select Group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Height
                  </label>
                  <input
                    type="text"
                    value={patientHeight}
                    onChange={(e) => setPatientHeight(e.target.value)}
                    placeholder="e.g. 175 cm"
                    className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Weight
                  </label>
                  <input
                    type="text"
                    value={patientWeight}
                    onChange={(e) => setPatientWeight(e.target.value)}
                    placeholder="e.g. 70 kg"
                    className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={patientAddress}
                      onChange={(e) => setPatientAddress(e.target.value)}
                      placeholder="e.g. Flat 402, Green Valley"
                      className="w-full text-xs font-medium pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Clinical Notes
                  </label>
                  <textarea
                    rows={1}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observations, allergies, or past history"
                    className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isBookingValid || submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Booking...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Book Appointment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: DOCTOR LEAVE */}
        {activeTab === "leave" && (
          <form onSubmit={handleLeaveSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs">
              <p className="font-semibold mb-0.5">Marking Slot as Doctor Leave</p>
              <p className="text-[11px] text-amber-800">
                This will block this 30-minute interval on your schedule and
                prevent patient bookings.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Leave Reason <span className="text-rose-500">*</span>
              </label>
              <select
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer mb-2"
              >
                {COMMON_LEAVE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="Other">Other (Custom Reason)</option>
              </select>

              {leaveReason === "Other" && (
                <input
                  type="text"
                  required
                  value={customLeaveReason}
                  onChange={(e) => setCustomLeaveReason(e.target.value)}
                  placeholder="Enter specific leave reason"
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              )}
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isLeaveValid || submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Marking Leave...</span>
                  </>
                ) : (
                  <>
                    <Coffee className="w-4 h-4 shrink-0" />
                    <span>Mark Leave for this Slot</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
