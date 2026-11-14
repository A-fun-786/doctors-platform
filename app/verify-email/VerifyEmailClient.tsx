"use client";

import { useSearchParams } from "next/navigation";
import EmailAuthForm from "@/components/auth/EmailAuthForm";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("code") || "";
  const email = searchParams.get("email") || "";

  return (
    <EmailAuthForm
      mode="verify"
      initialEmail={email}
      initialToken={token}
    />
  );
}
