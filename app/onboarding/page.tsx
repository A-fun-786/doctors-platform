"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GoSmartClinic — Clinic Setup Wizard (Onboarding)
 *
 * Architecture:
 *   app/onboarding/
 *   ├── page.tsx                          ← orchestrator (this file)
 *   ├── constants/
 *   │   ├── steps.ts                      ← WIZARD_STEPS config
 *   │   └── dialCodes.ts                  ← COUNTRY_DIAL_CODES + helpers
 *   └── components/
 *       ├── OnboardingLayout.tsx          ← Header, Sidebar, MobileStepBadge
 *       ├── OnboardingStepContent.tsx     ← Step1–Step4 pure form components
 *       └── OnboardingPhoneInput.tsx      ← Country dial + number picker
 *
 * Standards:
 *   • WCAG 2.1 AA — aria-*, role=*, focus management
 *   • Logger integration — all actions, API calls, errors tracked (no PII)
 *   • Field-level validation — inline errors per field, not just toast
 *   • Loading states — skeleton-free: spinner + disabled buttons
 *   • TypeScript strict — no `any`, narrow error types
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Share2,
} from "lucide-react";

import {
  getDoctorProfile,
  updateDoctorProfile,
  uploadDoctorAvatar,
  DEFAULT_DOCTOR_AVATAR,
  DoctorProfileResponse,
} from "@/lib/api";
import { logger } from "@/lib/logger";

import { WIZARD_STEPS, TOTAL_STEPS } from "./constants/steps";
import {
  COUNTRY_DIAL_CODES,
  detectDefaultCountry,
  parseStoredPhone,
  CountryDialCode,
} from "./constants/dialCodes";
import {
  OnboardingHeader,
  OnboardingSidebar,
  MobileStepBadge,
} from "./components/OnboardingLayout";
import {
  Step1ClinicName,
  Step2ClinicLogo,
  Step3ContactPhone,
  Step4ClinicLocation,
} from "./components/OnboardingStepContent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FieldErrors = Partial<Record<"clinicName" | "phone" | "address" | "logo", string>>;

