"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { forgotPassword } from "@/lib/api";
import { logger } from "@/lib/logger";
import { isValidEmail } from "./EmailAuthForm";

interface ForgotPasswordFormProps {
  initialEmail?: string;
}

export default function ForgotPasswordForm({ initialEmail = "" }: ForgotPasswordFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "otp">("request");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 60-second cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      logger.action("Auth", "User requested password reset", { email: cleanEmail });
      const res = await forgotPassword(cleanEmail);
      setInfoMessage(res.message || "If the email is registered, a reset code and link have been sent.");
      setStep("otp");
      setCooldown(60);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to send reset code. Please try again.";
      logger.error("Forgot password request failure", err, { email: cleanEmail }, "Auth");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfoMessage(null);

    try {
      setResending(true);
      const res = await forgotPassword(email.trim().toLowerCase());
      setInfoMessage(res.message || "A new reset code has been sent to your email.");
      setCooldown(60);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to resend reset code. Please wait.";
      setError(errMsg);
    } finally {
      setResending(false);
    }
  };

  const handleProceedWithOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setError("Please enter the 6-digit reset code.");
      return;
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Reset code must be exactly 6 digits.");
      return;
    }

    const query = new URLSearchParams({
      code: cleanOtp,
      email: email.trim().toLowerCase(),
    });
    router.push(`/auth/reset-password?${query.toString()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        {step === "request" ? (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <BrandLogo size="md" />
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto border border-brand-100">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
                <p className="text-slate-600 text-sm mt-1">
                  Enter your registered doctor email address. We&apos;ll send you a 6-digit reset code and magic link.
                </p>
              </div>
            </div>

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

            <form onSubmit={handleRequestReset} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email">
                  Practice Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
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

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Send Reset Code</span>
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to login</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Step 2: Check your email & enter OTP */
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <BrandLogo size="md" />
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto border border-brand-100">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
                <p className="text-slate-600 text-sm mt-1">
                  We sent a 6-digit reset code and magic link to{" "}
                  <span className="font-semibold text-slate-900">{email}</span>.
                </p>
              </div>
            </div>

            {infoMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                <p className="leading-tight">{infoMessage}</p>
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

            <form onSubmit={handleProceedWithOtp} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="otp-code">
                  6-Digit Reset Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  required
                  disabled={loading}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(val);
                    if (error) setError(null);
                  }}
                  placeholder="123456"
                  className="w-full text-center text-2xl font-mono tracking-[0.25em] py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.trim().length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Continue to Set New Password</span>
              </button>
            </form>

            <div className="flex flex-col items-center gap-3 pt-2 border-t border-slate-100 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-xs">
                <span>Didn&apos;t receive the email?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || resending}
                  onClick={handleResend}
                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1 cursor-pointer"
                >
                  {resending && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</span>
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("request");
                    setError(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Change email
                </button>
                <span className="text-slate-300">•</span>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to login</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Encrypted HIPAA & GDPR-ready platform</span>
        </div>
      </div>
    </div>
  );
}
