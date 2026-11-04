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
    viewActiveBg: "bg-blue-50/50 border-blue-200 text-blue-900",
    viewBadgeActive: "bg-blue-100 text-blue-800",
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
    viewActiveBg: "bg-indigo-50/50 border-indigo-200 text-indigo-900",
    viewBadgeActive: "bg-indigo-100 text-indigo-800",
    editActiveBg: "bg-indigo-50/50 border-indigo-300 text-indigo-900",
    editIconActive: "bg-indigo-600 text-white",
    editCheckboxClass: "accent-indigo-600",
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
    viewActiveBg: "bg-purple-50/50 border-purple-200 text-purple-900",
    viewBadgeActive: "bg-purple-100 text-purple-800",
    editActiveBg: "bg-purple-50/50 border-purple-300 text-purple-900",
    editIconActive: "bg-purple-600 text-white",
    editCheckboxClass: "accent-purple-600",
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

