"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  LayoutDashboard,
  Calendar,
  Clock,
  ClipboardList,
  User,
  Smartphone,
  LogOut,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { DoctorMeResponse, DoctorProfileResponse, DEFAULT_DOCTOR_AVATAR } from "@/lib/api";

export type DashboardTabId =
  | "overview"
  | "calendar"
  | "schedule"
  | "appointments"
  | "profile"
  | "android";

interface DashboardShellProps {
  doctor: DoctorMeResponse;
  profile: DoctorProfileResponse | null;
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  onLogout: () => void;
  enableAndroidBuild: boolean;
  children: React.ReactNode;
}

export default function DashboardShell({
  doctor,
  profile,
  activeTab,
  onTabChange,
  onLogout,
  enableAndroidBuild,
  children,
}: DashboardShellProps) {
  const [copied, setCopied] = useState(false);

  const navItems: { id: DashboardTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "schedule", label: "Schedule", icon: Clock },
    { id: "appointments", label: "Appointments", icon: ClipboardList },
    { id: "profile", label: "Profile", icon: User },
  ];

  if (enableAndroidBuild) {
    navItems.push({ id: "android", label: "Android App", icon: Smartphone });
  }

  const handleCopyLink = () => {
    if (!doctor.tenant?.slug) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/${doctor.tenant.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const avatar = profile?.avatar_url || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Header */}
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

          <div className="flex items-center space-x-3 sm:space-x-4">
            {doctor.tenant?.slug && (
              <div className="hidden md:flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
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
                <Link
                  href={`/${doctor.tenant.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
                >
                  <span>Public Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <div className="flex items-center space-x-3 pl-2 sm:border-l sm:border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={doctor.full_name || "Doctor"}
                className="w-9 h-9 rounded-full border border-slate-200 object-cover"
              />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-900 leading-none">
                  {doctor.full_name || "Doctor"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-none">{doctor.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar / Tab Bar */}
        <aside className="w-full md:w-60 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap text-left w-full ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-semibold shadow-xs border-l-0 md:border-l-4 md:border-brand-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <section className="flex-1 min-w-0">
          {children}
        </section>
      </div>
    </div>
  );
}
