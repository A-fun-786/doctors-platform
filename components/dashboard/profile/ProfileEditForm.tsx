"use client";

import React from "react";
import {
  Save,
  Loader2,
  User,
  Building2,
  MapPin,
  Stethoscope,
  Phone,
  Edit3,
} from "lucide-react";
import { ProfileEditFormProps, SERVICE_DEFINITIONS } from "./types";
import AvatarUploader from "./AvatarUploader";

interface ExtendedProfileEditFormProps extends ProfileEditFormProps {
  onAvatarError: (msg: string) => void;
}

export default function ProfileEditForm({
  fullName,
  clinicName,
  location,
  speciality,
  bio,
  phone,
  displayAvatar,
  services,
  saving,
  onFullNameChange,
  onClinicNameChange,
  onLocationChange,
  onSpecialityChange,
  onBioChange,
  onPhoneChange,
  onToggleService,
  onSelectAvatarFile,
  onResetAvatar,
  onCancel,
  onSubmit,
  onAvatarError,
}: ExtendedProfileEditFormProps) {
  return (
    <form
      onSubmit={onSubmit}
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
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[38px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
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

      {/* Profile Photo Uploader (Buffers locally before save) */}
      <AvatarUploader
        displayAvatar={displayAvatar}
        isSaving={saving}
        onFileSelect={onSelectAvatarFile}
        onReset={onResetAvatar}
        onError={onAvatarError}
      />

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
              maxLength={60}
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
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
              maxLength={100}
              value={speciality}
              onChange={(e) => onSpecialityChange(e.target.value)}
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
              maxLength={100}
              value={clinicName}
              onChange={(e) => onClinicNameChange(e.target.value)}
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
              maxLength={100}
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
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
              type="tel"
              maxLength={20}
              value={phone}
              onChange={(e) => {
                // Allow digits, plus, spaces, dashes, parentheses
                const val = e.target.value.replace(/[^\d+()\s-]/g, "");
                onPhoneChange(val);
              }}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow min-h-[44px]"
              placeholder="e.g. +91 98765 43210"
            />
          </div>
        </div>
      </div>

      {/* Bio Textarea with Character Limit Counter */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Professional Bio &amp; Philosophy
          </label>
          <span className={`text-[11px] font-medium ${bio.length >= 480 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
            {bio.length} / 500 characters
          </span>
        </div>
        <textarea
          rows={4}
          maxLength={500}
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow leading-relaxed"
          placeholder="Introduce your clinical background, education, and consultation approach to patients..."
        />
      </div>

      {/* Practice Services Toggle - DRY Mapped */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Patient Practice Services</h3>
          <p className="text-xs text-slate-500">
            Toggle the services visible and bookable by patients on your public webpage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {SERVICE_DEFINITIONS.map((def) => {
            const Icon = def.icon;
            const isEnabled = !!services[def.key];
            return (
              <div
                key={def.key}
                onClick={() => onToggleService(def.key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  isEnabled
                    ? def.editActiveBg
                    : "bg-slate-50/50 border-slate-200 text-slate-500"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isEnabled ? def.editIconActive : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{def.editLabel}</span>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {}}
                      className={def.editCheckboxClass}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {def.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[44px] disabled:opacity-50"
        >
          Cancel &amp; Discard
        </button>

        <button
          type="submit"
          disabled={saving}
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
  );
}

