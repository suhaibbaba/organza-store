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
    <header
      className="sticky top-0 z-30 border-b border-border bg-background pt-[var(--safe-top)]"
      data-test-selector="top-bar"
    >
      {/* Laid out the same way as the POS's bar, and for the same reason:
          nothing in this row is unshrinkable, so the sandbox chip can never
          be drawn over the language switcher when the content outgrows the
          width. The admin reaches that point later than the POS — its
          controls are hidden below `md` — but "later" is not "never", and one
          narrow desktop window would have found it. */}
      <div className="flex h-[var(--top-bar-height)] items-center gap-2 px-4 md:px-6">
        {/* The shop's name, and — on the sandbox only — the chip that says so.
            `flex-1` so the name is what yields when the row is tight, and the
            chip is `shrink-0` inside it: the warning that says which database
            you are looking at never gives way.
            gap rather than a margin on the chip, so nothing shifts on the
            live shop where the chip renders nothing. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-base font-semibold md:text-lg">{t("app.name")}</span>
          <EnvironmentBadge />
        </div>

        {/* On mobile, language + logout live in the bottom nav's "More" sheet instead. */}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <LanguageSwitcher variant="dropdown" />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
