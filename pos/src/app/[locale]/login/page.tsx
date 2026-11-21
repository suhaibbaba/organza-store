import { getTranslations } from "next-intl/server";
import { Card } from "@store/ui/components/card";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { storeDisplayName } from "@/lib/store-name";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const tApp = await getTranslations("app");
  const storeName = await storeDisplayName();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
      <LanguageSwitcher />

      <div className="w-full max-w-sm">
        {/* Which stack is being signed into, before the password is typed. */}
        <div className="mb-1 flex items-center justify-center gap-2">
          <p className="text-2xl font-semibold text-primary-600">{storeName}</p>
          <EnvironmentBadge />
        </div>
        <p className="mb-6 text-center text-label text-ink-muted">{tApp("tagline")}</p>

        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-heading font-semibold text-ink">{t("title")}</h1>
            <p className="text-label text-ink-muted">{t("subtitle")}</p>
          </div>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
