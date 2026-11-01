"use client";

import React, { useState, useRef } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Camera,
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
  Mail,
  Edit3,
  ShieldCheck,
  X,
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
  // Mode state: false = Clean View Mode (displays saved data), true = Edit Mode Form
  const [isEditing, setIsEditing] = useState(false);

  // Profile fields state
  const [fullName, setFullName] = useState(
    initialProfile?.full_name || doctor.full_name || ""
  );
  const [clinicName, setClinicName] = useState(initialProfile?.clinic_name || "");
  const [location, setLocation] = useState(initialProfile?.location || "");
  const [speciality, setSpeciality] = useState(initialProfile?.speciality || "");
  const [bio, setBio] = useState(initialProfile?.bio || "");
  const [phone, setPhone] = useState(initialProfile?.phone || doctor.phone || "");
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

  // Loading & Feedback states
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Avatar Upload Handler
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
      setUploadingAvatar(true);
      setSaveError(null);
      const res = await uploadDoctorAvatar(file);
      setAvatarUrl(res.avatar_url);
      setSaveSuccess("Profile photo updated successfully.");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to upload avatar photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleService = (key: keyof ServicesConfig) => {
    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Revert changes back to initial state
  const handleCancelEdit = () => {
    setFullName(initialProfile?.full_name || doctor.full_name || "");
    setClinicName(initialProfile?.clinic_name || "");
    setLocation(initialProfile?.location || "");
    setSpeciality(initialProfile?.speciality || "");
    setBio(initialProfile?.bio || "");
    setPhone(initialProfile?.phone || doctor.phone || "");
    setAvatarUrl(initialProfile?.avatar_url || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR);
    setServices(
      initialProfile?.services || {
        appointment: true,
        video_consultation: true,
        medicine_inventory: false,
        lab_reports: false,
      }
    );
    setSaveError(null);
    setIsEditing(false);
  };

  // Save changes to backend
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
      setSaveSuccess("Profile updated successfully! Changes are live on your practice portal.");
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* FEEDBACK NOTIFICATIONS */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-800 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm font-semibold text-red-700 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE: Shows ONLY what the doctor has filled in           */}
      {/* ============================================================== */}
      {!isEditing ? (
        <div className="space-y-6">
          {/* Main Profile Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Card Header with prominent Edit Profile button on the right */}
            <div className="p-5 sm:p-6 md:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Doctor Practice Profile
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your active practice information visible to patients.
                </p>
              </div>

              {/* Prominent Edit Profile Button */}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs hover:shadow transition-all cursor-pointer min-h-[42px] shrink-0"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Doctor Identity Block */}
            <div className="p-5 sm:p-7 md:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                {/* Avatar with quick edit click trigger */}
                <div
                  onClick={() => setIsEditing(true)}
                  className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm shrink-0 bg-slate-50 cursor-pointer group"
                  title="Click to edit profile"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={fullName || "Doctor"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-5 h-5" />
                  </div>
                  {doctor.onboarding_completed && (
                    <div
                      title="Verified Doctor"
                      className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Name, Speciality, Clinic */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {fullName || "Doctor Name"}
                    </h2>
                    {doctor.onboarding_completed && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Verified Doctor
                      </span>
                    )}
                  </div>

                  {speciality ? (
                    <p className="text-sm font-semibold text-brand-600 flex items-center justify-center sm:justify-start gap-1.5">
                      <Stethoscope className="w-4 h-4 shrink-0" />
                      <span>{speciality}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No speciality specified</p>
                  )}

                  {clinicName && (
                    <p className="text-xs text-slate-600 flex items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{clinicName}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Contact & Location Details Grid (Shows only what is filled) */}
              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Location */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Practice Location</span>
                  </span>
                  <p className="text-xs font-semibold text-slate-800">
                    {location || <span className="text-slate-400 font-normal italic">Not specified</span>}
                  </p>
                </div>

                {/* Contact Phone */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Contact Phone</span>
                  </span>
                  <p className="text-xs font-semibold text-slate-800">
                    {phone || <span className="text-slate-400 font-normal italic">Not specified</span>}
                  </p>
                </div>

                {/* Registered Email */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>Registered Email</span>
                  </span>
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {doctor.email}
                  </p>
                </div>
              </div>

              {/* Professional Bio (Shows what is entered) */}
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Professional Bio
                  </span>
                  {!bio && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      + Add Bio
                    </button>
                  )}
                </div>
                {bio ? (
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {bio}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                    No bio added yet. Click &ldquo;Edit Profile&rdquo; to add your medical background and care philosophy.
                  </p>
                )}
              </div>

              {/* Active Practice Services Status */}
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Patient Practice Services
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Configure Services
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Service 1 */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${services.appointment
                        ? "bg-blue-50/50 border-blue-200 text-blue-900"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Calendar className="w-4 h-4" />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${services.appointment
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-200 text-slate-600"
                          }`}
                      >
                        {services.appointment ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">In-Clinic Visits</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Calendar booking</p>
                  </div>

                  {/* Service 2 */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${services.video_consultation
                        ? "bg-indigo-50/50 border-indigo-200 text-indigo-900"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Video className="w-4 h-4" />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${services.video_consultation
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-slate-200 text-slate-600"
                          }`}
                      >
                        {services.video_consultation ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">Video Consult</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Telemedicine calls</p>
                  </div>

                  {/* Service 3 */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${services.medicine_inventory
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Pill className="w-4 h-4" />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${services.medicine_inventory
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                          }`}
                      >
                        {services.medicine_inventory ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">Medicine Orders</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Prescription refill</p>
                  </div>

                  {/* Service 4 */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${services.lab_reports
                        ? "bg-purple-50/50 border-purple-200 text-purple-900"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <FileText className="w-4 h-4" />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${services.lab_reports
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-200 text-slate-600"
                          }`}
                      >
                        {services.lab_reports ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">Lab Diagnostic</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Report uploads</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* EDIT MODE: Form where doctor edits what they want to fill     */
        /* ============================================================== */
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7 md:p-8 space-y-6"
        >
          {/* Top Form Header with Cancel and Save Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-600" />
                <span>Edit Practice Profile</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fill in the details you want displayed to patients on your webpage.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploadingAvatar}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 min-h-[38px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Profile Photo Uploader */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Doctor Profile Photo
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-brand-200 shadow-xs shrink-0 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt="Doctor Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-brand-600" />
                    )}
                    <span>{uploadingAvatar ? "Uploading..." : "Upload Photo"}</span>
                  </button>

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

          {/* Core Doctor Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Doctor Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow min-h-[44px]"
                  placeholder="e.g. Dr. Jane Smith"
                />
              </div>
            </div>

            {/* Speciality */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Speciality / Medical Qualifications
              </label>
              <div className="relative">
                <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow min-h-[44px]"
                  placeholder="e.g. General Physician, MBBS, MD"
                />
              </div>
            </div>

            {/* Clinic Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Clinic / Hospital Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow min-h-[44px]"
                  placeholder="e.g. Apex Polyclinic & Care"
                />
              </div>
            </div>

            {/* Clinic Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Practice Location / City
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow min-h-[44px]"
                  placeholder="e.g. Indiranagar, Bangalore"
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow min-h-[44px]"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>
            </div>
          </div>

          {/* Bio Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Professional Bio &amp; Philosophy
              </label>
              <span className="text-[11px] text-slate-400">{bio.length} characters</span>
            </div>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow leading-relaxed"
              placeholder="Introduce your clinical background, education, and consultation approach to patients..."
            />
          </div>

          {/* Practice Services Toggle */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Patient Practice Services</h3>
              <p className="text-xs text-slate-500">
                Toggle the services visible and bookable by patients on your public webpage.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Service 1 */}
              <div
                onClick={() => toggleService("appointment")}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${services.appointment
                    ? "bg-brand-50/50 border-brand-300 text-brand-900"
                    : "bg-slate-50/50 border-slate-200 text-slate-500"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${services.appointment ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
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
                      onChange={() => { }}
                      className="accent-brand-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Allows patients to select calendar dates and 30-minute booking slots.
                  </p>
                </div>
              </div>

              {/* Service 2 */}
              <div
                onClick={() => toggleService("video_consultation")}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${services.video_consultation
                    ? "bg-indigo-50/50 border-indigo-300 text-indigo-900"
                    : "bg-slate-50/50 border-slate-200 text-slate-500"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${services.video_consultation ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
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
                      onChange={() => { }}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Telemedicine consultations via digital video calls.
                  </p>
                </div>
              </div>

              {/* Service 3 */}
              <div
                onClick={() => toggleService("medicine_inventory")}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${services.medicine_inventory
                    ? "bg-emerald-50/50 border-emerald-300 text-emerald-900"
                    : "bg-slate-50/50 border-slate-200 text-slate-500"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${services.medicine_inventory ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
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
                      onChange={() => { }}
                      className="accent-emerald-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Patients can request medicine deliveries from practice stock.
                  </p>
                </div>
              </div>

              {/* Service 4 */}
              <div
                onClick={() => toggleService("lab_reports")}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${services.lab_reports
                    ? "bg-purple-50/50 border-purple-300 text-purple-900"
                    : "bg-slate-50/50 border-slate-200 text-slate-500"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${services.lab_reports ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-500"
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
                      onChange={() => { }}
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

          {/* Form Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[44px]"
            >
              Cancel &amp; Discard
            </button>

            <button
              type="submit"
              disabled={saving || uploadingAvatar}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
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
      )}
    </div>
  );
}
