"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AccountMenu } from "@/components/layout/account-menu";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

// The POS is a single screen, so there is no navigation to speak of — this
// bar exists to say who is signed in (every sale is attributed to them in
// the audit log) and to hold the language switch. Both stay reachable on a
// phone, since the bottom of the screen belongs to the checkout bar.
export function TopBar() {
  const t = useTranslations();

  return (
    // pt, then a row of its own height — the same shape as the bottom bars,
    // so the bar occupies exactly --top-bar-inset and the notch is added to
    // its height rather than eating into it (CLAUDE.md "Mobile input &
    // device specifics").
    <header className="sticky top-0 z-30 border-b border-border bg-background pt-[var(--safe-top)]">
      <div className="flex h-[var(--top-bar-height)] items-center justify-between gap-2 px-3 md:px-6">
        {/* The shop's name, and — on the sandbox only — the chip that says so.
            gap rather than a margin on the chip, so nothing shifts on the
            live shop where the chip renders nothing. */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold md:text-lg">{t("app.name")}</span>
          <EnvironmentBadge />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher variant="dropdown" />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
