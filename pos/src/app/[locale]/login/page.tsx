import { getTranslations } from "next-intl/server";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <AuthPageFrame title={t("title")} subtitle={t("subtitle")} showEnvironment>
      <LoginForm />
    </AuthPageFrame>
  );
}
