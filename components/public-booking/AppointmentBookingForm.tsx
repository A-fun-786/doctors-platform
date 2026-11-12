"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Video,
  ChevronRight,
  User,
  Phone,
  Mail,
  Loader2,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import {
  PublicDoctorProfileResponse,
  AvailableSlot,
  bookPublicAppointment,
  getPublicAvailableSlots,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";
import { format12Hour } from "@/components/dashboard/calendar/calendarUtils";
import TimeSlotPicker from "./TimeSlotPicker";
import BookingConfirmationCard from "./BookingConfirmationCard";

export interface AppointmentBookingFormProps {
  doctor: PublicDoctorProfileResponse;
  slug: string;
  consultationType: "in_clinic" | "video_consultation";
  onReturnHome: () => void;
}

export default function AppointmentBookingForm({
  doctor,
  slug,
  consultationType,
  onReturnHome,
}: AppointmentBookingFormProps) {
  const isInClinic = consultationType === "in_clinic";

  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

  // Set default date to tomorrow in YYYY-MM-DD format
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  // Load available slots dynamically on date change
  useEffect(() => {
    if (!slug || !date) {
      setAvailableSlots([]);
      setSelectedSlot("");
      return;
    }
    let isMounted = true;
    setSlotsLoading(true);
    getPublicAvailableSlots(slug, date)
      .then((slots) => {
        if (isMounted) {
          const list = slots || [];
          setAvailableSlots(list);
          if (list.length > 0) {
            setSelectedSlot(format12Hour(list[0].start));
          } else {
            setSelectedSlot("");
          }
        }
      })
      .catch((err) => {
        console.error(`Failed to load ${consultationType} available slots:`, err);
        if (isMounted) {
          setAvailableSlots([]);
          setSelectedSlot("");
        }
      })
      .finally(() => {
        if (isMounted) setSlotsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [slug, date, consultationType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    if (!selectedSlot) {
      alert("Please select an available time slot");
      return;
    }
    try {
      setSubmitting(true);
      const res = await bookPublicAppointment(slug, {
        patient_name: patientName,
        patient_email: patientEmail,
        patient_phone: patientPhone,
        appointment_date: date,
        appointment_time: selectedSlot,
        appointment_type: consultationType,
        notes: notes,
      });
      setSuccessBookingId(res.booking_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Failed to ${isInClinic ? "book appointment" : "schedule video consultation"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessBookingId(null);
    setPatientName("");
    setPatientEmail("");
    setPatientPhone("");
    setNotes("");
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onReturnHome}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Practice Home</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={onReturnHome}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <span className="font-semibold text-slate-800">
            {isInClinic ? "In-Clinic Appointments" : "Video Consultation"}
          </span>
        </div>
      </div>

      {/* Doctor Context Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
            alt={doctor.full_name}
            className="w-12 h-12 rounded-xl object-cover border border-slate-200"
          />
          <div>
            <h3 className="text-sm font-bold text-slate-900">{doctor.full_name}</h3>
            <p className="text-xs text-slate-500">
              {doctor.speciality || "Healthcare Practitioner"} • {isInClinic ? (doctor.clinic_name || "Doctor's Clinic") : "Online Video Consultation"}
            </p>
          </div>
        </div>
        {isInClinic ? (
          doctor.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{doctor.location}</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg self-start sm:self-auto">
            <Video className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span>HD Video Room • Encrypted Patient Call</span>
          </div>
        )}
      </div>

      <section id={isInClinic ? "appointments" : "teleconsult"} className="scroll-mt-24">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Section Gradient Header */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
                {isInClinic ? <Calendar className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {isInClinic ? "Book In-Clinic Appointment" : "Schedule Video Consultation"}
                </h2>
                <p className="text-xs text-brand-100">
                  {isInClinic
                    ? "Select your preferred date & available time slot for clinic visit"
                    : "Join a remote telehealth consultation from home via secure high-definition video"}
                </p>
              </div>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-md self-start sm:self-auto font-medium">
              {isInClinic ? (doctor.clinic_name || "Doctor's Clinic") : "Telehealth Portal"}
            </div>
          </div>

          {successBookingId ? (
            <BookingConfirmationCard
              bookingId={successBookingId}
              consultationType={consultationType}
              doctorName={doctor.full_name}
              onReset={handleReset}
              onReturnHome={onReturnHome}
            />
          ) : (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {/* Shared Time Slot Picker */}
              <TimeSlotPicker
                selectedDate={date}
                onDateChange={setDate}
                availableSlots={availableSlots}
                slotsLoading={slotsLoading}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                dateLabel={isInClinic ? "Preferred Date" : "Consultation Date"}
                slotLabel={isInClinic ? "Preferred Time Slot" : "Consultation Time Slot"}
                emptyMessage="No available slots on this date. Please choose another date."
              />

              {/* Patient Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Patient Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Full name"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Contact Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="patient@example.com"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Visit / Symptoms
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe symptoms, routine check-up, follow-up, or general health concerns..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <span>{isInClinic ? "Confirm Appointment" : "Book Telehealth Video Call"}</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

