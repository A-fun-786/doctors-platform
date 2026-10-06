"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import {
  getCurrentDoctor,
  getDoctorProfile,
  removeAuthToken,
  DoctorMeResponse,
  DoctorProfileResponse,
} from "@/lib/api";
import DashboardShell, { DashboardTabId } from "@/components/dashboard/DashboardShell";
import OverviewTab from "@/components/dashboard/OverviewTab";
import CalendarTab from "@/components/dashboard/CalendarTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import AppointmentsTab from "@/components/dashboard/AppointmentsTab";
import ProfileTab from "@/components/dashboard/ProfileTab";
import AndroidAppTab from "@/components/dashboard/AndroidAppTab";

const ENABLE_ANDROID_BUILD = process.env.NEXT_PUBLIC_ENABLE_ANDROID_BUILD === "true";

export default function DashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<DoctorMeResponse | null>(null);
  const [profile, setProfile] = useState<DoctorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");

  useEffect(() => {
    async function loadDoctor() {
      try {
        const [meData, profileData] = await Promise.all([
          getCurrentDoctor(),
          getDoctorProfile().catch(() => null),
        ]);
        setDoctor(meData);
        if (profileData) {
          setProfile(profileData);
        }
      } catch {
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
            <span>Verifying session and loading doctor portal...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return null;
  }

  return (
    <DashboardShell
      doctor={doctor}
      profile={profile}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      enableAndroidBuild={ENABLE_ANDROID_BUILD}
    >
      <div className="space-y-6">
        {/* Incomplete Onboarding Alert Banner */}
        {!doctor.onboarding_completed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        {/* Tab Views (instant swapping without full reload - Test 6.1) */}
        {activeTab === "overview" && (
          <OverviewTab doctor={doctor} profile={profile} onNavigateTab={setActiveTab} />
        )}

        {activeTab === "calendar" && (
          <CalendarTab doctor={doctor} onNavigateTab={setActiveTab} />
        )}

        {activeTab === "schedule" && <ScheduleTab doctor={doctor} />}

        {activeTab === "appointments" && <AppointmentsTab doctor={doctor} />}

        {activeTab === "profile" && (
          <ProfileTab
            doctor={doctor}
            initialProfile={profile}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              setDoctor((prev) =>
                prev
                  ? {
                      ...prev,
                      full_name: updated.full_name,
                      phone: updated.phone,
                      avatar_url: updated.avatar_url,
                    }
                  : prev
              );
            }}
          />
        )}

        {activeTab === "android" && ENABLE_ANDROID_BUILD && (
          <AndroidAppTab doctor={doctor} profile={profile} />
        )}
      </div>
    </DashboardShell>
  );
}
