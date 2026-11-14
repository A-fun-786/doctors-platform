import { Suspense } from "react";
import { BRAND_CONFIG } from "@/config/brand.config";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata = {
  title: BRAND_CONFIG.formatMetaTitle("Reset Password"),
  description: `Choose a new secure password for your ${BRAND_CONFIG.name} doctor account.`,
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 text-sm">Loading password reset...</div>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
