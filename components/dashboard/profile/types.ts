import React from "react";
import { Calendar, Video, Pill, FileText } from "lucide-react";
import {
  DoctorMeResponse,
  DoctorProfileResponse,
  ServicesConfig,
} from "@/lib/api";

export interface ServiceDefinition {
  key: keyof ServicesConfig;
  name: string;
  editLabel: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  viewActiveBg: string;
  viewBadgeActive: string;
  editActiveBg: string;
  editIconActive: string;
  editCheckboxClass: string;
}

export const SERVICE_DEFINITIONS: readonly ServiceDefinition[] = [
  {
    key: "appointment",
    name: "In-Clinic Visits",
    editLabel: "In-Clinic Appointments",
    tagline: "Calendar booking",
    description: "Allows patients to select calendar dates and 30-minute booking slots.",
    icon: Calendar,
    viewActiveBg: "bg-brand-50/60 border-brand-200 text-brand-950",
    viewBadgeActive: "bg-brand-100 text-brand-800",
    editActiveBg: "bg-brand-50/50 border-brand-300 text-brand-900",
    editIconActive: "bg-brand-600 text-white",
    editCheckboxClass: "accent-brand-600",
  },
  {
    key: "video_consultation",
    name: "Video Consult",
    editLabel: "Video Consultation",
    tagline: "Telemedicine calls",
    description: "Telemedicine consultations via digital video calls.",
    icon: Video,
    viewActiveBg: "bg-teal-50/50 border-teal-200 text-teal-950",
    viewBadgeActive: "bg-teal-100 text-teal-800",
    editActiveBg: "bg-teal-50/50 border-teal-300 text-teal-950",
    editIconActive: "bg-teal-600 text-white",
    editCheckboxClass: "accent-teal-600",
  },
  {
    key: "medicine_inventory",
    name: "Medicine Orders",
    editLabel: "Medicine Orders",
    tagline: "Prescription refill",
    description: "Patients can request medicine deliveries from practice stock.",
    icon: Pill,
    viewActiveBg: "bg-emerald-50/50 border-emerald-200 text-emerald-900",
    viewBadgeActive: "bg-emerald-100 text-emerald-800",
    editActiveBg: "bg-emerald-50/50 border-emerald-300 text-emerald-900",
    editIconActive: "bg-emerald-600 text-white",
    editCheckboxClass: "accent-emerald-600",
  },
  {
    key: "lab_reports",
    name: "Lab Diagnostic",
    editLabel: "Lab Reports Portal",
    tagline: "Report uploads",
    description: "Allow patients to upload diagnostic files for your review.",
    icon: FileText,
    viewActiveBg: "bg-slate-100/70 border-slate-200 text-slate-800",
    viewBadgeActive: "bg-slate-200 text-slate-700",
    editActiveBg: "bg-slate-100/70 border-slate-300 text-slate-800",
    editIconActive: "bg-brand-700 text-white",
    editCheckboxClass: "accent-brand-700",
  },
] as const;

export interface ProfileViewCardProps {
  doctor: DoctorMeResponse;
  fullName: string;
  clinicName: string;
  location: string;
  speciality: string;
  bio: string;
  phone: string;
  avatarUrl: string;
  services: ServicesConfig;
  onEditClick: () => void;
}

export interface ProfileEditFormProps {
  fullName: string;
  clinicName: string;
  location: string;
  speciality: string;
  bio: string;
  phone: string;
  displayAvatar: string;
  services: ServicesConfig;
  saving: boolean;
  onFullNameChange: (val: string) => void;
  onClinicNameChange: (val: string) => void;
  onLocationChange: (val: string) => void;
  onSpecialityChange: (val: string) => void;
  onBioChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onToggleService: (key: keyof ServicesConfig) => void;
  onSelectAvatarFile: (file: File) => void;
  onResetAvatar: () => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

