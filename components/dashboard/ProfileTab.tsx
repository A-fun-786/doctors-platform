"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import {
  DoctorMeResponse,
  DoctorProfileResponse,
  ServicesConfig,
  updateDoctorProfile,
  uploadDoctorAvatar,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";
import ProfileViewCard from "./profile/ProfileViewCard";
import ProfileEditForm from "./profile/ProfileEditForm";

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

  // Avatar lifecycle buffer state (avoids orphaned uploads if cancelled)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);

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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Clean up object URLs on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl);
      }
    };
  }, [previewAvatarUrl]);

  // Buffer avatar file locally without immediate network upload
  const handleSelectAvatarFile = (file: File) => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    const newPreviewUrl = URL.createObjectURL(file);
    setPendingAvatarFile(file);
    setPreviewAvatarUrl(newPreviewUrl);
    setSaveError(null);
  };

  const handleResetAvatar = () => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setPendingAvatarFile(null);
    setPreviewAvatarUrl(null);
    setAvatarUrl(DEFAULT_DOCTOR_AVATAR);
  };

  const toggleService = (key: keyof ServicesConfig) => {
    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Revert changes back to initial state
  const handleCancelEdit = () => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }
    setPendingAvatarFile(null);
    setPreviewAvatarUrl(null);

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

      let finalAvatarUrl = avatarUrl;

      // Only upload the buffered avatar file when the user actually commits the save
      if (pendingAvatarFile) {
        const uploadRes = await uploadDoctorAvatar(pendingAvatarFile);
        finalAvatarUrl = uploadRes.avatar_url;
        setAvatarUrl(finalAvatarUrl);
        setPendingAvatarFile(null);
        if (previewAvatarUrl) {
          URL.revokeObjectURL(previewAvatarUrl);
          setPreviewAvatarUrl(null);
        }
      }

      const updated = await updateDoctorProfile({
        full_name: fullName.trim(),
        avatar_url: finalAvatarUrl,
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

  const currentDisplayAvatar = previewAvatarUrl || avatarUrl;

  return (
    <div className="space-y-6">
      {/* Feedback Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-800 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
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
            className="text-red-700 hover:text-red-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isEditing ? (
        <ProfileViewCard
          doctor={doctor}
          fullName={fullName}
          clinicName={clinicName}
          location={location}
          speciality={speciality}
          bio={bio}
          phone={phone}
          avatarUrl={avatarUrl}
          services={services}
          onEditClick={() => setIsEditing(true)}
        />
      ) : (
        <ProfileEditForm
          fullName={fullName}
          clinicName={clinicName}
          location={location}
          speciality={speciality}
          bio={bio}
          phone={phone}
          displayAvatar={currentDisplayAvatar}
          services={services}
          saving={saving}
          onFullNameChange={setFullName}
          onClinicNameChange={setClinicName}
          onLocationChange={setLocation}
          onSpecialityChange={setSpeciality}
          onBioChange={setBio}
          onPhoneChange={setPhone}
          onToggleService={toggleService}
          onSelectAvatarFile={handleSelectAvatarFile}
          onResetAvatar={handleResetAvatar}
          onCancel={handleCancelEdit}
          onSubmit={handleSaveProfile}
          onAvatarError={setSaveError}
        />
      )}
    </div>
  );
}