// ─────────────────────────────────────────────────────────────────────────────
// Logger module tag
// ─────────────────────────────────────────────────────────────────────────────
const MOD = "Onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UI states ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Global + field errors ───────────────────────────────────────────────
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // ── Data ────────────────────────────────────────────────────────────────
  const [profileData, setProfileData] = useState<DoctorProfileResponse | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicLogoUrl, setClinicLogoUrl] = useState<string>("");
  const [country, setCountry] = useState<CountryDialCode>(COUNTRY_DIAL_CODES[0]);
  const [localNumber, setLocalNumber] = useState("");
  const [address, setAddress] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [localOrigin, setLocalOrigin] = useState("");

  // Combined international phone string
  const combinedPhone = `${country?.dial || "+92"} ${localNumber.trim()}`.trim();

  // ─────────────────────────────────────────────────────────────────────────
  // Load profile on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLocalOrigin(window.location.origin);
    }

    async function loadProfile() {
      logger.info(MOD, "Loading doctor profile for onboarding");
      const t0 = performance.now();
      try {
        const profile = await getDoctorProfile();
        const elapsed = Math.round(performance.now() - t0);

        logger.api(MOD, "Profile loaded", {
          tenantSlug: profile.tenant_slug,
          onboardingCompleted: profile.onboarding_completed,
          hasClinicName: !!profile.clinic_name,
          elapsedMs: elapsed,
        });

        setProfileData(profile);
        setClinicName(profile.clinic_name || "");
        setAddress(profile.location || "");
        setTenantSlug(profile.tenant_slug || "");

        // Parse stored international phone into country + local
        if (profile.phone) {
          const { country: parsedCountry, localNumber: parsedLocal } =
            parseStoredPhone(profile.phone);
          setCountry(parsedCountry);
          setLocalNumber(parsedLocal);
          logger.debug(MOD, "Parsed stored phone", {
            countryCode: parsedCountry?.code,
            dialCode: parsedCountry?.dial,
          });
        } else {
          // Detect client country from browser locale only on client mount
          setCountry(detectDefaultCountry());
        }

        // Resolve logo
        if (profile.avatar_url && profile.avatar_url !== DEFAULT_DOCTOR_AVATAR) {
          setClinicLogoUrl(profile.avatar_url);
        } else if (profile.app_icon_url) {
          setClinicLogoUrl(profile.app_icon_url);
        }

        // Set logger user context (non-PII fields only)
        logger.setUserContext({
          tenantSlug: profile.tenant_slug || undefined,
          role: "doctor",
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load profile.";
        logger.error(MOD, "Failed to load doctor profile", err instanceof Error ? err : new Error(String(err)));
        setGlobalError(msg);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Logo Upload
  // ─────────────────────────────────────────────────────────────────────────
  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Client-side validation
      if (!file.type.startsWith("image/")) {
        const msg = "Please select a valid image file (PNG, JPG, or WebP).";
        setFieldErrors((prev) => ({ ...prev, logo: msg }));
        logger.warn(MOD, "Logo upload rejected — invalid MIME type", { mimeType: file.type });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        const msg = "Logo file size must be less than 2 MB.";
        setFieldErrors((prev) => ({ ...prev, logo: msg }));
        logger.warn(MOD, "Logo upload rejected — file too large", { sizeBytes: file.size });
        return;
      }

      setFieldErrors((prev) => ({ ...prev, logo: undefined }));
      setGlobalError(null);

      logger.action(MOD, "User uploading clinic logo", {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const t0 = performance.now();
      try {
        setUploadingLogo(true);
        const res = await uploadDoctorAvatar(file);
        const elapsed = Math.round(performance.now() - t0);
        setClinicLogoUrl(res.avatar_url);
        logger.api(MOD, "Logo upload succeeded", { elapsedMs: elapsed });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to upload logo.";
        setFieldErrors((prev) => ({ ...prev, logo: msg }));
        logger.error(MOD, "Logo upload API failed", err instanceof Error ? err : new Error(String(err)));
      } finally {
        setUploadingLogo(false);
      }
    },
    []
  );

  const handleResetLogo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setClinicLogoUrl("");
    setFieldErrors((prev) => ({ ...prev, logo: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    logger.action(MOD, "User removed clinic logo");
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Field validation — returns field-level error or null
  // ─────────────────────────────────────────────────────────────────────────
  function validateStep(stepId: number): FieldErrors {
    const errors: FieldErrors = {};
    switch (stepId) {
      case 1:
        if (!clinicName.trim())
          errors.clinicName = "Please enter your clinic name.";
        else if (clinicName.trim().length < 3)
          errors.clinicName = "Clinic name must be at least 3 characters.";
        break;
      case 2:
        // Logo is optional — no errors
        break;
      case 3:
        if (!localNumber.trim())
          errors.phone = "Please enter a contact number.";
        else if (!/^\d[\d\s\-()]{5,}$/.test(localNumber.trim()))
          errors.phone = "Enter a valid local phone number (digits only).";
        break;
      case 4:
        if (!address.trim())
          errors.address = "Please enter the clinic address.";
        else if (address.trim().length < 10)
          errors.address = "Please provide a more complete address.";
        break;
    }
    return errors;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    setGlobalError(null);
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      logger.debug(MOD, "Step validation failed", { step, errors });
      return;
    }
    setFieldErrors({});
    logger.action(MOD, `Step ${step} completed`, { step });

    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
    } else {
      handleFinalizeSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, clinicName, localNumber, address]);

  const handleBack = useCallback(() => {
    setGlobalError(null);
    setFieldErrors({});
    if (step > 1) {
      logger.action(MOD, "User navigated back", { from: step });
      setStep((prev) => prev - 1);
    }
  }, [step]);

  // ─────────────────────────────────────────────────────────────────────────
  // Enter key — advances step (except textarea on step 4)
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Support Ctrl+Enter / Cmd+Enter on any step (including step 4 textarea)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && step !== 4) {
        e.preventDefault();
        handleNext();
      }
    },
    [step, handleNext]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Finalize — save to API
  // ─────────────────────────────────────────────────────────────────────────
  const handleFinalizeSetup = async () => {
    // Final full-form validation sweep
    const allErrors: FieldErrors = {
      ...validateStep(1),
      ...validateStep(3),
      ...validateStep(4),
    };
    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors);
      // Navigate to the first failing step
      if (allErrors.clinicName) setStep(1);
      else if (allErrors.phone) setStep(3);
      else if (allErrors.address) setStep(4);
      return;
    }

    logger.action(MOD, "User submitting onboarding form", {
      hasLogo: !!clinicLogoUrl,
      countryCode: country?.code || "PK",
    });

    const t0 = performance.now();
    try {
      setSaving(true);
      setGlobalError(null);

      const updated = await updateDoctorProfile({
        clinic_name: clinicName.trim(),
        phone: combinedPhone,
        location: address.trim(),
        avatar_url: clinicLogoUrl || profileData?.avatar_url || DEFAULT_DOCTOR_AVATAR,
        app_icon_url: clinicLogoUrl || profileData?.app_icon_url || undefined,
        full_name: profileData?.full_name,
        speciality: profileData?.speciality ?? undefined,
        bio: profileData?.bio ?? undefined,
        services: profileData?.services,
        onboarding_completed: true,
      });

      const elapsed = Math.round(performance.now() - t0);
      if (updated.tenant_slug) setTenantSlug(updated.tenant_slug);

      logger.info(MOD, "Onboarding completed successfully, opening dashboard", {
        tenantSlug: updated.tenant_slug,
        elapsedMs: elapsed,
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save clinic setup.";
      setGlobalError(msg);
      logger.error(
        MOD,
        "Onboarding save failed",
        err instanceof Error ? err : new Error(String(err)),
        { step }
      );
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Copy link
  // ─────────────────────────────────────────────────────────────────────────
  const localPatientUrl = tenantSlug
    ? `${localOrigin}/${tenantSlug}`
    : `${localOrigin}/clinic`;

  const copyLocalLink = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(localPatientUrl).catch(() => { });
      }
    } catch { /* insecure context — silent */ }
    setCopied(true);
    logger.action(MOD, "User copied patient portal URL");
    setTimeout(() => setCopied(false), 2500);
  }, [localPatientUrl]);

  // ─────────────────────────────────────────────────────────────────────────
  // ── LOADING SCREEN ────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen bg-hospital-surface flex flex-col items-center justify-center gap-4"
        aria-live="polite"
        aria-busy="true"
        role="status"
      >
        <Loader2
          className="w-10 h-10 text-brand-600 animate-spin stroke-[2.2]"
          aria-hidden="true"
        />
        <p className="text-sm font-bold text-hospital-navy tracking-wide">
          Loading Practice Workspace…
        </p>
      </div>
    );
  }

  // Derived layout flags
  const showProgress = !isCompleted && !saving;

  // ─────────────────────────────────────────────────────────────────────────
  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col bg-hospital-surface text-hospital-textMain selection:bg-brand-100 selection:text-brand-900">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <OnboardingHeader
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        showProgress={showProgress}
      />

      {/* ── MOBILE STEP BADGE ─────────────────────────────────────────────── */}
      {showProgress && <MobileStepBadge currentStep={step} />}

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 lg:p-10" id="main-content">

        {/* ── SAVING STATE ─────────────────────────────────────────────── */}
        {saving && (
          <div
            className="w-full max-w-lg bg-white border border-hospital-border rounded-2xl sm:rounded-3xl p-8 sm:p-12 shadow-xl shadow-slate-200/50 flex flex-col items-center justify-center gap-6 text-center my-auto"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2
              className="w-14 h-14 text-brand-600 animate-spin stroke-[2]"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-hospital-navy tracking-tight">
                Just a moment…
              </h2>
              <p className="text-sm text-hospital-textMuted leading-relaxed">
                Saving your clinic configuration and opening your dashboard.
              </p>
            </div>
          </div>
        )}

        {/* ── WIZARD STEPS (Centered Card on md+) ─────────────────────────── */}
        {!isCompleted && !saving && (
          <div className="w-full max-w-4xl bg-white border border-hospital-border rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col md:flex-row my-auto min-h-[500px]">

            {/* Sidebar */}
            <OnboardingSidebar currentStep={step} />

            {/* Content panel */}
            <div
              key={`step-panel-${step}`}
              className="flex-1 flex flex-col justify-between p-6 sm:p-8 md:p-10 bg-white rounded-2xl sm:rounded-3xl md:rounded-l-none animate-in fade-in-50 duration-200"
              onKeyDown={handleKeyDown}
            >
              <div className="space-y-6">

                {/* Step heading */}
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-800 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                    Step {step} of {TOTAL_STEPS}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-hospital-textMain tracking-tight">
                    {WIZARD_STEPS[step - 1]?.title}
                  </h2>
                  <p className="text-sm text-hospital-textMuted">
                    {WIZARD_STEPS[step - 1]?.description}
                  </p>
                </div>

                {/* Global error banner */}
                {globalError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700 flex items-start gap-2.5 shadow-2xs"
                  >
                    <span
                      className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1 animate-pulse"
                      aria-hidden="true"
                    />
                    <span>{globalError}</span>
                  </div>
                )}

                {/* ── STEP 1 — CLINIC NAME ─────────────────────────── */}
                {step === 1 && (
                  <Step1ClinicName
                    clinicName={clinicName}
                    onChange={(v) => {
                      setClinicName(v);
                      if (fieldErrors.clinicName)
                        setFieldErrors((p) => ({ ...p, clinicName: undefined }));
                    }}
                    fieldError={fieldErrors.clinicName}
                  />
                )}

                {/* ── STEP 2 — CLINIC LOGO ─────────────────────────── */}
                {step === 2 && (
                  <Step2ClinicLogo
                    logoUrl={clinicLogoUrl}
                    uploading={uploadingLogo}
                    onUpload={handleLogoUpload}
                    onReset={handleResetLogo}
                    fieldError={fieldErrors.logo}
                  />
                )}

                {/* ── STEP 3 — CONTACT PHONE ───────────────────────── */}
                {step === 3 && (
                  <Step3ContactPhone
                    country={country}
                    localNumber={localNumber}
                    onCountryChange={(c) => {
                      setCountry(c);
                      logger.action(MOD, "Country dial code changed", {
                        countryCode: c.code,
                        dial: c.dial,
                      });
                    }}
                    onLocalNumberChange={(v) => {
                      setLocalNumber(v);
                      if (fieldErrors.phone)
                        setFieldErrors((p) => ({ ...p, phone: undefined }));
                    }}
                    fieldError={fieldErrors.phone}
                  />
                )}

                {/* ── STEP 4 — CLINIC LOCATION ─────────────────────── */}
                {step === 4 && (
                  <Step4ClinicLocation
                    address={address}
                    onChange={(v) => {
                      setAddress(v);
                      if (fieldErrors.address)
                        setFieldErrors((p) => ({ ...p, address: undefined }));
                    }}
                    fieldError={fieldErrors.address}
                  />
                )}
              </div>

              {/* ── FOOTER NAVIGATION ──────────────────────────────── */}
              <div className="pt-6 mt-8 border-t border-hospital-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={step === 1}
                  aria-label="Go to previous step"
                  className={[
                    "inline-flex items-center justify-center gap-1.5",
                    "px-5 py-2.5 min-h-[44px] min-w-[80px]",
                    "text-xs font-bold rounded-xl",
                    "bg-white hover:bg-slate-100 border border-hospital-border",
                    "text-hospital-textMain transition-colors cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    "disabled:opacity-30 disabled:pointer-events-none",
                  ].join(" ")}
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving || uploadingLogo}
                  aria-label={
                    step === TOTAL_STEPS
                      ? "Finish setup and launch clinic"
                      : "Go to next step"
                  }
                  className={[
                    "inline-flex items-center justify-center gap-1.5",
                    "px-7 py-2.5 min-h-[44px] min-w-[120px]",
                    "text-xs font-bold rounded-xl",
                    "bg-brand-600 hover:bg-brand-700 active:scale-95",
                    "text-white shadow-md shadow-brand-600/25 transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                    "disabled:opacity-50 disabled:pointer-events-none",
                  ].join(" ")}
                >
                  {step === TOTAL_STEPS ? (
                    <>
                      <span>Finish &amp; Launch</span>
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLETION SCREEN ────────────────────────────────────────── */}
        {isCompleted && (
          <div
            className="w-full max-w-2xl bg-white border border-hospital-border rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 flex flex-col items-center justify-center gap-8 text-center my-auto"
            aria-live="polite"
          >
            {/* Success icon */}
            <div
              className="w-20 h-20 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shadow-lg shadow-brand-600/10"
              aria-hidden="true"
            >
              <CheckCircle2 className="w-12 h-12 stroke-[1.8]" />
            </div>

            <div className="space-y-2 max-w-lg">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-hospital-textMain tracking-tight">
                Practice Setup Complete!
              </h1>
              <p className="text-sm text-hospital-textMuted leading-relaxed">
                Your clinic{" "}
                <strong className="font-bold text-hospital-textMain">{clinicName}</strong>{" "}
                is now configured and ready to receive patient appointments.
              </p>
            </div>

            {/* Patient Portal URL box */}
            <section
              aria-label="Patient portal link"
              className="w-full max-w-xl bg-hospital-surface border border-hospital-border rounded-2xl p-5 text-left space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-brand-800 uppercase tracking-wider">Patient Portal URL</span>
                <span className="text-[10px] text-brand-800 font-mono bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  Direct Access
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-hospital-borderDark rounded-xl p-2.5 shadow-2xs">
                <input
                  type="text"
                  readOnly
                  value={localPatientUrl}
                  aria-label="Patient portal URL"
                  className="bg-transparent text-sm font-mono text-brand-800 font-semibold flex-1 outline-none truncate select-all px-1 min-h-[36px]"
                />
                <button
                  type="button"
                  onClick={copyLocalLink}
                  aria-label={copied ? "Link copied to clipboard" : "Copy patient portal link"}
                  className={[
                    "inline-flex items-center justify-center gap-1.5",
                    "px-3.5 py-2 min-h-[40px] text-xs font-bold rounded-lg",
                    "bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200",
                    "transition-colors shrink-0 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  ].join(" ")}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-hospital-textSubtle">
                Patients can open this URL to book instant appointment slots.
              </p>
            </section>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-lg">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Book an appointment with ${clinicName || "our clinic"}: ${localPatientUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "inline-flex items-center justify-center gap-2",
                  "px-5 py-3 min-h-[46px]",
                  "bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl",
                  "shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                ].join(" ")}
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                <span>Share WhatsApp</span>
              </a>

              <Link
                href={localPatientUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "inline-flex items-center justify-center gap-2",
                  "px-5 py-3 min-h-[46px]",
                  "bg-brand-50 hover:bg-brand-100 text-brand-800 text-xs sm:text-sm font-bold rounded-xl border border-brand-200",
                  "active:scale-98 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                ].join(" ")}
              >
                <span>View Portal</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>

              <Link
                href="/dashboard"
                className={[
                  "inline-flex items-center justify-center gap-2",
                  "px-6 py-3 min-h-[46px]",
                  "bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold rounded-xl",
                  "shadow-md shadow-brand-600/25 active:scale-98 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                ].join(" ")}
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
