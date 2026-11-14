"use client";

import React from "react";
import {
  Camera,
  ShieldCheck,
  Stethoscope,
  Building2,
  MapPin,
  Phone,
  Mail,
  Edit3,
} from "lucide-react";
import { ProfileViewCardProps, SERVICE_DEFINITIONS } from "./types";

export default function ProfileViewCard({
  doctor,
  fullName,
  clinicName,
  location,
  speciality,
  bio,
  phone,
  avatarUrl,
  services,
  onEditClick,
}: ProfileViewCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Card Header with prominent Edit Profile button */}
      <div className="p-5 sm:p-6 md:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Doctor Practice Profile
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your active practice information visible to patients.
          </p>
        </div>

        <button
          type="button"
          onClick={onEditClick}
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
            onClick={onEditClick}
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

        {/* Contact & Location Details Grid */}
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Practice Location</span>
            </span>
            <p className="text-xs font-semibold text-slate-800">
              {location || <span className="text-slate-400 font-normal italic">Not specified</span>}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>Contact Phone</span>
            </span>
            <p className="text-xs font-semibold text-slate-800">
              {phone || <span className="text-slate-400 font-normal italic">Not specified</span>}
            </p>
          </div>

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

        {/* Professional Bio */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Professional Bio
            </span>
            {!bio && (
              <button
                type="button"
                onClick={onEditClick}
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

        {/* Active Practice Services Status - DRY Mapped */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Patient Practice Services
            </span>
            <button
              type="button"
              onClick={onEditClick}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Configure Services
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {SERVICE_DEFINITIONS.map((def) => {
              const Icon = def.icon;
              const isEnabled = !!services[def.key];
              return (
                <div
                  key={def.key}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isEnabled
                      ? def.viewActiveBg
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className="w-4 h-4" />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isEnabled
                          ? def.viewBadgeActive
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isEnabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{def.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{def.tagline}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

