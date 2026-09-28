"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, AlertCircle, Loader2, ArrowLeft, ShieldCheck, Mail, Lock } from "lucide-react";
import { loginWithEmail, registerWithEmail, authenticateWithGoogle } from "@/lib/api";

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

export default function EmailAuthForm({ mode }: EmailAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

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
    if (!googleClientId) return;

    let isMounted = true;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!isMounted) return;
      if (window.google && googleButtonRef.current) {
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
      }
    };
    document.body.appendChild(script);

    return () => {
      isMounted = false;
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let authData;
      if (mode === "register") {
        authData = await registerWithEmail(email, password);
      } else {
        authData = await loginWithEmail(email, password);
      }

      if (authData?.doctor && !authData.doctor.onboarding_completed) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center space-x-2 text-brand-600 font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-slate-900 tracking-tight">DocSpace</span>
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {mode === "register" ? "Create your Doctor Account" : "Welcome Back, Doctor"}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {mode === "register"
                ? "Enter your email to set up your isolated practice workspace."
                : "Sign in to access your practice dashboard."}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-tight">{error}</p>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all"
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
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 6 characters" : "Enter your password"}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition-all"
              />
            </div>
          </div>

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
              <span>Back to DocSpace Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

