import { Suspense } from "react";
import { BRAND_CONFIG } from "@/config/brand.config";
import VerifyEmailClient from "./VerifyEmailClient";

export const metadata = {
  title: BRAND_CONFIG.formatMetaTitle("Verify Practice Email"),
  description: `Verify your doctor email address and activate your workspace on ${BRAND_CONFIG.name}.`,
};

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 text-sm">Loading verification...</div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
