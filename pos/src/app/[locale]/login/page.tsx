import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <LoginForm />
    </AuthLayout>
  );
}
