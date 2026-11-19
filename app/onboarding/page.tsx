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
 *   │   └── dialCodes.ts                  ← Re-exports from @/lib/dialCodes
 *   └── components/
 *       ├── OnboardingLayout.tsx          ← Header (BrandLogo), Sidebar, MobileStepBadge
 *       ├── OnboardingStepContent.tsx     ← Step1–Step4 pure form components
 *       └── OnboardingPhoneInput.tsx      ← Re-exports from @/components/ui/PhoneInput
 *
 * Standards:
 *   • WCAG 2.1 AA — aria-*, role=*, focus management, combobox
 *   • Clean redirect — saves configuration and navigates directly to /dashboard
 *   • Logger integration — all actions, API calls, errors tracked (no PII)
 *   • Field-level validation — inline errors per field, 7–15 digit phone validation
 *   • TypeScript strict — no `any`, narrow error types
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import {
  getDoctorProfile,
  updateDoctorProfile,
  uploadDoctorAvatar,
  DEFAULT_DOCTOR_AVATAR,
  DoctorProfileResponse,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  COUNTRY_DIAL_CODES,
  CountryDialCode,
  detectDefaultCountry,
  parseStoredPhone,
  stripLeadingZero,
  validatePhoneNumber,
} from "@/lib/dialCodes";

import { WIZARD_STEPS, TOTAL_STEPS } from "./constants/steps";
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

  // ── UI states ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [step, setStep] = useState<number>(1);

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

  // Combined international phone string (with leading trunk zeros stripped)
  const cleanedLocalNumber = stripLeadingZero(localNumber);
  const combinedPhone = `${country?.dial || "+92"} ${cleanedLocalNumber}`.trim();

  // ─────────────────────────────────────────────────────────────────────────
  // Load profile on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
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
        if (msg.includes("Session expired") || msg.includes("401") || msg.includes("Unauthorized")) {
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Logo Upload & Reset
  // ─────────────────────────────────────────────────────────────────────────
  const handleLogoSelect = useCallback(async (file: File) => {
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
  }, []);

  const handleResetLogo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Explicit removal persists DEFAULT_DOCTOR_AVATAR on save
    setClinicLogoUrl("");
    setFieldErrors((prev) => ({ ...prev, logo: undefined }));
    logger.action(MOD, "User removed clinic logo");
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Field validation — returns field-level error or null
  // ─────────────────────────────────────────────────────────────────────────
  const validateStep = useCallback(
    (stepId: number): FieldErrors => {
      const errors: FieldErrors = {};
      switch (stepId) {
        case 1:
          if (!clinicName.trim()) {
            errors.clinicName = "Please enter your clinic name.";
          } else if (clinicName.trim().length < 3) {
            errors.clinicName = "Clinic name must be at least 3 characters.";
          }
          break;
        case 2:
          // Logo is optional — no validation errors
          break;
        case 3: {
          const cleaned = stripLeadingZero(localNumber);
          if (!cleaned) {
            errors.phone = "Please enter a contact number.";
          } else if (!validatePhoneNumber(cleaned)) {
            errors.phone = "Phone number must be between 7 and 15 digits.";
          }
          break;
        }
        case 4:
          if (!address.trim()) {
            errors.address = "Please enter the clinic address.";
          } else if (address.trim().length < 10) {
            errors.address = "Please provide a more complete address.";
          }
          break;
      }
      return errors;
    },
    [clinicName, localNumber, address]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Finalize — save to API and redirect straight to /dashboard
  // ─────────────────────────────────────────────────────────────────────────
  const handleFinalizeSetup = useCallback(async () => {
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

      // Persist removed logo as DEFAULT_DOCTOR_AVATAR rather than falling back to previous avatar
      const finalAvatar = clinicLogoUrl ? clinicLogoUrl : DEFAULT_DOCTOR_AVATAR;

      const updated = await updateDoctorProfile({
        clinic_name: clinicName.trim(),
        phone: combinedPhone,
        location: address.trim(),
        avatar_url: finalAvatar,
        app_icon_url: clinicLogoUrl ? clinicLogoUrl : "",
        full_name: profileData?.full_name,
        speciality: profileData?.speciality ?? undefined,
        bio: profileData?.bio ?? undefined,
        services: profileData?.services,
        onboarding_completed: true,
      });

      const elapsed = Math.round(performance.now() - t0);

      logger.info(MOD, "Onboarding completed successfully, redirecting to dashboard", {
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
  }, [
    validateStep,
    clinicLogoUrl,
    country,
    clinicName,
    combinedPhone,
    address,
    profileData,
    router,
    step,
  ]);

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
  }, [step, validateStep, handleFinalizeSetup]);

  const handleBack = useCallback(() => {
    setGlobalError(null);
    setFieldErrors({});
    if (step > 1) {
      logger.action(MOD, "User navigated back", { from: step });
      setStep((prev) => prev - 1);
    }
  }, [step]);

  // ─────────────────────────────────────────────────────────────────────────
  // Enter key — advances step (except textarea on step 4 or interactive elements)
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Do not intercept Enter when target is an interactive non-text element (buttons, links, textareas)
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("role") === "button" ||
          target.getAttribute("role") === "option")
      ) {
        return;
      }

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
  // ── LOADING SCREEN ────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen bg-hospital-surface flex flex-col items-center justify-center gap-4"
        aria-live="polite"
        aria-busy={!globalError}
        role="status"
      >
        {globalError ? (
          <div className="max-w-md p-6 bg-white border border-red-200 rounded-2xl shadow-lg text-center space-y-4 mx-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-hospital-navy">Connection Error</h2>
              <p className="text-sm text-red-600">{globalError}</p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                setGlobalError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <Loader2
              className="w-10 h-10 text-brand-600 animate-spin stroke-[2.2]"
              aria-hidden="true"
            />
            <p className="text-sm font-bold text-hospital-navy tracking-wide">
              Loading Practice Workspace…
            </p>
          </>
        )}
      </div>
    );
  }

  // Derived layout flag
  const showProgress = !saving;

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
        {!saving && (
          <div className="w-full max-w-4xl bg-white border border-hospital-border rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col md:flex-row my-auto min-h-[500px]">

            {/* Sidebar */}
            <OnboardingSidebar currentStep={step} />

            {/* Content panel */}
            <div
              key={`step-panel-${step}`}
              className="flex-1 flex flex-col justify-between p-6 sm:p-8 md:p-10 bg-white rounded-2xl sm:rounded-3xl md:rounded-l-none"
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
                    onFileSelect={handleLogoSelect}
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
      </main>
    </div>
  );
}
