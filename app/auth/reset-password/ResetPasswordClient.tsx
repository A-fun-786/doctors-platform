"use client";

import { useSearchParams } from "next/navigation";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const code = searchParams.get("code") || "";
  const email = searchParams.get("email") || "";

  return (
    <ResetPasswordForm
      initialToken={token}
      initialCode={code}
      initialEmail={email}
    />
  );
}
