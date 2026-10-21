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
import ProfileTab from "@/components/dashboard/ProfileTab";
import AndroidAppTab from "@/components/dashboard/AndroidAppTab";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import DiagnosticsModal from "@/components/ui/DiagnosticsModal";
import { logger } from "@/lib/logger";

const ENABLE_ANDROID_BUILD = process.env.NEXT_PUBLIC_ENABLE_ANDROID_BUILD === "true";

export default function DashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<DoctorMeResponse | null>(null);
  const [profile, setProfile] = useState<DoctorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  // Global shortcut to toggle diagnostics modal (Ctrl+Shift+D or Cmd+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setIsDiagnosticsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

        // Attach doctor & tenant identity to production logger
        logger.setUserContext({
          userId: meData.id,
          email: meData.email,
          tenantSlug: meData.tenant?.slug || undefined,
          role: "doctor",
        });

        logger.info("Dashboard", "Doctor portal initialized successfully", {
          doctorId: meData.id,
          email: meData.email,
          tenantSlug: meData.tenant?.slug,
          onboardingCompleted: meData.onboarding_completed,
        });
      } catch (err: unknown) {
        logger.warn("Dashboard", "Failed to verify session, redirecting to login", {
          error: err instanceof Error ? err.message : String(err),
        });
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadDoctor();
  }, [router]);

  const handleTabChange = (newTab: DashboardTabId) => {
    if (newTab !== activeTab) {
      logger.action("Dashboard", `Tab changed to "${newTab}"`, {
        from: activeTab,
        to: newTab,
      });
      setActiveTab(newTab);
    }
  };

  const handleLogout = () => {
    logger.action("Dashboard", "Doctor initiated logout", {
      doctorId: doctor?.id,
      email: doctor?.email,
    });
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
    <>
      <DashboardShell
        doctor={doctor}
        profile={profile}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
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
                onClick={() =>
                  logger.action("Dashboard", "Doctor clicked 'Complete Setup' banner button")
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
              >
                <span>Complete Setup</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Tab Views wrapped in modular ErrorBoundary */}
          <ErrorBoundary
            key={activeTab}
            moduleName={`Tab:${activeTab}`}
            fallbackTitle={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Error`}
            fallbackMessage="An unexpected error occurred in this section. You can try refreshing the tab or view diagnostic logs."
          >
            {activeTab === "overview" && (
              <OverviewTab doctor={doctor} profile={profile} onNavigateTab={handleTabChange} />
            )}

            {activeTab === "calendar" && (
              <CalendarTab doctor={doctor} onNavigateTab={handleTabChange} />
            )}

            {activeTab === "profile" && (
              <ProfileTab
                doctor={doctor}
                initialProfile={profile}
                onProfileUpdated={(updated) => {
                  logger.action("Dashboard", "Doctor profile updated in UI state", {
                    fullName: updated.full_name,
                  });
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
          </ErrorBoundary>
        </div>
      </DashboardShell>

      {/* Diagnostics and Telemetry Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </>
  );
}
