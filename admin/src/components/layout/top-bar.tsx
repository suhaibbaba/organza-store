"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AccountMenu } from "@/components/layout/account-menu";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

export function TopBar() {
  const t = useTranslations();

  return (
    // pt, then a row of its own height — the same shape as the bottom nav,
    // so the bar occupies exactly --top-bar-inset and the notch is added to
    // its height rather than eating into it (CLAUDE.md "Mobile input &
    // device specifics"). Anything positioned below the bar offsets by that
    // same variable.
    <header className="sticky top-0 z-30 border-b border-border bg-background pt-[var(--safe-top)]">
      <div className="flex h-[var(--top-bar-height)] items-center justify-between px-4 md:px-6">
        {/* The shop's name, and — on the sandbox only — the chip that says so.
            gap rather than a margin on the chip, so nothing shifts on the
            live shop where the chip renders nothing. */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold md:text-lg">{t("app.name")}</span>
          <EnvironmentBadge />
        </div>

        {/* On mobile, language + logout live in the bottom nav's "More" sheet instead. */}
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher variant="dropdown" />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
