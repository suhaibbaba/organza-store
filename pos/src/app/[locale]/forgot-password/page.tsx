import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthLayout } from "@/components/auth/auth-layout";

// Public: somebody who cannot sign in cannot sign in to ask for a link.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");
  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
