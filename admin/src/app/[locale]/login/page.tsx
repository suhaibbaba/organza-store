import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { AuthPage } from "@/components/auth/auth-page";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <AuthPage name="login" title={t("title")} subtitle={t("subtitle")}>
      <LoginForm />
    </AuthPage>
  );
}
