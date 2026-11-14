"use client";

import { useSearchParams } from "next/navigation";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  return <ForgotPasswordForm initialEmail={email} />;
}
