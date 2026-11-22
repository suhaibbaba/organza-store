import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthPage } from "@/components/auth/auth-page";

// "Email me a link." Public, for the obvious reason.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");

  return (
    <AuthPage name="forgot-password" title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
