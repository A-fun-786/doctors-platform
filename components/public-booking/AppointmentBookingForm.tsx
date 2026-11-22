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
  AlertCircle,
} from "lucide-react";
import {
  PublicDoctorProfileResponse,
  AvailableSlot,
  bookPublicAppointment,
  getPublicAvailableSlots,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";
import { format12Hour, formatDateToYYYYMMDD } from "@/components/dashboard/calendar/calendarUtils";
import { logger } from "@/lib/logger";
import Toast from "@/components/ui/Toast";
import TimeSlotPicker from "./TimeSlotPicker";
import BookingConfirmationCard from "./BookingConfirmationCard";

export interface AppointmentBookingFormProps {
  doctor: PublicDoctorProfileResponse;
  slug: string;
  consultationType: "in_clinic" | "video_consultation";
  onReturnHome: () => void;
  staffId?: string;
  staff_id?: string;
}

export default function AppointmentBookingForm({
  doctor,
  slug,
  consultationType,
  onReturnHome,
  staffId,
  staff_id,
}: AppointmentBookingFormProps) {
  const activeStaffId = staffId || staff_id;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

  // Set default date to tomorrow in local YYYY-MM-DD format (avoids UTC drift)
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(formatDateToYYYYMMDD(tomorrow));
  }, []);

  // Today in local YYYY-MM-DD format to prevent past-date selection
  const minDate = formatDateToYYYYMMDD(new Date());

  // Load available slots dynamically on date or practitioner change
  useEffect(() => {
    if (!slug || !date) {
      setAvailableSlots([]);
      setSelectedSlot("");
      return;
    }
    let isMounted = true;
    setSlotsLoading(true);
    setErrorMessage(null);

    getPublicAvailableSlots(slug, date, activeStaffId)
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
        logger.error(
          "PublicBooking",
          `Failed to load ${consultationType} available slots`,
          err,
          { slug, date, consultationType, staffId: activeStaffId }
        );
        if (isMounted) {
          setAvailableSlots([]);
          setSelectedSlot("");
          setErrorMessage("Failed to load available slots. Please try another date.");
        }
      })
      .finally(() => {
        if (isMounted) setSlotsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug, date, consultationType, activeStaffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    if (!selectedSlot) {
      setErrorMessage("Please select an available time slot before confirming.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      logger.action("PublicBooking", `Submitting ${consultationType} booking request`, {
        slug,
        date,
        selectedSlot,
        patientName,
        staffId: activeStaffId,
      });

      const res = await bookPublicAppointment(slug, {
        patient_name: patientName,
        patient_email: patientEmail,
        patient_phone: patientPhone,
        appointment_date: date,
        appointment_time: selectedSlot,
        appointment_type: consultationType,
        notes: notes,
        ...(activeStaffId ? { staff_id: activeStaffId } : {}),
      });

      logger.info("PublicBooking", `Appointment booked successfully (${res.booking_id})`, {
        bookingId: res.booking_id,
        slug,
        consultationType,
      });

      setSuccessBookingId(res.booking_id);
    } catch (err: unknown) {
      const fallbackMsg = `Failed to ${isInClinic ? "book appointment" : "schedule video consultation"}`;
      const msg = err instanceof Error ? err.message : fallbackMsg;
      setErrorMessage(msg);
      logger.error("PublicBooking", msg, err, {
        slug,
        date,
        selectedSlot,
        consultationType,
        staffId: activeStaffId,
      });
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
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {errorMessage && <Toast message={errorMessage} type="error" />}

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
              {/* Inline Error Alert Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Booking could not be processed</p>
                    <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{errorMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    aria-label="Dismiss error notification"
                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <span className="sr-only">Dismiss</span>
                    ✕
                  </button>
                </div>
              )}

              {/* Shared Time Slot Picker */}
              <TimeSlotPicker
                selectedDate={date}
                onDateChange={(newDate) => {
                  setDate(newDate);
                  if (errorMessage) setErrorMessage(null);
                }}
                availableSlots={availableSlots}
                slotsLoading={slotsLoading}
                selectedSlot={selectedSlot}
                onSelectSlot={(newSlot) => {
                  setSelectedSlot(newSlot);
                  if (errorMessage) setErrorMessage(null);
                }}
                minDate={minDate}
                dateInputId="booking-preferred-date"
                dateLabel={isInClinic ? "Preferred Date" : "Consultation Date"}
                slotLabel={isInClinic ? "Preferred Time Slot" : "Consultation Time Slot"}
                emptyMessage="No available slots on this date. Please choose another date."
              />

              {/* Patient Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label
                    htmlFor="booking-patient-name"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Patient Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="booking-patient-name"
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => {
                        setPatientName(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Full name"
                      className="w-full h-10 pl-11 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="booking-patient-phone"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Contact Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="booking-patient-phone"
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => {
                        setPatientPhone(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="+1 (555) 000-0000"
                      className="w-full h-10 pl-11 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="booking-patient-email"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="booking-patient-email"
                      type="email"
                      required
                      value={patientEmail}
                      onChange={(e) => {
                        setPatientEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="patient@example.com"
                      className="w-full h-10 pl-11 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="booking-visit-notes"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Reason for Visit / Symptoms
                </label>
                <textarea
                  id="booking-visit-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Describe symptoms, routine check-up, follow-up, or general health concerns..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
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
