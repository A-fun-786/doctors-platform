"use client";

import React, { useState } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Camera,
  Upload,
  RotateCcw,
  Calendar,
  Video,
  Pill,
  FileText,
  Loader2,
  User,
  Building2,
  MapPin,
  Stethoscope,
  Phone,
} from "lucide-react";
import {
  DoctorMeResponse,
  DoctorProfileResponse,
  ServicesConfig,
  updateDoctorProfile,
  uploadDoctorAvatar,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";

interface ProfileTabProps {
  doctor: DoctorMeResponse;
  initialProfile: DoctorProfileResponse | null;
  onProfileUpdated: (updated: DoctorProfileResponse) => void;
}

export default function ProfileTab({
  doctor,
  initialProfile,
  onProfileUpdated,
}: ProfileTabProps) {
  const [fullName, setFullName] = useState(
    initialProfile?.full_name || doctor.full_name || ""
  );
  const [clinicName, setClinicName] = useState(initialProfile?.clinic_name || "");
  const [location, setLocation] = useState(initialProfile?.location || "");
  const [speciality, setSpeciality] = useState(initialProfile?.speciality || "");
  const [bio, setBio] = useState(initialProfile?.bio || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string>(
    initialProfile?.avatar_url || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR
  );
  const [services, setServices] = useState<ServicesConfig>(
    initialProfile?.services || {
      appointment: true,
      video_consultation: true,
      medicine_inventory: false,
      lab_reports: false,
    }
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Please select a valid image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Image file size should be less than 2MB.");
      return;
    }
    try {
      setSaveError(null);
      const res = await uploadDoctorAvatar(file);
      setAvatarUrl(res.avatar_url);
      setSaveSuccess("Avatar photo uploaded successfully.");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to upload avatar photo.");
    }
  };

  const toggleService = (key: keyof ServicesConfig) => {
    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const updated = await updateDoctorProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
        clinic_name: clinicName.trim(),
        location: location.trim(),
        speciality: speciality.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        services,
      });

      onProfileUpdated(updated);
      setSaveSuccess("Practice details and services updated! Changes are live on your patient webpage.");
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Edit Practice Profile &amp; Services
            </h2>
            <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-2 py-0.5 rounded border border-brand-200">
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Any changes made here are instantly reflected on your patient-facing webpage.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Photo Section */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Doctor Profile Photo
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-brand-200 shadow-sm shrink-0 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt="Doctor Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-1.5 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs cursor-pointer transition-colors">
                  <Camera className="w-3.5 h-3.5 text-brand-600" />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>
                {avatarUrl !== DEFAULT_DOCTOR_AVATAR && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(DEFAULT_DOCTOR_AVATAR)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Recommended: Square image (at least 400x400px), under 2MB (PNG, JPG, WebP).
              </p>
            </div>
          </div>
        </div>

        {/* Basic Practice Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Doctor Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Dr. Jane Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Clinic / Hospital Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Apex Polyclinic &amp; Care"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Speciality / Title
            </label>
            <div className="relative">
              <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={speciality}
                onChange={(e) => setSpeciality(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="General Physician, MBBS, MD"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Clinic Location / City
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Indiranagar, Bangalore"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Professional Bio
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Introduce your clinical background, education, and consultation approach to patients..."
          />
        </div>

        {/* Practice Services Toggle */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Patient Practice Services</h3>
            <p className="text-xs text-slate-500">
              Toggle the services visible and bookable by patients on your public webpage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Appointment Booking */}
            <div
              onClick={() => toggleService("appointment")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                services.appointment
                  ? "bg-brand-50/50 border-brand-300 text-brand-900"
                  : "bg-slate-50/50 border-slate-200 text-slate-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  services.appointment ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">In-Clinic Appointments</span>
                  <input
                    type="checkbox"
                    checked={services.appointment}
                    onChange={() => {}}
                    className="accent-brand-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Allows patients to select calendar dates and 30-minute booking slots.
                </p>
              </div>
            </div>

            {/* Video Consultation */}
            <div
              onClick={() => toggleService("video_consultation")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                services.video_consultation
                  ? "bg-indigo-50/50 border-indigo-300 text-indigo-900"
                  : "bg-slate-50/50 border-slate-200 text-slate-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  services.video_consultation ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                <Video className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Video Consultation</span>
                  <input
                    type="checkbox"
                    checked={services.video_consultation}
                    onChange={() => {}}
                    className="accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Telemedicine consultations via digital video calls.
                </p>
              </div>
            </div>

            {/* Medicine Inventory */}
            <div
              onClick={() => toggleService("medicine_inventory")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                services.medicine_inventory
                  ? "bg-emerald-50/50 border-emerald-300 text-emerald-900"
                  : "bg-slate-50/50 border-slate-200 text-slate-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  services.medicine_inventory ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                <Pill className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Medicine Orders</span>
                  <input
                    type="checkbox"
                    checked={services.medicine_inventory}
                    onChange={() => {}}
                    className="accent-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Patients can request medicine deliveries from practice stock.
                </p>
              </div>
            </div>

            {/* Lab Reports */}
            <div
              onClick={() => toggleService("lab_reports")}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                services.lab_reports
                  ? "bg-purple-50/50 border-purple-300 text-purple-900"
                  : "bg-slate-50/50 border-slate-200 text-slate-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  services.lab_reports ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Lab Reports Portal</span>
                  <input
                    type="checkbox"
                    checked={services.lab_reports}
                    onChange={() => {}}
                    className="accent-purple-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Allow patients to upload diagnostic files for your review.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Practice Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
