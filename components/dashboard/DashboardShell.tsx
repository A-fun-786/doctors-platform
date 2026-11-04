"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ChevronDown,
  ChevronRight,
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

interface ProfileDropdownMenuProps {
  avatar: string;
  formattedDoctorName: string;
  email: string;
  speciality: string;
  onNavigateProfile: () => void;
  onLogout: () => void;
  className?: string;
}

function ProfileDropdownMenu({
  avatar,
  formattedDoctorName,
  email,
  speciality,
  onNavigateProfile,
  onLogout,
  className = "w-[268px] mt-2.5",
}: ProfileDropdownMenuProps) {
  return (
    <div
      className={`absolute right-0 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right space-y-1.5 ${className}`}
    >
      {/* 1. Read-Only Account Identity Info */}
      <div className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-100 select-text cursor-default">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt={formattedDoctorName}
              className="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-2xs"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate">
              {formattedDoctorName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{email}</div>
            <div className="text-[10px] text-brand-700 font-semibold truncate mt-0.5">
              {speciality}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Clickable Actions */}
      <div className="space-y-1">
        {/* Admin Profile Action Button */}
        <button
          type="button"
          onClick={onNavigateProfile}
          className="w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 group cursor-pointer hover:bg-brand-50/80 border border-slate-100 hover:border-brand-200/80 shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors shadow-2xs">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors">
                Admin Profile
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Account &amp; clinic settings
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5" />
        </button>

        <div className="border-t border-slate-100 my-1" />

        {/* Sign Out Action Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 group cursor-pointer hover:bg-rose-50 border border-slate-100 hover:border-rose-200/80 shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-2xs">
              <LogOut className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-rose-700 group-hover:text-rose-800 transition-colors">
                Sign Out
              </div>
              <div className="text-[10px] text-rose-500/80 truncate">
                End your session
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-300 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5" />
        </button>
      </div>
    </div>
  );
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reveal scrollbar on scroll, auto-hide when idle
  const handleMainScroll = () => {
    if (mainRef.current && !mainRef.current.classList.contains("is-scrolling")) {
      mainRef.current.classList.add("is-scrolling");
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.classList.remove("is-scrolling");
      }
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Close profile dropdown on click outside or Escape key
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        mobileProfileMenuRef.current &&
        !mobileProfileMenuRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  // Desktop sidebar navigation: Android App is excluded
  const desktopNavItems: {
    id: DashboardTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "appointment", label: "Appointments", icon: Calendar },
  ];

  // Mobile navigation: Preserves Android App if enabled
  const navItems: {
    id: DashboardTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [...desktopNavItems];

  if (enableAndroidBuild) {
    navItems.push({ id: "android", label: "Android App", icon: Smartphone });
  }

  const avatar = profile?.avatar_url || doctor.avatar_url || DEFAULT_DOCTOR_AVATAR;
  const doctorDisplayName = doctor.full_name?.trim() || "Doctor";
  const formattedDoctorName = doctorDisplayName.toLowerCase().startsWith("dr.")
    ? doctorDisplayName
    : `Dr. ${doctorDisplayName}`;

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
    <div className="h-screen w-full bg-slate-50 flex flex-col text-slate-900 selection:bg-brand-100 selection:text-brand-900 overflow-hidden overscroll-none">
      {/* =========================================================================
          MOBILE TOP BAR (< md)
          Fixed full-width header with backdrop blur
          ========================================================================= */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Hamburger Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 -ml-1.5 text-slate-700 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <BrandLogo size="sm" />
          </div>

          {/* Mobile Profile Avatar Trigger & Dropdown */}
          <div className="relative" ref={mobileProfileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 p-1 pr-2 rounded-full transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-2xs cursor-pointer ${
                isProfileMenuOpen
                  ? "bg-white border-2 border-brand-500 ring-2 ring-brand-500/20"
                  : "bg-white/95 hover:bg-white border border-slate-300 hover:border-slate-400"
              }`}
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="true"
              aria-label="Doctor profile and session menu"
            >
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt={formattedDoctorName}
                  className="w-8 h-8 rounded-full border-2 border-white ring-2 ring-slate-300 object-cover shadow-xs"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1.5 ring-white" />
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isProfileMenuOpen ? "rotate-180 text-brand-600" : ""
                }`}
              />
            </button>

            {/* Mobile Dropdown Popover */}
            {isProfileMenuOpen && (
              <ProfileDropdownMenu
                avatar={avatar}
                formattedDoctorName={formattedDoctorName}
                email={doctor.email}
                speciality={profile?.speciality || "General Practice"}
                onNavigateProfile={() => {
                  setIsProfileMenuOpen(false);
                  onTabChange("profile");
                }}
                onLogout={() => {
                  setIsProfileMenuOpen(false);
                  onLogout();
                }}
                className="mt-2 w-[264px]"
              />
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          DESKTOP TOP BAR (>= md)
          Fixed full-width header with backdrop blur
          ========================================================================= */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
          </div>

          {/* Profile Avatar Pill & Dropdown Popover */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className={`flex items-center gap-3 p-1.5 pr-3.5 rounded-full transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xs group cursor-pointer ${
                isProfileMenuOpen
                  ? "bg-white border-2 border-brand-500 ring-2 ring-brand-500/20"
                  : "bg-white/95 hover:bg-white border border-slate-300 hover:border-slate-400"
              }`}
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="true"
              aria-label="Doctor profile and session menu"
            >
              {/* Doctor Avatar with Active Status Dot */}
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt={formattedDoctorName}
                  className="w-8 h-8 rounded-full border-2 border-white ring-2 ring-slate-300 group-hover:ring-brand-500 object-cover shadow-xs transition-all"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              {/* Doctor Name & Speciality Text */}
              <div className="text-left hidden sm:block min-w-0">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[150px] lg:max-w-[200px]">
                  {formattedDoctorName}
                </p>
                <p className="text-[10px] text-slate-500 font-medium leading-tight truncate max-w-[150px] lg:max-w-[200px]">
                  {profile?.speciality || "Healthcare Practice"}
                </p>
              </div>

              {/* Caret Chevron */}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                  isProfileMenuOpen ? "rotate-180 text-brand-600" : ""
                }`}
              />
            </button>

            {/* Profile Dropdown Popover Menu */}
            {isProfileMenuOpen && (
              <ProfileDropdownMenu
                avatar={avatar}
                formattedDoctorName={formattedDoctorName}
                email={doctor.email}
                speciality={profile?.speciality || "Healthcare Practice"}
                onNavigateProfile={() => {
                  setIsProfileMenuOpen(false);
                  onTabChange("profile");
                }}
                onLogout={() => {
                  setIsProfileMenuOpen(false);
                  onLogout();
                }}
                className="mt-2.5 w-[268px]"
              />
            )}
          </div>
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* =========================================================================
            DESKTOP / TABLET SIDEBAR (>= md)
            Persistent, collapsible (compact icon-rail or full width) navigation panel
            ========================================================================= */}
        <aside
          className={`hidden md:flex shrink-0 flex-col gap-3 self-start pt-20 pb-6 transition-all duration-200 ease-in-out ${
            isSidebarCollapsed ? "w-20" : "w-60"
          }`}
        >
          {/* Collapse Toggle Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs px-3.5 py-2.5 flex items-center justify-between shrink-0">
            {!isSidebarCollapsed && (
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Menu
              </span>
            )}
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
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  title={item.label}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all text-left w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0 ${
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
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* =========================================================================
            DYNAMIC CONTENT VIEWPORT
            Independent scroll container with overscroll containment
            ========================================================================= */}
        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain auto-hide-scrollbar pt-18 md:pt-20 pr-1 pb-24 md:pb-8"
        >
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


