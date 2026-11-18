"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OnboardingLayout — Full-screen shell for the clinic setup wizard.
 *
 * Renders:
 *   • Fixed header bar  (brand left, progress right)
 *   • Responsive sidebar (desktop only, md+)
 *   • Scrollable content area (right panel / full-width on mobile)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Check, ShieldCheck } from "lucide-react";
import { StethoscopeHeartPulseIcon } from "@/components/brand/StethoscopeHeartPulseIcon";
import { BRAND_CONFIG } from "@/config/brand.config";
import { WIZARD_STEPS } from "../constants/steps";

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  showProgress: boolean;
}

export function OnboardingHeader({
  currentStep,
  totalSteps,
  showProgress,
}: OnboardingHeaderProps) {
  const percent = Math.round((currentStep / totalSteps) * 100);

  return (
    <header
      role="banner"
      className="h-14 bg-white border-b border-hospital-border px-4 sm:px-6 flex items-center shrink-0 z-20 select-none"
    >
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5" aria-label={BRAND_CONFIG.name}>
          <StethoscopeHeartPulseIcon className="w-7 h-7" aria-hidden="true" />
          <span className="text-sm font-extrabold text-hospital-textMain tracking-tight">
            {BRAND_CONFIG.name}
          </span>
        </div>

        {/* Progress — hidden on completion / saving */}
        {showProgress && (
          <div
            className="flex items-center gap-3"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Setup progress: ${percent}%`}
          >
            <span className="text-xs text-hospital-textSubtle font-semibold hidden sm:block">
              {WIZARD_STEPS[currentStep - 1]?.shortLabel}
            </span>

            {/* Segmented bar */}
            <div className="flex items-center gap-1" aria-hidden="true">
              {WIZARD_STEPS.map((s) => (
                <div
                  key={s.id}
                  className={[
                    "h-1.5 rounded-full transition-all duration-300",
                    currentStep > s.id
                      ? "w-8 bg-brand-600"
                      : currentStep === s.id
                        ? "w-10 bg-brand-500"
                        : "w-8 bg-slate-200",
                  ].join(" ")}
                />
              ))}
            </div>

            <span className="text-xs font-mono font-bold text-brand-700 w-9 text-right tabular-nums">
              {percent}%
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingSidebarProps {
  currentStep: number;
}

export function OnboardingSidebar({ currentStep }: OnboardingSidebarProps) {
  return (
    <aside
      aria-label="Setup steps"
      className="hidden md:flex w-72 lg:w-80 bg-slate-50/90 border-r border-hospital-border p-6 lg:p-8 flex-col justify-start shrink-0 rounded-l-2xl sm:rounded-l-3xl"
    >
      <div className="space-y-6">
        {/* Title block */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
            <ShieldCheck className="w-4 h-4 text-brand-600" aria-hidden="true" />
            <span>Practice Onboarding</span>
          </div>
          <h1 className="text-2xl font-extrabold text-hospital-textMain tracking-tight">
            Setup your Clinic
          </h1>
          <p className="text-xs text-hospital-textMuted leading-relaxed">
            Configure essential clinic identity details to go live instantly.
          </p>
        </div>

        {/* Steps checklist */}
        <nav aria-label="Wizard steps">
          <ol className="space-y-2.5">
            {WIZARD_STEPS.map((s) => {
              const isCurrent = currentStep === s.id;
              const isPast = currentStep > s.id;
              return (
                <li
                  key={s.id}
                  aria-current={isCurrent ? "step" : undefined}
                  className={[
                    "flex items-start gap-3 p-3 rounded-xl transition-all",
                    isCurrent
                      ? "bg-white border border-brand-200 shadow-xs ring-2 ring-brand-500/10"
                      : "opacity-70 hover:opacity-90",
                  ].join(" ")}
                >
                  {/* Step indicator */}
                  <div
                    className={[
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      "text-xs font-bold shrink-0 mt-0.5 transition-colors",
                      isPast
                        ? "bg-brand-600 text-white shadow-xs shadow-brand-600/30"
                        : isCurrent
                          ? "bg-brand-100 text-brand-700 border border-brand-300"
                          : "bg-slate-200/80 text-hospital-textSubtle",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : s.id}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={[
                        "text-xs font-bold",
                        isCurrent
                          ? "text-brand-900"
                          : isPast
                            ? "text-hospital-textMain"
                            : "text-hospital-textSubtle",
                      ].join(" ")}
                    >
                      {s.shortLabel}
                    </p>
                    <p className="text-[11px] text-hospital-textMuted line-clamp-2 leading-snug mt-0.5">
                      {s.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Step Badge
// ─────────────────────────────────────────────────────────────────────────────

interface MobileStepBadgeProps {
  currentStep: number;
}

export function MobileStepBadge({ currentStep }: MobileStepBadgeProps) {
  return (
    <div
      className="md:hidden px-4 pt-3 pb-2.5 border-b border-hospital-border bg-slate-50/80"
      aria-label={`Step ${currentStep} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[currentStep - 1]?.shortLabel}`}
    >
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
        Step {currentStep} of {WIZARD_STEPS.length} —{" "}
        {WIZARD_STEPS[currentStep - 1]?.shortLabel}
      </div>
    </div>
  );
}
