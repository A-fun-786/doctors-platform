"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Calendar,
  Video,
  Pill,
  FileText,
  ArrowRight,
  ArrowLeft,
  Building2,
  MapPin,
  Stethoscope,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
  ShieldCheck,
  Camera,
  Upload,
  RotateCcw,
} from "lucide-react";
import {
  getDoctorProfile,
  updateDoctorProfile,
  DoctorProfileResponse,
  ServicesConfig,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";

const SPECIALITY_SUGGESTIONS = [
  "General Physician",
  "Cardiologist",
  "Dermatologist",
  "Pediatrician",
  "Gynecologist & Obstetrician",
  "Orthopedic Surgeon",
  "Neurologist",
  "ENT Specialist",
  "Psychiatrist",
  "Dentist",
  "Ophthalmologist",
  "Endocrinologist",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [copied, setCopied] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [location, setLocation] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>(DEFAULT_DOCTOR_AVATAR);

  // Services selection
  const [services, setServices] = useState<ServicesConfig>({
    appointment: true,
    video_consultation: true,
    medicine_inventory: false,
    lab_reports: false,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getDoctorProfile();
        setFullName(profile.full_name || "");
        setClinicName(profile.clinic_name || "");
        setLocation(profile.location || "");
        setSpeciality(profile.speciality || "");
        setBio(profile.bio || "");
        setPhone(profile.phone || "");
        setTenantSlug(profile.tenant_slug || "");
        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
        if (profile.services) {
          setServices(profile.services);
        }

        // If doctor already completed onboarding, allow viewing/editing but default to step 1
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load doctor profile. Please log in again.");
        }
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image file size should be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleService = (key: keyof ServicesConfig) => {
    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!clinicName.trim()) {
      setError("Please enter your clinic or hospital name.");
      return;
    }
    if (!speciality.trim()) {
      setError("Please select or enter your medical speciality.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleCompleteOnboarding = async () => {
    try {
      setSaving(true);
      setError(null);

      const updated = await updateDoctorProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
        clinic_name: clinicName.trim(),
        location: location.trim(),
        speciality: speciality.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        services,
        onboarding_completed: true,
      });

      if (updated.tenant_slug) {
        setTenantSlug(updated.tenant_slug);
      }
      setStep(3);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save onboarding configuration. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const patientUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${tenantSlug}`
    : `/${tenantSlug}`;

  const copyPatientLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(patientUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md mb-4">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Preparing practice onboarding...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">DocSpace</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Practice Onboarding</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        {/* Step Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Step {step} of 3
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-600">
                {step === 1 && "Doctor & Clinic Profile"}
                {step === 2 && "Platform Services"}
                {step === 3 && "Practice Ready"}
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {step === 1 ? "33%" : step === 2 ? "66%" : "100%"}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* STEP 1: DOCTOR & CLINIC DETAILS */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Practice &amp; Doctor Details
              </h1>
              <p className="text-sm text-slate-600">
                Enter your practice details. These will be highlighted on your patient-facing webpage.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-6">
              {/* Doctor Profile Image Upload */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Doctor Profile Photo
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-brand-200 shadow-sm shrink-0 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt="Doctor Profile Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                      {avatarUrl !== DEFAULT_DOCTOR_AVATAR && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl(DEFAULT_DOCTOR_AVATAR)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset to Default</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {avatarUrl === DEFAULT_DOCTOR_AVATAR
                        ? "Currently using default healthcare avatar. You can upload your own custom photo (PNG, JPG, WebP)."
                        : "Custom photo selected. This will appear on your patient portal."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Doctor Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Doctor Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Ahmed Khan, MD"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Clinic Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinic / Hospital Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Apex Health Clinic & Care Center"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Speciality */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Primary Speciality <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  placeholder="e.g. Cardiologist or General Physician"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors mb-2"
                />
                {/* Suggestions pill list */}
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALITY_SUGGESTIONS.slice(0, 6).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSpeciality(item)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        speciality === item
                          ? "bg-brand-50 border-brand-300 text-brand-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinic Location / Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. 402 Medical Arts Tower, 5th Avenue, New York, NY"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Practice Contact Phone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 234-5678"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* About Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  About Section / Doctor Bio
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your medical background, certifications, experience, and patient care philosophy..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-y"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <span>Continue to Services</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: SERVICES SELECTION */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Select Platform Services
              </h1>
              <p className="text-sm text-slate-600">
                Choose the services you want to offer patients through your personalized practice portal. You can change these anytime from your dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Service 1: In-Clinic Appointments */}
              <div
                onClick={() => toggleService("appointment")}
                className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                  services.appointment
                    ? "border-brand-500 bg-brand-50/40 shadow-sm ring-1 ring-brand-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        services.appointment
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {services.appointment && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">In-Clinic Appointments</h3>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Enable patients to view available calendar slots and book in-person consultations online.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-brand-700 bg-brand-100/60 px-2 py-0.5 rounded">
                    Patient Booking
                  </span>
                </div>
              </div>

              {/* Service 2: Video Consultation */}
              <div
                onClick={() => toggleService("video_consultation")}
                className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                  services.video_consultation
                    ? "border-brand-500 bg-brand-50/40 shadow-sm ring-1 ring-brand-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Video className="w-5 h-5" />
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        services.video_consultation
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {services.video_consultation && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Video Consultation</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Provide telehealth sessions with scheduled video appointment booking for patients anywhere.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded">
                    Telehealth
                  </span>
                </div>
              </div>

              {/* Service 3: Medicine Inventory & Orders */}
              <div
                onClick={() => toggleService("medicine_inventory")}
                className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                  services.medicine_inventory
                    ? "border-brand-500 bg-brand-50/40 shadow-sm ring-1 ring-brand-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        services.medicine_inventory
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {services.medicine_inventory && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Medicine Inventory &amp; Orders</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Manage clinic pharmacy supplies and allow patients to request prescribed medicines and refills.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                    Pharmacy Management
                  </span>
                </div>
              </div>

              {/* Service 4: Lab Reports Management */}
              <div
                onClick={() => toggleService("lab_reports")}
                className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                  services.lab_reports
                    ? "border-brand-500 bg-brand-50/40 shadow-sm ring-1 ring-brand-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        services.lab_reports
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {services.lab_reports && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Lab Reports Management</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Allow patients to upload diagnostic tests, pathology, and imaging reports directly for review.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded">
                    Diagnostics &amp; Records
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleCompleteOnboarding}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Practice...</span>
                  </>
                ) : (
                  <>
                    <span>Publish &amp; Launch Webpage</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS & LAUNCH */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Practice Webpage is Live!
              </h1>
              <p className="text-sm text-slate-600">
                Congratulations, <span className="font-semibold text-slate-900">{fullName}</span>! Your dedicated patient portal has been provisioned and is ready for appointments and inquiries.
              </p>
            </div>

            {/* URL Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-lg mx-auto">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2 text-left">
                Your Public Patient Link
              </span>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2.5">
                <input
                  type="text"
                  readOnly
                  value={patientUrl}
                  className="bg-transparent text-xs sm:text-sm font-mono text-slate-800 flex-1 outline-none truncate"
                />
                <button
                  type="button"
                  onClick={copyPatientLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 transition-colors shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href={`/${tenantSlug}`}
                target="_blank"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                <span>View Patient Webpage</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
              >
                <span>Go to Doctor Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
