"use client";

import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/layout/account-menu";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

// The POS is a single screen, so there is no navigation to speak of — this
// bar exists to say who is signed in (every sale is attributed to them in
// the audit log) and to give a way into that account's own settings, the
// language among them. It stays reachable on a phone, since the bottom of
// the screen belongs to the checkout bar.
export function TopBar() {
  const t = useTranslations();

  return (
    // pt, then a row of its own height — the same shape as the bottom bars,
    // so the bar occupies exactly --top-bar-inset and the notch is added to
    // its height rather than eating into it (CLAUDE.md "Mobile input &
    // device specifics").
    <header
      className="sticky top-0 z-30 border-b border-border bg-background pt-[var(--safe-top)]"
      data-test-selector="pos-top-bar"
    >
      {/* Three things share this row and none of them may ever be drawn over
          another: which shop, which copy of it, and who is signed in.

          There were four, and on a phone the fourth had already cost the
          language control its label — a bare icon in the corner of a till
          used by people who are not tech-savvy. The language moved into the
          account menu (account-menu.tsx), which is where a cashier's own
          settings belong and which had the room.

          Nothing here is unshrinkable even so. This row used to be
          `justify-between` with a `shrink-0` control group, which is fine
          until the content is wider than the phone — and then the free space
          goes NEGATIVE and the two groups are laid out on top of each other,
          which is how the sandbox chip ended up sitting over the switcher's
          icon. So the identity gives way first (its name truncates), and if
          that is not enough the account's own label does too, instead of the
          row overflowing and colliding. */}
      <div className="flex h-[var(--top-bar-height)] items-center gap-2 px-3 md:px-6">
        {/* The shop's name, and — on the sandbox only — the chip that says so.
            `flex-1` so this is what yields when the row is tight, and the chip
            is `shrink-0` inside it: the NAME is what gives way, never the
            warning that says which database you are about to sell from.
            gap rather than a margin on the chip, so nothing shifts on the
            live shop where the chip renders nothing. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-base font-semibold md:text-lg">{t("app.name")}</span>
          <EnvironmentBadge />
        </div>

        <AccountMenu />
      </div>
    </header>
  );
}
