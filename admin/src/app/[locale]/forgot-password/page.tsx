import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthPage } from "@/components/auth/auth-page";
import { storeDisplayName } from "@/lib/store-name";

// "Email me a link." Public, for the obvious reason.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");
  const storeName = await storeDisplayName();

  return (
    <AuthPage name="forgot-password" appName={storeName} title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
