import GoogleAuthForm from "@/components/auth/GoogleAuthForm";

export const metadata = {
  title: "Register Practice - DocSpace",
  description: "Create your verified doctor profile and provision your workspace on DocSpace.",
};

export default function RegisterPage() {
  return <GoogleAuthForm mode="register" />;
}
