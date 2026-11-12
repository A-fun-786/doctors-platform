"use client";

import React from "react";
import { CheckCircle2, Home } from "lucide-react";

export interface BookingConfirmationCardProps {
  bookingId: string;
  consultationType: "in_clinic" | "video_consultation";
  doctorName: string;
  onReset: () => void;
  onReturnHome: () => void;
}

export default function BookingConfirmationCard({
  bookingId,
  consultationType,
  doctorName,
  onReset,
  onReturnHome,
}: BookingConfirmationCardProps) {
  const isInClinic = consultationType === "in_clinic";

  return (
    <div className="p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-xl font-bold text-slate-900">
          {isInClinic ? "Appointment Confirmed!" : "Teleconsultation Scheduled!"}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {isInClinic ? (
            <>
              Your in-clinic booking reference is{" "}
              <span className="font-mono font-bold text-slate-900">{bookingId}</span>. An appointment notification has been forwarded to {doctorName}.
            </>
          ) : (
            <>
              Your booking ID is{" "}
              <span className="font-mono font-bold text-slate-900">{bookingId}</span>. A secure consultation link will be dispatched via email and SMS prior to your appointment.
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer text-center"
        >
          <span>{isInClinic ? "Book Another Appointment" : "Schedule Another Video Call"}</span>
        </button>
        <button
          type="button"
          onClick={onReturnHome}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer text-center"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Practice Home</span>
        </button>
      </div>
    </div>
  );
}

