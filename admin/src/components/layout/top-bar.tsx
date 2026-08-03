"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AccountMenu } from "@/components/layout/account-menu";

export function TopBar() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:h-16 md:px-6">
      <span className="text-base font-semibold md:text-lg">{t("app.name")}</span>

      {/* On mobile, language + logout live in the bottom nav's "More" sheet instead. */}
      <div className="hidden items-center gap-3 md:flex">
        <LanguageSwitcher variant="dropdown" />
        <AccountMenu />
      </div>
    </header>
  );
}
