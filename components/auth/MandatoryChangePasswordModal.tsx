"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { changePassword, removeAuthToken, DoctorMeResponse } from "@/lib/api";
import { logger } from "@/lib/logger";

interface MandatoryChangePasswordModalProps {
  doctor: DoctorMeResponse;
  onSuccess: () => void;
}

export default function MandatoryChangePasswordModal({
  doctor,
  onSuccess,
}: MandatoryChangePasswordModalProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time strength criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isStrong = passedCount === 5;
  const canSubmit = isStrong && passwordsMatch && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isStrong) {
      setError("Please choose a stronger password meeting all requirements below.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setSubmitting(true);
    try {
      logger.action("Auth", "Submitting mandatory strong password change", {
        userId: doctor.id,
      });

      await changePassword({
        new_password: newPassword,
      });

      logger.info("Auth", "Strong password set successfully", {
        userId: doctor.id,
      });

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password.";
      logger.warn("Auth", "Password change failed", { error: msg });
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    logger.action("Auth", "User clicked cancel on password change", {
      userId: doctor.id,
    });
    removeAuthToken();
    router.replace("/login");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3">
          <h2
            id="change-password-title"
            className="text-base font-bold text-slate-900 tracking-tight"
          >
            Set New Password
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* New Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="new-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600"
              >
                New Password
              </label>
              {newPassword.length > 0 && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isStrong
                      ? "text-emerald-700"
                      : passedCount >= 3
                      ? "text-amber-700"
                      : "text-rose-600"
                  }`}
                >
                  {isStrong ? "Strong" : passedCount >= 3 ? "Moderate" : "Weak"}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="At least 8 characters"
                className="w-full h-10 px-3 pr-10 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Strength Meter Bar */}
            {newPassword.length > 0 && (
              <div className="flex gap-1 mt-1.5 h-1">
                <div
                  className={`flex-1 rounded-full transition-all ${
                    passedCount >= 1 ? (passedCount >= 5 ? "bg-emerald-500" : passedCount >= 3 ? "bg-amber-400" : "bg-rose-400") : "bg-slate-200"
                  }`}
                />
                <div
                  className={`flex-1 rounded-full transition-all ${
                    passedCount >= 3 ? (passedCount >= 5 ? "bg-emerald-500" : "bg-amber-400") : "bg-slate-200"
                  }`}
                />
                <div
                  className={`flex-1 rounded-full transition-all ${
                    passedCount >= 5 ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
            >
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Re-enter new password"
                className="w-full h-10 px-3 pr-10 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[10px] text-rose-500 mt-1 font-medium">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-[11px] text-slate-500">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-700 font-semibold" : ""}`}>
              <Check className={`w-3 h-3 ${hasMinLength ? "text-emerald-600" : "text-slate-300"}`} />
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasUpper && hasLower ? "text-emerald-700 font-semibold" : ""}`}>
              <Check className={`w-3 h-3 ${hasUpper && hasLower ? "text-emerald-600" : "text-slate-300"}`} />
              <span>Uppercase (A-Z) & lowercase (a-z)</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasNumber && hasSpecial ? "text-emerald-700 font-semibold" : ""}`}>
              <Check className={`w-3 h-3 ${hasNumber && hasSpecial ? "text-emerald-600" : "text-slate-300"}`} />
              <span>Number (0-9) & special character (!@#$)</span>
            </div>
          </div>

          {/* Action Buttons: Cancel and Confirm */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 h-10 inline-flex items-center justify-center rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Confirm</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
