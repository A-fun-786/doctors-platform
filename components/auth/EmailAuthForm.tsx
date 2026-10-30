"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
} from "lucide-react";
import {
  loginWithEmail,
  registerWithEmail,
  authenticateWithGoogle,
  verifyEmail,
  resendVerificationEmail,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import BrandLogo from "@/components/brand/BrandLogo";
import { BRAND_CONFIG } from "@/config/brand.config";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface EmailAuthFormProps {
  mode: "login" | "register" | "verify";
  initialEmail?: string;
  initialToken?: string;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export interface PasswordValidation {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\\/~`]/.test(password);
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecial;
  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasDigit,
    hasSpecial,
    isValid,
  };
}

export default function EmailAuthForm({ mode, initialEmail = "", initialToken = "" }: EmailAuthFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"auth" | "verify">(mode === "verify" ? "verify" : "auth");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState(initialToken);
  const [cooldown, setCooldown] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const pwdValidation = validatePassword(password);

  // Cooldown countdown timer for resending verification code
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle Google Token Authentication
  const handleGoogleAuth = async (credential: string) => {
    try {
      setGoogleLoading(true);
      setError(null);
      const authData = await authenticateWithGoogle(credential);
      if (authData?.doctor && !authData.doctor.onboarding_completed) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Google authentication failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || step === "verify") return;

    let isMounted = true;

    const renderGoogleButton = () => {
      if (!isMounted || !window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (res: { credential: string }) => handleGoogleAuth(res.credential),
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: "100%",
        text: mode === "register" ? "signup_with" : "signin_with",
        shape: "rectangular",
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        isMounted = false;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton);
      return () => {
        isMounted = false;
        existingScript.removeEventListener("load", renderGoogleButton);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, mode, step]);

  const handleVerifyCode = async (codeToVerify?: string) => {
    const rawCode = (codeToVerify || verificationCode).trim();
    const cleanEmail = email.trim();
    if (!rawCode) {
      setError("Please enter the verification code or token.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfoMessage(null);

      const authData = await verifyEmail({
        email: cleanEmail ? cleanEmail.toLowerCase() : undefined,
        code: rawCode.length === 6 ? rawCode : undefined,
        token: rawCode.length !== 6 ? rawCode : undefined,
      });

      logger.info("Auth", "Doctor email successfully verified", {
        doctorId: authData?.doctor?.id,
        email: authData?.doctor?.email,
      });

      if (authData?.doctor && !authData.doctor.onboarding_completed) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Email verification failed. Please try again.";
      logger.error("Verification failure", err, { email, code: rawCode }, "Auth");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // If page loaded in verify mode with an initial token, automatically attempt verification
  useEffect(() => {
    if (initialToken && mode === "verify") {
      handleVerifyCode(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address to resend verification code.");
      return;
    }
    if (cooldown > 0 || resending) return;

    try {
      setResending(true);
      setError(null);
      setInfoMessage(null);

      const res = await resendVerificationEmail(cleanEmail);
      setInfoMessage(res.message || "A fresh verification code has been sent to your email.");
      setCooldown(60);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to resend code. Please try again.";
      setError(errMsg);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "verify") {
      await handleVerifyCode();
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    logger.action("Auth", `User submitted ${mode} form`, {
      email: cleanEmail,
      mode,
    });

    if (mode === "register") {
      if (!cleanName || cleanName.length < 2) {
        setError("Please enter your full name (minimum 2 characters).");
        return;
      }
      if (!cleanEmail) {
        setError("Please enter your email address.");
        return;
      }
      if (!isValidEmail(cleanEmail)) {
        logger.warn("Auth", `Validation rejected invalid email format: ${cleanEmail}`);
        setError("Please enter a valid email address.");
        return;
      }
      if (!pwdValidation.isValid) {
        logger.warn("Auth", "Registration password does not meet required complexity");
        setError("Please ensure your password meets all strength requirements below.");
        return;
      }
      if (password !== confirmPassword) {
        logger.warn("Auth", "Registration password confirmation mismatch");
        setError("Passwords do not match.");
        return;
      }
    } else {
      if (!cleanEmail || !password) {
        logger.warn("Auth", `Validation rejected empty credentials for ${mode}`);
        setError("Please fill in both email and password.");
        return;
      }

      if (!isValidEmail(cleanEmail)) {
        logger.warn("Auth", `Validation rejected invalid email format: ${cleanEmail}`);
        setError("Please enter a valid email address.");
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      let authData;
      if (mode === "register") {
        authData = await registerWithEmail(cleanEmail.toLowerCase(), password, cleanName);
        logger.info("Auth", "Doctor registered successfully via email", {
          doctorId: authData?.doctor?.id,
          email: authData?.doctor?.email,
          emailVerified: authData?.doctor?.email_verified,
        });

        // Transition to verify view if verification is pending
        if (authData?.doctor && !authData.doctor.email_verified) {
          setStep("verify");
          setCooldown(60);
          setInfoMessage(`We've sent a 6-digit verification code to ${cleanEmail}. Please enter it below to activate your practice.`);
          return;
        }
      } else {
        authData = await loginWithEmail(cleanEmail.toLowerCase(), password);
        logger.info("Auth", `Authentication successful via email (${mode})`, {
          doctorId: authData?.doctor?.id,
          email: authData?.doctor?.email,
          onboardingCompleted: authData?.doctor?.onboarding_completed,
        });
      }

      if (authData?.doctor && !authData.doctor.onboarding_completed) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Authentication failed. Please try again.";
      logger.error(`Authentication failure (${mode})`, err, { email, mode }, "Auth");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        {step === "verify" ? (
          /* Email Verification Step */
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <BrandLogo size="md" />
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto border border-brand-100">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
                <p className="text-slate-600 text-sm mt-1">
                  We sent a 6-digit code to <span className="font-semibold text-slate-900">{email}</span>.
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

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="verification-code">
                  6-Digit Verification Code
                </label>
                <input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  disabled={loading}
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="123456"
                  className="w-full text-center text-2xl font-mono tracking-[0.25em] py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !verificationCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Verify & Activate Practice</span>
              </button>
            </form>

            <div className="flex flex-col items-center gap-3 pt-2 border-t border-slate-100 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-xs">
                <span>Didn&apos;t receive the code?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || resending}
                  onClick={handleResend}
                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1 cursor-pointer"
                >
                  {resending && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep("auth");
                  setError(null);
                  setInfoMessage(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1 mt-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Change email address</span>
              </button>
            </div>
          </div>
        ) : (
          /* Authentication Form (Login or Register) */
          <>
            {/* Brand Header */}
            <div className="text-center space-y-3">
              <BrandLogo size="md" />

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {mode === "register" ? "Create your Doctor Account" : "Welcome Back, Doctor"}
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  {mode === "register"
                    ? "Enter your details to set up your isolated practice workspace."
                    : "Sign in to access your practice dashboard."}
                </p>
              </div>
            </div>

            {/* Error Alert */}
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

            {/* Email & Password Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="full-name">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="full-name"
                      type="text"
                      required
                      disabled={loading}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Dr. Jane Doe"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="doctor@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
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

              {mode === "register" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="confirm-password">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        disabled={loading}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Re-enter your password"
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
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{mode === "register" ? "Create Account" : "Sign In"}</span>
              </button>
            </form>

            {/* Google Sign-In Option */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="relative flex py-1 items-center justify-center">
                <span className="text-xs text-slate-400 uppercase tracking-wider bg-white px-2">or continue with</span>
              </div>

              {googleLoading ? (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span>Authenticating with Google...</span>
                </div>
              ) : (
                <div className="w-full flex justify-center min-h-[44px]">
                  <div ref={googleButtonRef} className="w-full flex justify-center" />
                </div>
              )}
            </div>

            {/* Security / Workspace Assurance */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {mode === "register"
                  ? "Each doctor automatically receives an isolated tenant workspace with a unique practice slug."
                  : "End-to-end encrypted session with JWT bearer tokens."}
              </span>
            </div>

            {/* Mode Switch & Back to Home */}
            <div className="space-y-3 pt-2 text-center text-sm">
              {mode === "register" ? (
                <p className="text-slate-600">
                  Already registered?{" "}
                  <Link href="/login" className="text-brand-600 font-medium hover:underline">
                    Sign in here
                  </Link>
                </p>
              ) : (
                <p className="text-slate-600">
                  New doctor?{" "}
                  <Link href="/register" className="text-brand-600 font-medium hover:underline">
                    Register practice
                  </Link>
                </p>
              )}

              <div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{BRAND_CONFIG.backToHome}</span>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

