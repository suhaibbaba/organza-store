"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { AppVersion } from "@/components/pwa/app-version";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  className?: string;
}

// WHO IS SIGNED IN — in the app shell's header, at every width, for every
// role. Not desktop-only, and not on any page: an Employee cannot open the
// dashboard, and the dashboard's greeting was the only other place a name
// appeared (see the note in top-bar.tsx for the whole of that bug).
//
// A deliberate mirror of the POS's own components/layout/account-menu.tsx —
// same shape, same behaviour, same words — because the same person moves
// between the two apps on the same phone within the same minute. The half
// that must never drift is the naming RULE, and that one is genuinely shared:
// both apps resolve a person's name through @organza/shared/lib/userDisplay
// (via each app's lib/user-display.ts, which adds the translated role). The
// markup is duplicated because it is built entirely from per-app pieces — the
// Radix wrappers, the session provider, the message catalogue — and a shared
// component taking all of those as parameters would be more indirection than
// the twenty lines it saved.
//
// It is also where the LANGUAGE lives, since the header had four things in a
// row and space for three (see the note in language-switcher.tsx). A person's
// own name, their way out and the language they read the app in are the same
// kind of thing — this account, these preferences — so they belong behind the
// same button rather than beside each other in a bar that keeps running out
// of width.
//
// The menu is built in GROUPS for that reason: identity, then preferences,
// then the way out, then the build. Anything added later joins one of those
// or starts a fourth WITH A HEADING — a menu that grows by appending loose
// items is how it stops being readable.
export function AccountMenu({ className }: AccountMenuProps) {
  const t = useTranslations("common");
  const { user, logout } = useSession();

  // Their name, or their address, or their role — never an internal id
  // (lib/user-display.ts). The letter comes from the same source as the name,
  // so the circle and the word beside it always agree.
  const { name, initial, roleLabel } = useUserDisplay()(user);

  // The role is worth saying out loud, but not twice: for somebody with
  // neither a name nor an address it IS the name above, and a menu reading
  // "Employee / Employee" says less than one that reads it once.
  const showRole = Boolean(roleLabel) && roleLabel !== name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account")}
        data-test-selector="account-menu"
        className={cn(
          "group flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-input px-2 text-sm font-medium text-foreground",
          "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "data-[state=open]:bg-accent",
          className
        )}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        {/* Capped AND truncating, both on purpose. The cap keeps a long name
            from stretching the header out of shape; the truncation is what
            stops the bar overflowing when even the cap is too much for the
            width, which is how the sandbox chip once ended up painted over
            the control beside it.
            Wider than it was: this is the only control left in the row now
            that the language has moved inside the menu, so the ~110px that
            control used to take goes to the name it was crowding. */}
        <span className="min-w-0 max-w-32 truncate sm:max-w-48">{name}</span>
        {/* data-state lives on the trigger, so the arrow flips via the group. */}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {/* The whole identity, where there is room for it: the name the
            trigger may have had to truncate, then what this account IS in the
            shop, then the address it signs in with.

            The role is here because the app looks different depending on it —
            an Employee has no dashboard, no reports and no totals — and
            "where has the money gone" is answered far faster by a line saying
            which account is signed in than by anybody guessing. */}
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
          {showRole && (
            <span className="truncate text-xs font-normal text-muted-foreground">{roleLabel}</span>
          )}
          {user?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* PREFERENCES. One entry today, and it is here rather than in the
            header because a bar with the shop's name, the sandbox chip, the
            language and the account in it had already squeezed the language
            down to an unlabelled icon.

            Laid out flat rather than behind a submenu: this is two taps from
            anywhere — open the menu, pick the language — and the one in use is
            ticked, so "which language am I in" is answered by looking rather
            than by opening something. */}
        <LanguageSwitcher variant="menu" />

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void logout()}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t("logout")}
        </DropdownMenuItem>
        {/* Last, and quiet: which build this browser is running, for when
            someone reports that something looks wrong. Not a menu item —
            tapping it copies rather than navigating, so it must not close the
            menu the way a DropdownMenuItem would. The mobile half of this
            menu is the "More" sheet, which carries the same line. */}
        <DropdownMenuSeparator />
        <div className="px-1 pb-1">
          <AppVersion />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
