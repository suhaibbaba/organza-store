import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

// "Email me a link." Public, for the obvious reason: somebody who cannot sign
// in cannot sign in to ask.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");
  const tApp = await getTranslations("app");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <LanguageSwitcher />

      <div className="w-full max-w-sm">
        <p className="mb-1 text-center text-2xl font-semibold text-primary">{tApp("name")}</p>
        <p className="mb-6 text-center text-sm text-muted-foreground">{tApp("tagline")}</p>

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
