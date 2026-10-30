"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  User,
  Smartphone,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
} from "lucide-react";
import { DoctorMeResponse, DoctorProfileResponse, DEFAULT_DOCTOR_AVATAR } from "@/lib/api";
import BrandLogo from "@/components/brand/BrandLogo";

export type DashboardTabId =
  | "overview"
  | "appointment"
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
  onOpenDiagnostics,
  enableAndroidBuild,
  children,
}: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const navItems: { id: DashboardTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "appointment", label: "Appointments", icon: Calendar },
    { id: "profile", label: "Profile", icon: User },
  ];

  if (enableAndroidBuild) {
    navItems.push({ id: "android", label: "Android App", icon: Smartphone });
  }

  const avatar = profile?.avatar_url || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR;

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  // Trap body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleTabSelect = (tab: DashboardTabId) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-brand-100 selection:text-brand-900">
      {/* =========================================================================
          MOBILE TOP BAR (< md)
          Sticky, clean, native-feeling header with Hamburger Menu, Brand, and Avatar
          ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 h-14 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-1 text-slate-700 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo size="sm" />
        </div>

        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt={doctor.full_name || "Doctor"}
            className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
          />
          <button
            type="button"
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          MOBILE HAMBURGER SLIDE-OUT DRAWER (< md)
          Accessible, smooth slide-out drawer with backdrop
          ========================================================================= */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250 ease-out">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <BrandLogo size="sm" />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Doctor Info Card */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={doctor.full_name || "Doctor"}
                className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {doctor.full_name || "Doctor"}
                </p>
                <p className="text-xs text-slate-500 truncate">{doctor.email}</p>
              </div>
            </div>

            {/* Drawer Navigation Links */}
            <nav className="p-3 flex-1 overflow-y-auto space-y-1 custom-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabSelect(item.id)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-left w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      isActive
                        ? "bg-brand-50 text-brand-700 font-bold border-l-4 border-brand-600 shadow-2xs"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {onOpenDiagnostics && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenDiagnostics();
                  }}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all text-left w-full"
                >
                  <Activity className="w-5 h-5 shrink-0 text-slate-400" />
                  <span>Diagnostics</span>
                </button>
              )}
            </nav>

            {/* Drawer Footer Logout */}
            <div className="p-4 border-t border-slate-100 pb-safe">
              <button
                type="button"
                onClick={onLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE (Responsive Container)
          ========================================================================= */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full flex-1 flex flex-col md:flex-row gap-6">
        {/* =========================================================================
            DESKTOP / TABLET SIDEBAR (>= md)
            Persistent, collapsible (compact icon-rail or full width) navigation panel
            ========================================================================= */}
        <aside
          className={`hidden md:flex shrink-0 flex-col gap-4 transition-all duration-200 ease-in-out ${
            isSidebarCollapsed ? "w-20" : "w-64"
          }`}
        >
          {/* Brand Logo & Collapse Toggle Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs px-3.5 py-3 flex items-center justify-between">
            {!isSidebarCollapsed && <BrandLogo size="sm" />}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className={`p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isSidebarCollapsed ? "mx-auto" : ""
              }`}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Desktop Nav Items */}
          <nav
            aria-label="Main Navigation"
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-2 flex flex-col gap-1.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  title={item.label}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all text-left w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSidebarCollapsed
                      ? "justify-center p-3"
                      : "gap-3 px-3.5 py-2.5"
                  } ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-semibold shadow-2xs border-l-4 border-brand-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout Box in Desktop Sidebar */}
          <div className="mt-auto bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 flex flex-col gap-3">
            <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? "justify-center" : "space-x-3"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={doctor.full_name || "Doctor"}
                className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
              />
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {doctor.full_name || "Doctor"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{doctor.email}</p>
                </div>
              )}
            </div>

            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={onLogout}
                className={`inline-flex items-center justify-center rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isSidebarCollapsed ? "w-full p-2" : "w-full gap-1.5 px-3 py-2"
                }`}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                {!isSidebarCollapsed && <span>Logout</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* =========================================================================
            DYNAMIC CONTENT VIEWPORT
            Padding added at bottom on mobile (pb-24) to avoid bottom-nav overlap
            ========================================================================= */}
        <main className="flex-1 min-w-0 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR (< md)
          Fixed to bottom with safe-area padding for notch/home indicators
          ========================================================================= */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-lg"
      >
        <div className="flex items-center justify-around h-15 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  isActive
                    ? "text-brand-600 font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-brand-600 rounded-full" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? "scale-110 text-brand-600" : "text-slate-400"
                  }`}
                />
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


