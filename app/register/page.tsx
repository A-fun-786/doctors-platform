import EmailAuthForm from "@/components/auth/EmailAuthForm";

export const metadata = {
  title: "Register Practice - DocSpace",
  description: "Create your verified doctor profile and provision your workspace on DocSpace.",
};

export default function RegisterPage() {
  return <EmailAuthForm mode="register" />;
}
