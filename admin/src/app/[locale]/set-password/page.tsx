import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Spinner } from "@/components/ui/spinner";

// Where the "set your password" / "reset your password" email lands. Public —
// somebody with no password cannot sign in to reach it (see proxy.ts).
//
// The heading is the SET wording rather than the RESET one: the two differ
// only in tone, and which link this is is not known until the token has been
// checked on the client. Saying "choose your password" covers both honestly.
export default async function SetPasswordPage() {
  const t = await getTranslations("auth.setPassword");
  const tApp = await getTranslations("app");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <LanguageSwitcher />

      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-2xl font-semibold text-primary">{tApp("name")}</p>

        <Card>
          <CardHeader>
            <CardTitle>{t("titleSet")}</CardTitle>
            <CardDescription>{t("subtitleSet")}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* The form reads the token from the query string, which makes it
                a client component that has to sit under Suspense. */}
            <Suspense fallback={<Spinner />}>
              <SetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
