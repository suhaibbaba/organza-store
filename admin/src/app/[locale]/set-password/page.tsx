import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Loader2 } from "lucide-react";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { AuthPage } from "@/components/auth/auth-page";

// Public landing for the emailed link; the SET wording covers reset too, since which link it is is only known client-side.
export default async function SetPasswordPage() {
  const t = await getTranslations("auth.setPassword");

  return (
    <AuthPage name="set-password" title={t("titleSet")} subtitle={t("subtitleSet")}>
      {/* The form reads the token from the query string, so it sits under Suspense. */}
      <Suspense fallback={<Loader2 className="mx-auto size-5 animate-spin text-ink-muted" aria-hidden="true" />}>
        <SetPasswordForm />
      </Suspense>
    </AuthPage>
  );
}
