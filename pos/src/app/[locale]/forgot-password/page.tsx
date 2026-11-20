import { getTranslations } from "next-intl/server";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

// "Email me a link." Public, for the obvious reason: somebody who cannot sign
// in cannot sign in to ask.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");

  return (
    <AuthPageFrame title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthPageFrame>
  );
}
