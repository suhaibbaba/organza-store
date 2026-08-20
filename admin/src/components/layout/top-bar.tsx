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

        {/* WHO IS SIGNED IN, on every screen and at every width.

            This used to be `hidden md:flex` — desktop only — with the mobile
            half deferred to the bottom nav's "More" sheet. Two things were
            wrong with that. The sheet carries sign-out and the language but
            has never carried a NAME, so on a phone (which is 95% of the use)
            the only place anybody's own name appeared was the dashboard's
            "welcome back" — and the dashboard is Admin/Manager only, so an
            Employee had no way to see which account they were working under.
            A cashier who cannot tell whose name every order is being filed
            under has lost something basic, and they lost it because of a page
            they were never meant to open.

            And the sheet itself is not guaranteed: the "More" tab only exists
            when a role has nav items that do not fit the four primary tabs
            (components/layout/bottom-nav.tsx). Permissions are editable per
            shop now (spec.md "Editable role permissions"), so a role trimmed
            to four screens would have no sheet — and with it no sign-out at
            all. Identity belongs to the shell, not to whichever pages a role
            happens to hold.

            Laid out exactly as the POS's bar, which has always done this. */}
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <LanguageSwitcher variant="dropdown" />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
