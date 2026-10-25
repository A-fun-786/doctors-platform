import EmailAuthForm from "@/components/auth/EmailAuthForm";
import { BRAND_CONFIG } from "@/config/brand.config";

export const metadata = {
  title: BRAND_CONFIG.formatMetaTitle("Register Practice"),
  description: `Create your verified doctor profile and provision your workspace on ${BRAND_CONFIG.name}.`,
};

export default function RegisterPage() {
  return <EmailAuthForm mode="register" />;
}
