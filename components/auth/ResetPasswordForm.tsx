"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Mail,
} from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { resetPassword } from "@/lib/api";
import { logger } from "@/lib/logger";
import { validatePassword } from "./EmailAuthForm";

interface ResetPasswordFormProps {
  initialToken?: string;
  initialCode?: string;
  initialEmail?: string;
}

export default function ResetPasswordForm({
  initialToken = "",
  initialCode = "",
  initialEmail = "",
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [token] = useState(initialToken);
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwdValidation = validatePassword(password);
  const hasCredential = Boolean(token.trim() || code.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeCode = code.trim();
    const activeToken = token.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!activeCode && !activeToken) {
      setError("Please provide a valid 6-digit reset code or reset link.");
      return;
    }

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (!pwdValidation.isValid) {
      setError("Password does not meet the security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      logger.action("Auth", "User submitted reset password", {
        hasCode: Boolean(activeCode),
        hasToken: Boolean(activeToken),
        hasEmail: Boolean(cleanEmail),
      });

      const authData = await resetPassword({
        new_password: password,
        email: cleanEmail || undefined,
        code: activeCode || undefined,
        token: activeToken || undefined,
      });

      setSuccess(true);
      logger.info("Auth", "Password successfully reset and authenticated");

      setTimeout(() => {
        if (authData?.doctor && !authData.doctor.onboarding_completed) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Password reset failed. The code may be expired or invalid.";
      logger.error("Reset password failure", err, { email: cleanEmail }, "Auth");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="text-center space-y-3">
          <BrandLogo size="md" />
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto border border-brand-100">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
            <p className="text-slate-600 text-sm mt-1">
              Choose a strong, secure password for your doctor portal.
            </p>
          </div>
        </div>

        {success && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <p className="leading-tight">
              Password reset successfully! Redirecting you to your practice dashboard...
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-tight">{error}</p>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* If neither code nor token came from params, ask for code and email */}
            {!hasCredential && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="reset-email">
                    Practice Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      disabled={loading}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="doctor@clinic.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="reset-code">
                    6-Digit Reset Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    disabled={loading}
                    value={code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setCode(val);
                      if (error) setError(null);
                    }}
                    placeholder="123456"
                    className="w-full text-center text-2xl font-mono tracking-[0.25em] py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
              </>
            )}

            {/* If email was provided via params, show a subtle reminder */}
            {hasCredential && email && (
              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                <span>Resetting password for:</span>
                <span className="font-semibold text-slate-800">{email}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="new-password">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus={hasCredential}
                  disabled={loading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="confirm-new-password">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Re-enter your new password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-amber-600 mt-1">Passwords do not match yet.</p>
              )}
            </div>

            {/* Password Strength Checklist */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
              <p className="font-semibold text-slate-700">Password requirements:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600">
                <div className={`flex items-center gap-1.5 ${pwdValidation.hasMinLength ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                  {pwdValidation.hasMinLength ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1 shrink-0" />
                  )}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdValidation.hasUppercase ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                  {pwdValidation.hasUppercase ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1 shrink-0" />
                  )}
                  <span>Uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdValidation.hasLowercase ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                  {pwdValidation.hasLowercase ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1 shrink-0" />
                  )}
                  <span>Lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdValidation.hasDigit ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                  {pwdValidation.hasDigit ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1 shrink-0" />
                  )}
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdValidation.hasSpecial ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                  {pwdValidation.hasSpecial ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1 shrink-0" />
                  )}
                  <span>Special symbol (!@#$...)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !pwdValidation.isValid || password !== confirmPassword}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Reset Password & Sign In</span>
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to login</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Encrypted HIPAA & GDPR-ready platform</span>
        </div>
      </div>
    </div>
  );
}
