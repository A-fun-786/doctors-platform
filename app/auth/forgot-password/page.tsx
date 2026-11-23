import { Suspense } from "react";
import { BRAND_CONFIG } from "@/config/brand.config";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const metadata = {
  title: BRAND_CONFIG.formatMetaTitle("Forgot Password"),
  description: `Reset your ${BRAND_CONFIG.name} doctor account password securely.`,
};

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 text-sm">Loading password reset...</div>
        </div>
      }
    >
      <ForgotPasswordClient />
    </Suspense>
  );
}
