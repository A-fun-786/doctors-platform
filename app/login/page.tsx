import GoogleAuthForm from "@/components/auth/GoogleAuthForm";

export const metadata = {
  title: "Doctor Login - DocSpace",
  description: "Sign in to your DocSpace doctor portal and practice dashboard.",
};

export default function LoginPage() {
  return <GoogleAuthForm mode="login" />;
}
