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
  Layers,
} from "lucide-react";
import { getCurrentDoctor, removeAuthToken, DoctorMeResponse } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<DoctorMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoctor() {
      try {
        const data = await getCurrentDoctor();
        setDoctor(data);
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
              {doctor.avatar_url ? (
                <Image
                  src={doctor.avatar_url}
                  alt={doctor.full_name}
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm">
                  {doctor.full_name.charAt(0)}
                </div>
              )}
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
              Your practice workspace and dedicated tenant isolation are initialized and ready.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
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

        {/* Phase Roadmap Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                Phase 3 Vertical Slice Complete
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Doctor registration, Google authentication, unique tenant workspace provisioning, JWT security, and protected dashboard routing are fully operational. Full practice management metrics, patient appointments, and website configuration will be connected in future phases.
              </p>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <span>Return to Public Landing Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
