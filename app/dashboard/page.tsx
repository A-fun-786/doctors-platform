"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  LogOut,
  Building2,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Calendar,
  Video,
  Pill,
  FileText,
  Copy,
  Check,
  Globe,
  Sparkles,
  MapPin,
  Stethoscope,
  Phone,
  AlertTriangle,
  Save,
  Upload,
  RotateCcw,
  Camera,
  Smartphone,
  Download,
  QrCode,
  RefreshCw,
  Terminal,
} from "lucide-react";
import {
  getCurrentDoctor,
  getDoctorProfile,
  updateDoctorProfile,
  removeAuthToken,
  getAppPreview,
  uploadAppIcon,
  triggerAppBuild,
  getAppBuildStatus,
  getAppBuildLogs,
  getAppDownloadUrl,
  DoctorMeResponse,
  DoctorProfileResponse,
  ServicesConfig,
  AppPreviewResponse,
  AppBuildStatusResponse,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<DoctorMeResponse | null>(null);
  const [profile, setProfile] = useState<DoctorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Practice Form State
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [location, setLocation] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>(DEFAULT_DOCTOR_AVATAR);
  const [services, setServices] = useState<ServicesConfig>({
    appointment: true,
    video_consultation: true,
    medicine_inventory: false,
    lab_reports: false,
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Android App Generator State
  const [appPreview, setAppPreview] = useState<AppPreviewResponse | null>(null);
  const [appIconPreview, setAppIconPreview] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconUploadSuccess, setIconUploadSuccess] = useState<string | null>(null);
  const [buildingApp, setBuildingApp] = useState(false);
  const [buildTaskId, setBuildTaskId] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<AppBuildStatusResponse | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [copiedApkUrl, setCopiedApkUrl] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string>("");

  useEffect(() => {
    async function loadDoctor() {
      try {
        const [meData, profileData, previewData] = await Promise.all([
          getCurrentDoctor(),
          getDoctorProfile().catch(() => null),
          getAppPreview().catch(() => null),
        ]);
        setDoctor(meData);
        if (previewData) {
          setAppPreview(previewData);
          if (previewData.latest_apk) {
            setBuildStatus(previewData.latest_apk);
            setBuildTaskId(previewData.latest_apk.task_id);
          }
        }
        if (profileData) {
          setProfile(profileData);
          setFullName(profileData.full_name || meData.full_name || "");
          setClinicName(profileData.clinic_name || "");
          setLocation(profileData.location || "");
          setSpeciality(profileData.speciality || "");
          setBio(profileData.bio || "");
          setPhone(profileData.phone || "");
          if (profileData.avatar_url) {
            setAvatarUrl(profileData.avatar_url);
          } else if (meData.avatar_url) {
            setAvatarUrl(meData.avatar_url);
          }
          if (profileData.services) {
            setServices(profileData.services);
          }
        } else {
          setFullName(meData.full_name || "");
          if (meData.avatar_url) {
            setAvatarUrl(meData.avatar_url);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load doctor profile.");
        }
        // Redirect to login on authentication failure
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadDoctor();
  }, [router]);

  const handleLogout = () => {
    removeAuthToken();
    router.replace("/login");
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Poll for Android App build status
  useEffect(() => {
    if (!buildTaskId || buildStatus?.status === "completed" || buildStatus?.status === "failed") {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await getAppBuildStatus(buildTaskId);
        setBuildStatus(res);
        if (showLogs) {
          getAppBuildLogs(buildTaskId).then(l => setBuildLogs(l.logs)).catch(() => {});
        }
        if (res.status === "completed") {
          setBuildingApp(false);
          getAppBuildLogs(buildTaskId).then(l => setBuildLogs(l.logs)).catch(() => {});
        } else if (res.status === "failed") {
          setBuildingApp(false);
          setBuildError(res.error || "Compilation failed. Check build logs.");
          getAppBuildLogs(buildTaskId).then(l => setBuildLogs(l.logs)).catch(() => {});
        }
      } catch (err: unknown) {
        setBuildingApp(false);
        setBuildError(err instanceof Error ? err.message : "Error checking build status");
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [buildTaskId, buildStatus?.status, showLogs]);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG or JPG).");
      return;
    }
    try {
      setUploadingIcon(true);
      setIconUploadSuccess(null);
      await uploadAppIcon(file);
      setAppIconPreview(URL.createObjectURL(file));
      setIconUploadSuccess("Custom app icon updated successfully!");
      const updatedPreview = await getAppPreview().catch(() => null);
      if (updatedPreview) setAppPreview(updatedPreview);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to upload icon");
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleStartBuild = async () => {
    try {
      setBuildingApp(true);
      setBuildError(null);
      setBuildStatus(null);
      setShowLogs(true);
      setBuildLogs("Initializing build workspace...\nPreparing Android template injection...\n");
      const res = await triggerAppBuild();
      setBuildTaskId(res.task_id);
      setBuildStatus({
        task_id: res.task_id,
        status: "preparing",
        progress: 15,
        app_name: res.app_name,
        package_name: res.package_name,
      });
    } catch (err: unknown) {
      setBuildingApp(false);
      setBuildError(err instanceof Error ? err.message : "Failed to initiate app compilation");
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

      setProfile(updated);
      setDoctor((prev) => (prev ? { ...prev, full_name: updated.full_name, phone: updated.phone, avatar_url: updated.avatar_url } : prev));
      setSaveSuccess("Practice details and services updated! Changes are live on your patient webpage.");
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError("Failed to update profile settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>Verifying session and loading workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">DocSpace</span>
            </Link>
            <span className="text-slate-300 font-light">|</span>
            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              Doctor Portal
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 pr-2 border-r border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
                alt={doctor.full_name}
                className="w-9 h-9 rounded-full border border-slate-200 object-cover"
              />
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900 leading-none">{doctor.full_name}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-none">{doctor.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        {/* Incomplete Onboarding Banner */}
        {doctor && !doctor.onboarding_completed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Finish Practice Setup &amp; Launch Patient Webpage
                </h3>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  Your profile and practice services are not yet published. Complete the setup wizard to launch your patient portal.
                </p>
              </div>
            </div>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
            >
              <span>Complete Setup</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-brand-600 via-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium border border-white/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Authenticated &amp; Workspace Active</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Welcome, {doctor.full_name}
            </h1>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              Manage your practice details, enable platform services, and monitor your patient-facing webpage.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Patient-Facing Webpage Card */}
        {doctor.tenant?.slug && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">Your Live Patient Webpage</h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live &amp; Synced
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Patients can use this link to book appointments, teleconsultations, order medicines, and submit reports.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    navigator.clipboard.writeText(`${origin}/${doctor.tenant?.slug}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied Link!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Patient Link</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/${doctor.tenant.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors"
                >
                  <span>Visit Webpage</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Active Services Badges */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-2">Active Services:</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border ${
                  services.appointment
                    ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>Appointments</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border ${
                  services.video_consultation
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                }`}
              >
                <Video className="w-3 h-3" />
                <span>Video Consult</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border ${
                  services.medicine_inventory
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                }`}
              >
                <Pill className="w-3 h-3" />
                <span>Medicine Orders</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border ${
                  services.lab_reports
                    ? "bg-purple-50 border-purple-200 text-purple-700 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Lab Reports</span>
              </span>
            </div>
          </div>
        )}

        {/* Practice Profile & Services Editor */}
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
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {saveError}
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
                    alt="Doctor Profile Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload New Photo</span>
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
                        <span>Use Default Photo</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {avatarUrl === DEFAULT_DOCTOR_AVATAR
                      ? "Currently using default healthcare avatar. Click 'Upload New Photo' to use your own image."
                      : "Custom photo active. Click 'Save & Sync Changes' below to update your patient portal."}
                  </p>
                </div>
              </div>
            </div>

            {/* Doctor Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Doctor Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Medical Speciality <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  placeholder="e.g. Cardiologist"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinic / Hospital Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Metropolitan Medical Center"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinic Location / Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. 500 Medical Plaza, Suite 400"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Practice Contact Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  About Section / Doctor Bio
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share qualifications, experience, and clinic information for patients..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Services Toggle Grid */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Offer Platform Services (Toggle to show/hide on patient page)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Appointment */}
                <div
                  onClick={() => toggleService("appointment")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    services.appointment
                      ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">In-Clinic Appointments</p>
                      <p className="text-[11px] text-slate-500">Slot booking &amp; scheduling</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      services.appointment
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {services.appointment && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* 2. Video Consultation */}
                <div
                  onClick={() => toggleService("video_consultation")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    services.video_consultation
                      ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Video Consultation</p>
                      <p className="text-[11px] text-slate-500">Telehealth appointments</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      services.video_consultation
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {services.video_consultation && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* 3. Medicine Inventory */}
                <div
                  onClick={() => toggleService("medicine_inventory")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    services.medicine_inventory
                      ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Medicine Inventory &amp; Orders</p>
                      <p className="text-[11px] text-slate-500">Prescription ordering &amp; refills</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      services.medicine_inventory
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {services.medicine_inventory && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* 4. Lab Reports */}
                <div
                  onClick={() => toggleService("lab_reports")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    services.lab_reports
                      ? "bg-purple-50/50 border-purple-300 ring-1 ring-purple-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Lab Reports Management</p>
                      <p className="text-[11px] text-slate-500">Patient test report uploads</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      services.lab_reports
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {services.lab_reports && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Updates...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save &amp; Sync Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION: YOUR BRANDED ANDROID APP */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Your Branded Android App
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/30">
                    Native Jetpack Compose
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Generate a standalone, installable APK for your practice that patients can download directly
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 self-start sm:self-auto font-mono">
              Offline-First Architecture
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Identity & Custom Icon Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* App Identity Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Application Package &amp; Metadata
                </h3>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 font-medium">Application Launcher Name</label>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {appPreview?.app_name || clinicName || `${fullName}'s Clinic`}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 font-medium">Android Package Identifier</label>
                    <div className="text-xs font-mono font-semibold text-brand-700 bg-white px-2.5 py-1.5 rounded border border-slate-200 mt-0.5 truncate">
                      {appPreview?.package_name || `com.docspace.${(fullName || "doctor").toLowerCase().replace(/[^a-z0-9]/g, "")}.${(clinicName || "clinic").toLowerCase().replace(/[^a-z0-9]/g, "")}`}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Unique per-doctor package namespace for clean coexistence on patient devices.
                    </p>
                  </div>
                </div>

                {/* Patient Installation Guide Tip */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-brand-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>How Patients Install This App</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Share your download link or QR code with patients. When downloading, Android will prompt: <em>&quot;Install from unknown sources&quot;</em>. Patients approve once, and your practice app is immediately installed on their home screen!
                  </p>
                </div>
              </div>

              {/* App Launcher Icon Management */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  App Launcher Icon
                </h3>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col sm:flex-row items-center gap-5">
                  {/* Icon Box */}
                  <div className="w-20 h-20 rounded-2xl bg-brand-600 border-2 border-brand-200 shadow-md flex items-center justify-center text-white shrink-0 overflow-hidden relative">
                    {appIconPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={appIconPreview}
                        alt="App Icon"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Activity className="w-10 h-10" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {appIconPreview ? "Custom Launcher Icon Active" : "Default DocSpace Icon"}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        PNG or JPG recommended (512x512px). Used on patient home screens.
                      </p>
                    </div>

                    <div>
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-xs transition-colors">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>{uploadingIcon ? "Uploading..." : "Change App Icon"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={handleIconUpload}
                          disabled={uploadingIcon}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {iconUploadSuccess && (
                      <p className="text-xs text-emerald-600 font-medium">
                        {iconUploadSuccess}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Build & Compilation Controls */}
            <div className="pt-6 border-t border-slate-100">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Compile Release APK
                  </h4>
                  <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                    Builds your personalized Kotlin + Jetpack Compose Android package with your latest profile, services, and logo bundled directly inside.
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleStartBuild}
                    disabled={buildingApp}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    {buildingApp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Building APK...</span>
                      </>
                    ) : buildStatus?.status === "completed" ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Rebuild Android App</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Generate Android App</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Active Build Status Progress */}
              {buildingApp && buildStatus && (
                <div className="mt-4 p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand-900">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      <span>Packaging {buildStatus.app_name}...</span>
                    </span>
                    <span>{buildStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(buildStatus.progress, 20)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Injecting {buildStatus.package_name} configurations and assembling Android binaries...
                  </p>
                </div>
              )}

              {/* Build Error Notice */}
              {buildError && (
                <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Build Notice</span>
                    <span className="text-[11px] leading-relaxed block mt-0.5">
                      {buildError}
                    </span>
                  </div>
                </div>
              )}

              {/* Completed APK Ready State */}
              {buildStatus?.status === "completed" && (
                <div className="mt-6 p-6 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {buildStatus.app_name} APK is Ready!
                        </div>
                        <p className="text-xs text-slate-600 font-mono">
                          {buildStatus.apk_filename} {buildStatus.file_size ? `(${(buildStatus.file_size / (1024 * 1024)).toFixed(1)} MB)` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={getAppDownloadUrl(buildStatus.task_id)}
                        download
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download APK</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const url = getAppDownloadUrl(buildStatus.task_id);
                          navigator.clipboard.writeText(url);
                          setCopiedApkUrl(true);
                          setTimeout(() => setCopiedApkUrl(false), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors"
                      >
                        {copiedApkUrl ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Build Console Box */}
              {buildTaskId && (
                <div className="mt-5 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !showLogs;
                        setShowLogs(nextState);
                        if (nextState && buildTaskId) {
                          getAppBuildLogs(buildTaskId).then((l) => setBuildLogs(l.logs)).catch(() => {});
                        }
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-brand-600 flex items-center gap-1.5 transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>{showLogs ? "Hide Live Build Console" : "View Live Build Console & Compiler Output"}</span>
                    </button>
                    {showLogs && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Auto-refreshing every 2.5s
                      </span>
                    )}
                  </div>

                  {showLogs && (
                    <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto border border-slate-800 shadow-inner">
                      <pre className="whitespace-pre-wrap">
                        {buildLogs || "Waiting for compiler output..."}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Identity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tenant Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Workspace</span>
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">
                {doctor.tenant?.slug || "pending"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Unique multi-tenant slug identifier</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Status:</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Isolation
              </span>
            </div>
          </div>

          {/* Account Profile Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doctor Account</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900 truncate">{doctor.full_name}</p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{doctor.email}</span>
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Auth Provider:</span>
              <span className="capitalize font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {doctor.auth_provider}
              </span>
            </div>
          </div>

          {/* Security & Token Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Security State</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">JWT Bearer Protected</p>
              <p className="text-xs text-slate-500">Stateless, token-based verification via FastAPI backend</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Doctor ID:</span>
              <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]">{doctor.id}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
