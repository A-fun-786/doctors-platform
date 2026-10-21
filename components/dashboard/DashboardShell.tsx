"use client";

import React from "react";
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
  onOpenDiagnostics?: () => void;
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

  const avatar = profile?.avatar_url || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar / Tab Bar */}
        <aside className="w-full md:w-60 shrink-0 flex flex-col gap-3">
          {/* Brand Logo */}
          <div className="flex items-center justify-between px-2 py-1">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Activity className="w-4.5 h-4.5" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">DocSpace</span>
            </Link>
          </div>

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

          {/* User Profile & Logout section in sidebar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between md:flex-col md:items-stretch gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={doctor.full_name || "Doctor"}
                className="w-9 h-9 rounded-full border border-slate-200 object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {doctor.full_name || "Doctor"}
                </p>
                <p className="text-xs text-slate-500 truncate">{doctor.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors shrink-0 md:w-full"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 min-w-0">
          {children}
        </section>
      </div>
    </div>
  );
}
