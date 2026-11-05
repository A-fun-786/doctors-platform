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
  Stethoscope,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";
import { loginWithEmail, registerWithEmail, authenticateWithGoogle } from "@/lib/api";
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
  mode: "login" | "register";
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export default function EmailAuthForm({ mode }: EmailAuthFormProps) {
  const router = useRouter();
  const [authRole, setAuthRole] = useState<"admin" | "staff">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const DEFAULT_GOOGLE_CLIENT_ID = "644948532553-g01hlshcmkoaft84l6b06oc9nklm9j1u.apps.googleusercontent.com";
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;

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

  // Direct trigger or fallback when clicking custom Google button
  const handleGoogleClick = () => {
    if (window.google?.accounts?.id && googleClientId) {
      try {
        window.google.accounts.id.prompt();
        return;
      } catch {
        // Fall back to demo authentication if One Tap prompt encounters issue
      }
    }
    // Demo token authentication for local development and fast verification
    const mockToken = `mock-google-token:dr.ahmed.khan@example.com:Dr. Ahmed Khan:google-sub-demo:https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150`;
    handleGoogleAuth(mockToken);
  };

  useEffect(() => {
    if (!googleClientId) return;

    let isMounted = true;

    const renderGoogleButton = () => {
      if (!isMounted) return;
      setIsGsiLoaded(true);
      if (window.google && googleButtonRef.current) {
        try {
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
        } catch {
          // Keep custom button active if GSI render encounters issue
        }
      }
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
  }, [googleClientId, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    logger.action("Auth", `User submitted ${mode} form`, {
      email: cleanEmail,
      mode,
    });

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

    if (mode === "register" && password.length < 6) {
      logger.warn("Auth", "Registration password below required 6 character length");
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let authData;
      if (mode === "register") {
        authData = await registerWithEmail(cleanEmail.toLowerCase(), password);
      } else {
        authData = await loginWithEmail(cleanEmail.toLowerCase(), password, authRole);
      }

      logger.info("Auth", `Authentication successful via email (${mode})`, {
        doctorId: authData?.doctor?.id,
        email: authData?.doctor?.email,
        onboardingCompleted: authData?.doctor?.onboarding_completed,
      });

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
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 px-4 py-8 overflow-hidden">
      {/* Subtle ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70 pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[400px] w-full relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_15px_35px_-10px_rgba(15,23,42,0.07)] p-6 sm:p-7 space-y-4 relative overflow-hidden">
          {/* Subtle top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600" />

          {/* Brand Logo & Header with Explanatory Subtitle */}
          <div className="text-center space-y-1.5 pt-1">
            <div className="flex justify-center pb-1">
              <BrandLogo size="md" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === "register"
                ? "Register Practice"
                : authRole === "admin"
                ? "Admin Login"
                : "Staff Login"}
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {mode === "register"
                ? "Provision an isolated practice workspace with dedicated appointments and patient records."
                : authRole === "admin"
                ? "Practice owner and lead clinician portal for managing clinic settings and staff."
                : "Portal for employed doctors, nurses, and care team members with clinic credentials."}
            </p>
          </div>

          {/* Segmented Role Switch with Explanatory Sub-label (Login mode only) */}
          {mode === "login" && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setAuthRole("admin");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authRole === "admin"
                      ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/70"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Stethoscope
                    className={`w-3.5 h-3.5 ${
                      authRole === "admin" ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthRole("staff");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authRole === "staff"
                      ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/70"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users
                    className={`w-3.5 h-3.5 ${
                      authRole === "staff" ? "text-teal-600" : "text-slate-400"
                    }`}
                  />
                  <span>Staff</span>
                </button>
              </div>

              {/* Explanatory role context */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                <span>
                  {authRole === "admin"
                    ? "Practice Owner / Lead Doctor"
                    : "Employed Doctors & Care Team"}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                  {authRole === "admin" ? "Practice Management" : "Assigned Workspace"}
                </span>
              </div>
            </div>
          )}

          {/* Error Alert with 1-Click Switch Option */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
                <p className="leading-snug font-medium">{error}</p>
              </div>
              {error.includes("switch to the 'Staff' tab") && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthRole("staff");
                    setError(null);
                  }}
                  className="self-start text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-white px-2.5 py-1 rounded-md border border-teal-200 shadow-2xs hover:bg-teal-50 transition-colors cursor-pointer"
                >
                  Switch to Staff Tab →
                </button>
              )}
              {error.includes("switch to the 'Admin' tab") && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthRole("admin");
                    setError(null);
                  }}
                  className="self-start text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  Switch to Admin Tab →
                </button>
              )}
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={
                    mode === "register"
                      ? "doctor@example.com"
                      : authRole === "admin"
                      ? "doctor@example.com"
                      : "staff@clinic.com"
                  }
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                {mode === "login" && authRole === "staff" && (
                  <span className="text-[10px] text-slate-400">Clinic-assigned</span>
                )}
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={mode === "register" ? "At least 6 characters" : "Enter password"}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition-all disabled:opacity-50 mt-1 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{mode === "register" ? "Create Account" : "Sign In"}</span>
            </button>
          </form>

          {/* Google Sign-In Option */}
          {mode === "register" || authRole === "admin" ? (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="relative flex py-0.5 items-center justify-center">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider bg-white px-2">
                  or
                </span>
              </div>

              {googleLoading ? (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Authenticating with Google...</span>
                </div>
              ) : isGsiLoaded ? (
                <div className="w-full flex justify-center min-h-[40px]">
                  <div ref={googleButtonRef} className="w-full flex justify-center" />
                </div>
              ) : (
                <>
                  <div ref={googleButtonRef} className="hidden" />
                  <button
                    type="button"
                    disabled={loading || googleLoading}
                    onClick={handleGoogleClick}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{mode === "register" ? "Sign up with Google" : "Sign in with Google"}</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="pt-1 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Sign in with Google is available for{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthRole("admin");
                    setError(null);
                  }}
                  className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                >
                  Admin
                </button>{" "}
                practice accounts.
              </p>
            </div>
          )}

          {/* Explanatory Security / Isolation Footnote */}
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-normal">
              {mode === "register"
                ? "Each practice workspace is strictly isolated with independent patient records."
                : authRole === "admin"
                ? "Practice owner sessions have isolated access to clinic settings, appointments, and staff."
                : "Staff and employed doctors access shared clinic records according to administrative permissions."}
            </p>
          </div>

          {/* Navigation Links */}
          <div className="pt-0.5 text-center space-y-1.5">
            {mode === "register" ? (
              <p className="text-xs text-slate-500">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="text-emerald-700 font-semibold hover:text-emerald-800 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            ) : authRole === "admin" ? (
              <p className="text-xs text-slate-500">
                New practice?{" "}
                <Link
                  href="/register"
                  className="text-emerald-700 font-semibold hover:text-emerald-800 hover:underline"
                >
                  Register practice
                </Link>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Need to reset credentials? Contact your clinic administrator.
              </p>
            )}

            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{BRAND_CONFIG.backToHome}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

