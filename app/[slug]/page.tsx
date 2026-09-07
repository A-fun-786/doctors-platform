"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Calendar,
  Video,
  Pill,
  FileText,
  Clock,
  MapPin,
  Building2,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UploadCloud,
  ChevronRight,
  Send,
  User,
  Mail,
  Home,
  ArrowLeft,
  Sparkles,
  HeartPulse,
  Stethoscope,
} from "lucide-react";
import {
  getPublicDoctorProfile,
  bookPublicAppointment,
  uploadPublicReport,
  orderPublicMedicine,
  PublicDoctorProfileResponse,
  DEFAULT_DOCTOR_AVATAR,
} from "@/lib/api";

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:30 AM",
  "02:00 PM",
  "03:30 PM",
  "04:45 PM",
];

export default function PatientDoctorPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";

  type TabType = "home" | "appointments" | "teleconsult" | "medicines" | "reports";
  const [activeTab, setActiveTab] = useState<TabType>("home");

  const navigateToTab = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const [doctor, setDoctor] = useState<PublicDoctorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-Clinic Appointment form
  const [inClinicDate, setInClinicDate] = useState("");
  const [inClinicSlot, setInClinicSlot] = useState(TIME_SLOTS[0]);
  const [inClinicName, setInClinicName] = useState("");
  const [inClinicEmail, setInClinicEmail] = useState("");
  const [inClinicPhone, setInClinicPhone] = useState("");
  const [inClinicNotes, setInClinicNotes] = useState("");
  const [inClinicSubmitting, setInClinicSubmitting] = useState(false);
  const [inClinicSuccess, setInClinicSuccess] = useState<string | null>(null);

  // Video Consultation form
  const [videoDate, setVideoDate] = useState("");
  const [videoSlot, setVideoSlot] = useState(TIME_SLOTS[1]);
  const [videoName, setVideoName] = useState("");
  const [videoEmail, setVideoEmail] = useState("");
  const [videoPhone, setVideoPhone] = useState("");
  const [videoNotes, setVideoNotes] = useState("");
  const [videoSubmitting, setVideoSubmitting] = useState(false);
  const [videoSuccess, setVideoSuccess] = useState<string | null>(null);

  // Medicine Order form
  const [medPatientName, setMedPatientName] = useState("");
  const [medPhone, setMedPhone] = useState("");
  const [medAddress, setMedAddress] = useState("");
  const [medList, setMedList] = useState("");
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [medSuccess, setMedSuccess] = useState<string | null>(null);

  // Lab Report Upload form
  const [repPatientName, setRepPatientName] = useState("");
  const [repPhone, setRepPhone] = useState("");
  const [repType, setRepType] = useState("Blood Work & Pathology");
  const [repFileName, setRepFileName] = useState("");
  const [repNotes, setRepNotes] = useState("");
  const [repSubmitting, setRepSubmitting] = useState(false);
  const [repSuccess, setRepSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    // Set default date to tomorrow in YYYY-MM-DD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    setInClinicDate(dateStr);
    setVideoDate(dateStr);

    async function fetchProfile() {
      try {
        setLoading(true);
        setNotFound(false);
        setErrorMessage(null);
        const data = await getPublicDoctorProfile(slug);
        setDoctor(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.toLowerCase().includes("not found")) {
          setNotFound(true);
        } else {
          setErrorMessage("Unable to load doctor practice profile at this moment.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [slug]);

  useEffect(() => {
    if (doctor) {
      const s = doctor.services || {};
      if (activeTab === "appointments" && !s.appointment) setActiveTab("home");
      if (activeTab === "teleconsult" && !s.video_consultation) setActiveTab("home");
      if (activeTab === "medicines" && !s.medicine_inventory) setActiveTab("home");
      if (activeTab === "reports" && !s.lab_reports) setActiveTab("home");
    }
  }, [activeTab, doctor]);

  // Handle In-Clinic Appointment
  const handleInClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    try {
      setInClinicSubmitting(true);
      const res = await bookPublicAppointment(slug, {
        patient_name: inClinicName,
        patient_email: inClinicEmail,
        patient_phone: inClinicPhone,
        appointment_date: inClinicDate,
        appointment_time: inClinicSlot,
        appointment_type: "in_clinic",
        notes: inClinicNotes,
      });
      setInClinicSuccess(res.booking_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to book appointment");
    } finally {
      setInClinicSubmitting(false);
    }
  };

  // Handle Video Consultation
  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    try {
      setVideoSubmitting(true);
      const res = await bookPublicAppointment(slug, {
        patient_name: videoName,
        patient_email: videoEmail,
        patient_phone: videoPhone,
        appointment_date: videoDate,
        appointment_time: videoSlot,
        appointment_type: "video_consultation",
        notes: videoNotes,
      });
      setVideoSuccess(res.booking_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to schedule video consultation");
    } finally {
      setVideoSubmitting(false);
    }
  };

  // Handle Medicine Order
  const handleMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    try {
      setMedSubmitting(true);
      const res = await orderPublicMedicine(slug, {
        patient_name: medPatientName,
        patient_phone: medPhone,
        delivery_address: medAddress,
        medicines: medList,
      });
      setMedSuccess(res.order_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to submit medicine order");
    } finally {
      setMedSubmitting(false);
    }
  };

  // Handle Lab Report Upload
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    try {
      setRepSubmitting(true);
      const res = await uploadPublicReport(slug, {
        patient_name: repPatientName,
        patient_phone: repPhone,
        report_type: repType,
        file_name: repFileName || "diagnostic_lab_report.pdf",
        notes: repNotes,
      });
      setRepSuccess(res.report_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to upload report");
    } finally {
      setRepSubmitting(false);
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
          <span>Loading practice profile...</span>
        </div>
      </div>
    );
  }

  if (notFound || !doctor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Practice Not Found
        </h1>
        <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          {errorMessage || `The doctor practice page for "${slug}" does not exist or may currently be inactive.`}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <span>DocSpace Home</span>
        </Link>
      </div>
    );
  }

  const { services } = doctor;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Patient Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">DocSpace</span>
            </Link>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => navigateToTab("home")}
              className="text-xs font-semibold text-slate-700 hover:text-brand-600 transition-colors truncate max-w-[200px]"
            >
              {doctor.clinic_name || doctor.full_name}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Practice</span>
            </div>
            {activeTab !== "home" ? (
              <button
                type="button"
                onClick={() => navigateToTab("home")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Practice Home</span>
              </button>
            ) : (
              services.appointment && (
                <button
                  type="button"
                  onClick={() => navigateToTab("appointments")}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <span>Book Visit</span>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Sticky Services Navigation Tab Bar */}
      <nav className="sticky top-16 z-20 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-2.5">
          <button
            type="button"
            onClick={() => navigateToTab("home")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === "home"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Practice Home</span>
          </button>

          {services.appointment && (
            <button
              type="button"
              onClick={() => navigateToTab("appointments")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "appointments"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>In-Clinic Appointments</span>
            </button>
          )}

          {services.video_consultation && (
            <button
              type="button"
              onClick={() => navigateToTab("teleconsult")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "teleconsult"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Consultation</span>
            </button>
          )}

          {services.medicine_inventory && (
            <button
              type="button"
              onClick={() => navigateToTab("medicines")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "medicines"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span>Medicine Orders</span>
            </button>
          )}

          {services.lab_reports && (
            <button
              type="button"
              onClick={() => navigateToTab("reports")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "reports"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lab Reports</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        {/* VIEW 1: HOME & OVERVIEW (Doctor Profile, Healthcare Philosophy, Services Showcase Cards) */}
        {activeTab === "home" && (
          <div className="space-y-12">
            {/* Hero Doctor Profile Banner */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Doctor Avatar */}
                  <div className="relative w-28 h-28 rounded-2xl border-2 border-brand-200 shadow-sm overflow-hidden shrink-0 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
                      alt={doctor.full_name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {doctor.full_name}
                      </h1>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verified Practice</span>
                      </span>
                    </div>

                    <p className="text-base font-semibold text-brand-600 flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4" />
                      <span>{doctor.speciality || "Healthcare Practitioner"}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 pt-1">
                      {doctor.clinic_name && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{doctor.clinic_name}</span>
                        </div>
                      )}
                      {doctor.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>{doctor.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Quick CTA */}
                <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
                  {services.appointment && (
                    <button
                      type="button"
                      onClick={() => navigateToTab("appointments")}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book In-Clinic Visit</span>
                    </button>
                  )}
                  {services.video_consultation && (
                    <button
                      type="button"
                      onClick={() => navigateToTab("teleconsult")}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-semibold border border-indigo-200 transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      <span>Video Consult</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* About Doctor & Healthcare Philosophy */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  Doctor Profile &amp; Care Philosophy
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  About {doctor.full_name}
                </h2>
              </div>

              {doctor.bio ? (
                <p className="text-sm text-slate-700 leading-relaxed max-w-4xl whitespace-pre-line">
                  {doctor.bio}
                </p>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  Welcome to {doctor.clinic_name || doctor.full_name}&apos;s digital healthcare portal. We are dedicated to delivering personalized, patient-centric care utilizing modern diagnostic methods and comprehensive consultation.
                </p>
              )}

              {/* Healthcare Commitment Pillars */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Verified Credentials</h3>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Licensed specialist adhering to high clinical standards and guidelines.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Patient-Centric Care</h3>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Tailored diagnostic treatments and empathetic preventive healthcare.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Prompt Scheduling</h3>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Convenient slot booking for in-person visits and remote video sessions.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Integrated Digital Care</h3>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Direct access to reports, prescription medicine orders, and medical charts.
                  </p>
                </div>
              </div>
            </section>

            {/* Practice Services Showcase Cards */}
            <section className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  Care Offerings
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Services Offered by {doctor.clinic_name || doctor.full_name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Select any service card below to open its dedicated page for appointments, consultations, or requests.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: In-Clinic Appointments */}
                {services.appointment && (
                  <div
                    onClick={() => navigateToTab("appointments")}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-md">
                          Clinic Visit
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                          In-Clinic Appointments
                        </h3>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          Schedule an in-person physical consultation at our clinic. Choose your convenient date and time slot with instant booking confirmation.
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        Detailed scheduler &amp; time slots
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
                        <span>Book Visit</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                )}

                {/* Card 2: Video Consultation */}
                {services.video_consultation && (
                  <div
                    onClick={() => navigateToTab("teleconsult")}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Video className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
                          Telehealth
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          Video Consultation (Telehealth)
                        </h3>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          Consult from home or work via high-definition, encrypted video calls. Receive professional medical advice, follow-ups, and care guidance.
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        HD video room &amp; instant link
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                        <span>Schedule Call</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                )}

                {/* Card 3: Medicine Inventory & Orders */}
                {services.medicine_inventory && (
                  <div
                    onClick={() => navigateToTab("medicines")}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Pill className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                          Pharmacy
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                          Clinic Pharmacy &amp; Medicine Delivery
                        </h3>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          Request prescribed medications and repeat refills directly from our verified clinic dispensary with home delivery.
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        Prescription order form
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                        <span>Order Medicines</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                )}

                {/* Card 4: Lab Reports */}
                {services.lab_reports && (
                  <div
                    onClick={() => navigateToTab("reports")}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-purple-400 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md">
                          Diagnostics
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                          Upload Lab &amp; Diagnostic Reports
                        </h3>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          Securely upload and share diagnostic tests, pathology, blood work, or radiology scans with your doctor prior to consultations.
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        PDF &amp; scan uploader
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-purple-600 group-hover:translate-x-1 transition-transform">
                        <span>Upload Documents</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
        {/* SERVICE 1: IN-CLINIC APPOINTMENT BOOKING */}
        {services.appointment && activeTab === "appointments" && (
          <div className="space-y-6">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => navigateToTab("home")}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition-colors group"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Practice Home</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => navigateToTab("home")}
                  className="hover:text-brand-600 transition-colors"
                >
                  Home
                </button>
                <span>/</span>
                <span className="font-semibold text-slate-800">In-Clinic Appointments</span>
              </div>
            </div>

            {/* Doctor Context Banner */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
                  alt={doctor.full_name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{doctor.full_name}</h3>
                  <p className="text-xs text-slate-500">
                    {doctor.speciality || "Healthcare Practitioner"} • {doctor.clinic_name || "Doctor's Clinic"}
                  </p>
                </div>
              </div>
              {doctor.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg self-start sm:self-auto">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{doctor.location}</span>
                </div>
              )}
            </div>

            <section id="appointments" className="scroll-mt-24">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-brand-700 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Book In-Clinic Appointment</h2>
                      <p className="text-xs text-blue-100">
                        Select your preferred date &amp; available time slot for clinic visit
                      </p>
                    </div>
                  </div>
                  <div className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-md self-start sm:self-auto font-medium">
                    {doctor.clinic_name || "Doctor's Clinic"}
                  </div>
                </div>

                {inClinicSuccess ? (
                  <div className="p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="text-xl font-bold text-slate-900">Appointment Confirmed!</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Your in-clinic booking reference is{" "}
                        <span className="font-mono font-bold text-slate-900">{inClinicSuccess}</span>. An appointment notification has been forwarded to {doctor.full_name}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setInClinicSuccess(null)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                      >
                        <span>Book Another Appointment</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab("home")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white rounded-lg transition-colors"
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Return to Practice Home</span>
                      </button>
                    </div>
                  </div>
              ) : (
                <form onSubmit={handleInClinicSubmit} className="p-6 sm:p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Preferred Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={inClinicDate}
                        onChange={(e) => setInClinicDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>

                    {/* Time Slot Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Available Time Slot <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setInClinicSlot(slot)}
                            className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                              inClinicSlot === slot
                                ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Patient Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={inClinicName}
                          onChange={(e) => setInClinicName(e.target.value)}
                          placeholder="Full name"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={inClinicPhone}
                          onChange={(e) => setInClinicPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={inClinicEmail}
                          onChange={(e) => setInClinicEmail(e.target.value)}
                          placeholder="patient@example.com"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Reason for Visit / Symptoms
                    </label>
                    <textarea
                      rows={2}
                      value={inClinicNotes}
                      onChange={(e) => setInClinicNotes(e.target.value)}
                      placeholder="Describe symptoms, routine check-up, follow-up, or general health concerns..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={inClinicSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      {inClinicSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Confirming...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirm Appointment</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

        {/* SERVICE 2: VIDEO CONSULTATION */}
        {services.video_consultation && activeTab === "teleconsult" && (
        <div className="space-y-6">
          {/* Top Navigation & Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigateToTab("home")}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Practice Home</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => navigateToTab("home")}
                className="hover:text-brand-600 transition-colors"
              >
                Home
              </button>
              <span>/</span>
              <span className="font-semibold text-slate-800">Video Consultation</span>
            </div>
          </div>

          {/* Telehealth Service Context Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
                alt={doctor.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{doctor.full_name}</h3>
                <p className="text-xs text-slate-500">
                  {doctor.speciality || "Healthcare Practitioner"} • Online Video Consultation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              <Video className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>HD Video Room • Encrypted Patient Call</span>
            </div>
          </div>

          <section id="teleconsult" className="scroll-mt-24">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Schedule Video Consultation</h2>
                    <p className="text-xs text-indigo-100">
                      Join a remote telehealth consultation from home via secure high-definition video
                    </p>
                  </div>
                </div>
                <div className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-md self-start sm:self-auto font-medium">
                  Telehealth Portal
                </div>
              </div>

              {videoSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-slate-900">Teleconsultation Scheduled!</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Your booking ID is{" "}
                      <span className="font-mono font-bold text-slate-900">{videoSuccess}</span>. A secure consultation link will be dispatched via email and SMS prior to your appointment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoSuccess(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                  >
                    <span>Schedule Another Video Call</span>
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setVideoSuccess(null)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                    >
                      <span>Schedule Another Video Call</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToTab("home")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white rounded-lg transition-colors"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Return to Practice Home</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVideoSubmit} className="p-6 sm:p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Consultation Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={videoDate}
                        onChange={(e) => setVideoDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Consultation Time Slot <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setVideoSlot(slot)}
                            className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                              videoSlot === slot
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Patient Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={videoName}
                        onChange={(e) => setVideoName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={videoPhone}
                        onChange={(e) => setVideoPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={videoEmail}
                        onChange={(e) => setVideoEmail(e.target.value)}
                        placeholder="patient@example.com"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Chief Complaint / Consultation Notes
                    </label>
                    <textarea
                      rows={2}
                      value={videoNotes}
                      onChange={(e) => setVideoNotes(e.target.value)}
                      placeholder="Briefly state symptoms, reason for consultation, or previous medical history..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={videoSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      {videoSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Booking Video Slot...</span>
                        </>
                      ) : (
                        <>
                          <span>Book Telehealth Video Call</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

        {/* SERVICE 3: MEDICINE INVENTORY & ORDERS */}
        {services.medicine_inventory && activeTab === "medicines" && (
        <div className="space-y-6">
          {/* Top Navigation & Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigateToTab("home")}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Practice Home</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => navigateToTab("home")}
                className="hover:text-brand-600 transition-colors"
              >
                Home
              </button>
              <span>/</span>
              <span className="font-semibold text-slate-800">Medicine Orders</span>
            </div>
          </div>

          {/* Pharmacy Service Context Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
                alt={doctor.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{doctor.clinic_name || doctor.full_name}&apos;s Dispensary</h3>
                <p className="text-xs text-slate-500">
                  Verified formulations dispensed under guidance of {doctor.full_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Clinic Verified Pharmacy</span>
            </div>
          </div>

          <section id="medicines" className="scroll-mt-24">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Clinic Pharmacy &amp; Medicine Delivery</h2>
                    <p className="text-xs text-emerald-100">
                      Request prescribed medicines and repeat refills directly from the clinic pharmacy
                    </p>
                  </div>
                </div>
                <div className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-md self-start sm:self-auto font-medium">
                  Pharmacy Service
                </div>
              </div>

              {medSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-slate-900">Medicine Order Submitted!</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Your order ticket is{" "}
                      <span className="font-mono font-bold text-slate-900">{medSuccess}</span>. The pharmacy team will verify your prescription details and contact you for dispatch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMedSuccess(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                  >
                    <span>Submit Another Medicine Request</span>
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMedSuccess(null)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                    >
                      <span>Submit Another Medicine Request</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToTab("home")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white rounded-lg transition-colors"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Return to Practice Home</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleMedicineSubmit} className="p-6 sm:p-8 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={medPatientName}
                        onChange={(e) => setMedPatientName(e.target.value)}
                        placeholder="Patient name"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={medPhone}
                        onChange={(e) => setMedPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Delivery Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={medAddress}
                      onChange={(e) => setMedAddress(e.target.value)}
                      placeholder="Home address, apartment/unit, city, zip code"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Prescribed Medicines &amp; Quantity <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={medList}
                      onChange={(e) => setMedList(e.target.value)}
                      placeholder="List medicine names, dosages, and quantities (e.g. Amoxicillin 500mg - 10 tabs, Paracetamol 650mg - 1 strip)..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={medSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      {medSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Medicine Order</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

        {/* SERVICE 4: LAB REPORTS UPLOAD */}
        {services.lab_reports && activeTab === "reports" && (
        <div className="space-y-6">
          {/* Top Navigation & Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigateToTab("home")}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Practice Home</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => navigateToTab("home")}
                className="hover:text-brand-600 transition-colors"
              >
                Home
              </button>
              <span>/</span>
              <span className="font-semibold text-slate-800">Lab Reports</span>
            </div>
          </div>

          {/* Diagnostic Service Context Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doctor.avatar_url || DEFAULT_DOCTOR_AVATAR}
                alt={doctor.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{doctor.full_name}</h3>
                <p className="text-xs text-slate-500">
                  Direct Diagnostic Report Submission &amp; Clinical Review
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-200/80 px-3 py-1.5 rounded-lg self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Confidential &amp; Encrypted Upload</span>
            </div>
          </div>

          <section id="reports" className="scroll-mt-24">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Upload Lab &amp; Diagnostic Reports</h2>
                    <p className="text-xs text-purple-100">
                      Share test results, blood work, or radiology reports securely before your consultation
                    </p>
                  </div>
                </div>
                <div className="text-xs bg-white/20 px-3 py-1 rounded-full backdrop-blur-md self-start sm:self-auto font-medium">
                  Diagnostic Portal
                </div>
              </div>

              {repSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-slate-900">Lab Report Received!</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Reference tracking ID is{" "}
                      <span className="font-mono font-bold text-slate-900">{repSuccess}</span>. Your uploaded diagnostic document has been attached to your clinical chart for {doctor.full_name}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRepSuccess(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                  >
                    <span>Upload Another Report</span>
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setRepSuccess(null)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors"
                    >
                      <span>Upload Another Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToTab("home")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white rounded-lg transition-colors"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Return to Practice Home</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="p-6 sm:p-8 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={repPatientName}
                        onChange={(e) => setRepPatientName(e.target.value)}
                        placeholder="Patient name"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={repPhone}
                        onChange={(e) => setRepPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Report Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={repType}
                        onChange={(e) => setRepType(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="Blood Work & Pathology">Blood Work &amp; Pathology</option>
                        <option value="Radiology / X-Ray / CT / MRI">Radiology / X-Ray / CT / MRI</option>
                        <option value="Urine & Biochemistry">Urine &amp; Biochemistry</option>
                        <option value="Cardiology ECG / Echo">Cardiology ECG / Echo</option>
                        <option value="Other Medical Record">Other Medical Record</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Select Diagnostic File (PDF or Image) <span className="text-red-500">*</span>
                      </label>
                      <div className="border border-dashed border-purple-200 bg-purple-50/40 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <UploadCloud className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="text-xs text-slate-600 truncate">
                            {repFileName || "No file selected"}
                          </span>
                        </div>
                        <label className="cursor-pointer text-xs font-semibold text-purple-700 hover:text-purple-800 bg-white border border-purple-200 px-2.5 py-1 rounded shadow-xs shrink-0">
                          Browse
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setRepFileName(file.name);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Notes / Relevant Clinical Symptoms
                    </label>
                    <textarea
                      rows={2}
                      value={repNotes}
                      onChange={(e) => setRepNotes(e.target.value)}
                      placeholder="Mention lab name, test date, or specific questions for the doctor..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={repSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      {repSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Diagnostic Report</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
      </main>

      {/* Patient Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p className="font-medium text-slate-700">
            {doctor.clinic_name || doctor.full_name} • Powered by DocSpace
          </p>
          <p className="text-slate-400">
            For medical emergencies, please dial your local emergency services (e.g. 911 / 112) immediately.
          </p>
        </div>
      </footer>
    </div>
  );
}
