"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, AlertCircle, Loader2, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { authenticateWithGoogle } from "@/lib/api";

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

interface GoogleAuthFormProps {
  mode: "login" | "register";
}

export default function GoogleAuthForm({ mode }: GoogleAuthFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  // Handle Google Token Authentication
  const handleAuth = async (credential: string) => {
    try {
      setLoading(true);
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
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Load Google Identity Services SDK if Client ID is configured
  useEffect(() => {
    if (!googleClientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsGsiLoaded(true);
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res: { credential: string }) => handleAuth(res.credential),
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
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, mode]);

  // Demo account quick sign-in helper
  const handleQuickDemoLogin = (doctorName: string, email: string) => {
    const mockToken = `mock-google-token:${email}:${doctorName}:google-sub-${Date.now()}:https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150`;
    handleAuth(mockToken);
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
                ? "Sign in with Google to automatically set up your isolated practice workspace."
                : "Sign in with Google to access your practice dashboard."}
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

        {/* Google Authentication Actions */}
        <div className="space-y-4">
          {/* Official Google Button Container (rendered if Client ID present) */}
          {googleClientId && isGsiLoaded ? (
            <div ref={googleButtonRef} className="w-full flex justify-center min-h-[44px]" />
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickDemoLogin("Dr. Ahmed Khan", "dr.ahmed.khan@example.com")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              )}
              <span>{mode === "register" ? "Sign up with Google" : "Sign in with Google"}</span>
            </button>
          )}

          {/* Quick Demo Selector for fast evaluation */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-600">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Quick Demo Accounts
              </span>
              <span>1-click onboarding</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin("Dr. Ahmed Khan", "dr.ahmed.khan@example.com")}
                className="text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 text-xs font-medium text-slate-700 transition-colors disabled:opacity-50"
              >
                Dr. Ahmed Khan
                <span className="block text-[10px] text-slate-500 font-normal truncate">dr-ahmed-khan</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin("Dr. Sarah Connor", "dr.sarah.connor@example.com")}
                className="text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 text-xs font-medium text-slate-700 transition-colors disabled:opacity-50"
              >
                Dr. Sarah Connor
                <span className="block text-[10px] text-slate-500 font-normal truncate">dr-sarah-connor</span>
              </button>
            </div>
          </div>
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
