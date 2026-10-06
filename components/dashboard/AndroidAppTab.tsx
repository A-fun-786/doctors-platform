"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  CheckCircle2,
  Activity,
  Upload,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
import {
  DoctorMeResponse,
  DoctorProfileResponse,
  AppPreviewResponse,
  AppBuildStatusResponse,
  getAppPreview,
  uploadAppIcon,
  triggerAppBuild,
  getAppBuildStatus,
  getAppBuildLogs,
  getAppDownloadUrl,
} from "@/lib/api";

interface AndroidAppTabProps {
  doctor: DoctorMeResponse;
  profile: DoctorProfileResponse | null;
}

export default function AndroidAppTab({ doctor, profile }: AndroidAppTabProps) {
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
    getAppPreview()
      .then((previewData) => {
        setAppPreview(previewData);
        if (previewData.latest_apk) {
          setBuildStatus(previewData.latest_apk);
          setBuildTaskId(previewData.latest_apk.task_id);
        }
      })
      .catch(() => {});
  }, []);

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
          getAppBuildLogs(buildTaskId).then((l) => setBuildLogs(l.logs)).catch(() => {});
        }
        if (res.status === "completed") {
          setBuildingApp(false);
          getAppBuildLogs(buildTaskId).then((l) => setBuildLogs(l.logs)).catch(() => {});
        } else if (res.status === "failed") {
          setBuildingApp(false);
          setBuildError(res.error || "Compilation failed. Check build logs.");
          getAppBuildLogs(buildTaskId).then((l) => setBuildLogs(l.logs)).catch(() => {});
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

  const clinicName = profile?.clinic_name || "";
  const fullName = profile?.full_name || doctor.full_name || "";

  return (
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
                  {appPreview?.package_name ||
                    `com.docspace.${(fullName || "doctor").toLowerCase().replace(/[^a-z0-9]/g, "")}.${(clinicName || "clinic").toLowerCase().replace(/[^a-z0-9]/g, "")}`}
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
                      {buildStatus.apk_filename}{" "}
                      {buildStatus.file_size
                        ? `(${(buildStatus.file_size / (1024 * 1024)).toFixed(1)} MB)`
                        : ""}
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
                      getAppBuildLogs(buildTaskId)
                        .then((l) => setBuildLogs(l.logs))
                        .catch(() => {});
                    }
                  }}
                  className="text-xs font-semibold text-slate-700 hover:text-brand-600 flex items-center gap-1.5 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>
                    {showLogs ? "Hide Live Build Console" : "View Live Build Console & Compiler Output"}
                  </span>
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
  );
}
