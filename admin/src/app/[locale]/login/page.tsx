import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { AuthPage } from "@/components/auth/auth-page";
import { storeDisplayName } from "@/lib/store-name";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const storeName = await storeDisplayName();

  return (
    <AuthPage name="login" appName={storeName} title={t("title")} subtitle={t("subtitle")}>
      <LoginForm />
    </AuthPage>
  );
}
