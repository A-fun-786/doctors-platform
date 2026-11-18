"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OnboardingStepContent — Pure render component for each wizard step.
 *
 * Keeps page.tsx clean by isolating per-step form JSX here.
 * Each step receives only the props it needs — no shared state bleed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from "react";
import {
  Building2,
  Upload,
  Loader2,
  CheckCircle2,
  RotateCcw,
  MapPin,
  Image as ImageIcon,
} from "lucide-react";
import { CountryDialCode } from "../constants/dialCodes";
import { OnboardingPhoneInput } from "./OnboardingPhoneInput";

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-bold text-hospital-navy uppercase tracking-wider"
    >
      {children}
    </label>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3.5 rounded-xl bg-brand-50/70 border border-brand-200/80 text-xs text-brand-900 flex items-start gap-2.5 font-medium">
      <CheckCircle2
        className="w-4 h-4 text-brand-600 shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Clinic Name
// ─────────────────────────────────────────────────────────────────────────────

interface Step1Props {
  clinicName: string;
  onChange: (v: string) => void;
  fieldError?: string | null;
}

export function Step1ClinicName({ clinicName, onChange, fieldError }: Step1Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="clinic-name">Clinic / Practice Name *</FieldLabel>
        <div className="relative">
          <input
            id="clinic-name"
            type="text"
            value={clinicName}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Metro Care Clinic & Diagnostic Center"
            aria-required="true"
            aria-describedby={fieldError ? "clinic-name-error" : undefined}
            aria-invalid={!!fieldError}
            maxLength={120}
            className={[
              "w-full px-4 py-3 pr-12 min-h-[52px]",
              "bg-hospital-surface focus:bg-white",
              "rounded-xl text-hospital-textMain",
              "placeholder:text-hospital-textSubtle/60",
              "text-base font-semibold",
              "focus:outline-none focus:ring-4 transition-all shadow-2xs",
              fieldError
                ? "border border-red-400 focus:ring-red-400/10"
                : "border border-hospital-borderDark focus:border-brand-600 focus:ring-brand-500/10",
            ].join(" ")}
          />
          <Building2
            className="w-4 h-4 text-hospital-textSubtle absolute right-4 top-4"
            aria-hidden="true"
          />
        </div>
        {fieldError && (
          <p id="clinic-name-error" role="alert" className="text-xs text-red-600 font-semibold pl-1">
            {fieldError}
          </p>
        )}
        <div className="flex items-center justify-between text-[11px] text-hospital-textSubtle pl-1">
          <span>Official practice name displayed to patients</span>
          <span>{120 - clinicName.length} chars left</span>
        </div>
      </div>
      <InfoNote>
        This name appears at the top of your patient booking page and on appointment receipts.
      </InfoNote>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Clinic Logo
// ─────────────────────────────────────────────────────────────────────────────

interface Step2Props {
  logoUrl: string;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: (e: React.MouseEvent) => void;
  fieldError?: string | null;
}

export function Step2ClinicLogo({
  logoUrl,
  uploading,
  onUpload,
  onReset,
  fieldError,
}: Step2Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0 && fileInputRef.current) {
      fileInputRef.current.files = files;
      const changeEvent = new Event("change", { bubbles: true });
      fileInputRef.current.dispatchEvent(changeEvent);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl transition-all duration-200",
          isDragging
            ? "bg-brand-50/80 border-2 border-dashed border-brand-500 ring-4 ring-brand-500/10"
            : "bg-hospital-surface border",
          fieldError ? "border-red-300" : "border-hospital-border",
        ].join(" ")}
      >
        {/* Preview */}
        <div className="relative shrink-0" aria-label="Logo preview">
          <div className="w-28 h-28 rounded-2xl bg-white border-2 border-hospital-border p-2 flex items-center justify-center overflow-hidden shadow-sm">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Clinic logo preview"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-brand-50 border border-brand-200 flex flex-col items-center justify-center text-brand-600 gap-1.5 p-2 text-center">
                <ImageIcon className="w-7 h-7 stroke-[1.6]" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                  Logo
                </span>
              </div>
            )}
            {/* Upload spinner overlay */}
            {uploading && (
              <div
                className="absolute inset-0 bg-white/85 backdrop-blur-xs flex items-center justify-center rounded-2xl"
                aria-label="Uploading logo…"
                aria-live="polite"
              >
                <Loader2 className="w-7 h-7 animate-spin text-brand-600 stroke-[2.2]" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-3 text-center sm:text-left w-full sm:w-auto">
          <div>
            <p className="text-sm font-bold text-hospital-textMain">Upload Practice Logo</p>
            <p className="text-xs text-hospital-textMuted mt-0.5">
              Drag &amp; drop an image here or click browse. PNG, JPG, or WebP up to 2 MB.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={uploading}
              onChange={onUpload}
              className="hidden"
              id="clinic-logo-upload"
              aria-label="Upload clinic logo file"
            />
            <label
              htmlFor="clinic-logo-upload"
              className={[
                "inline-flex items-center justify-center gap-1.5",
                "px-4 py-2.5 min-h-[44px] min-w-[120px]",
                "bg-brand-600 hover:bg-brand-700 active:scale-95",
                "text-white text-xs font-bold rounded-xl",
                "cursor-pointer shadow-sm shadow-brand-600/25 transition-all",
                uploading ? "opacity-60 pointer-events-none" : "",
              ].join(" ")}
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{logoUrl ? "Change Logo" : "Upload File"}</span>
            </label>

            {logoUrl && (
              <button
                type="button"
                onClick={onReset}
                disabled={uploading}
                className={[
                  "inline-flex items-center justify-center gap-1.5",
                  "px-3.5 py-2.5 min-h-[44px]",
                  "bg-white hover:bg-slate-100 border border-hospital-border",
                  "text-hospital-textMuted hover:text-hospital-textMain",
                  "text-xs font-semibold rounded-xl transition-all cursor-pointer",
                  "disabled:opacity-50 disabled:pointer-events-none",
                ].join(" ")}
                aria-label="Remove uploaded logo"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {fieldError && (
        <p role="alert" className="text-xs text-red-600 font-semibold pl-1">
          {fieldError}
        </p>
      )}
      <p className="text-xs text-hospital-textSubtle">
        * Logo upload is optional. If left blank, your practice initials or default medical icon will appear.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Contact Phone
// ─────────────────────────────────────────────────────────────────────────────

interface Step3Props {
  country: CountryDialCode;
  localNumber: string;
  onCountryChange: (c: CountryDialCode) => void;
  onLocalNumberChange: (v: string) => void;
  fieldError?: string | null;
  disabled?: boolean;
}

export function Step3ContactPhone({
  country,
  localNumber,
  onCountryChange,
  onLocalNumberChange,
  fieldError,
  disabled,
}: Step3Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel>Helpline &amp; Appointments Contact Number *</FieldLabel>
        <OnboardingPhoneInput
          country={country}
          localNumber={localNumber}
          onCountryChange={onCountryChange}
          onLocalNumberChange={onLocalNumberChange}
          showPreview
          disabled={disabled}
          error={fieldError}
        />
      </div>
      <InfoNote>
        Patients will use this number for urgent inquiries, booking clarifications, and WhatsApp
        notifications.
      </InfoNote>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Clinic Location
// ─────────────────────────────────────────────────────────────────────────────

interface Step4Props {
  address: string;
  onChange: (v: string) => void;
  fieldError?: string | null;
}

export function Step4ClinicLocation({ address, onChange, fieldError }: Step4Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="clinic-address">Clinic Physical Address &amp; Location *</FieldLabel>
        <div className="relative">
          <textarea
            id="clinic-address"
            rows={4}
            value={address}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Suite 402, 4th Floor, City Medical Tower, Central Avenue, Karachi"
            aria-required="true"
            aria-describedby={fieldError ? "address-error" : undefined}
            aria-invalid={!!fieldError}
            maxLength={300}
            className={[
              "w-full px-4 py-3 pr-12 min-h-[108px]",
              "bg-hospital-surface focus:bg-white rounded-xl",
              "text-hospital-textMain placeholder:text-hospital-textSubtle/60",
              "text-base sm:text-sm font-semibold",
              "focus:outline-none focus:ring-4 transition-all resize-none shadow-2xs",
              fieldError
                ? "border border-red-400 focus:ring-red-400/10"
                : "border border-hospital-borderDark focus:border-brand-600 focus:ring-brand-500/10",
            ].join(" ")}
          />
          <MapPin
            className="w-4 h-4 text-hospital-textSubtle absolute right-4 top-4"
            aria-hidden="true"
          />
        </div>
        {fieldError && (
          <p id="address-error" role="alert" className="text-xs text-red-600 font-semibold pl-1">
            {fieldError}
          </p>
        )}
        <div className="flex items-center justify-between text-[11px] text-hospital-textSubtle pl-1">
          <span className="hidden sm:inline">Press Ctrl + Enter to finish</span>
          <span className="sm:hidden">Accurate address</span>
          <span>{300 - address.length} chars left</span>
        </div>
      </div>
      <InfoNote>
        Accurate location details ensure patients can navigate directly to your practice without delays.
      </InfoNote>
    </div>
  );
}
