import EmailAuthForm from "@/components/auth/EmailAuthForm";
import { BRAND_CONFIG } from "@/config/brand.config";

export const metadata = {
  title: BRAND_CONFIG.formatMetaTitle("Doctor Login"),
  description: `Sign in to your ${BRAND_CONFIG.name} doctor portal and practice dashboard.`,
};

export default function LoginPage() {
  return <EmailAuthForm mode="login" />;
}
