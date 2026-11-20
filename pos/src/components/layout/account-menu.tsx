"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
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

// WHO IS SIGNED IN, and the two things that belong to them — the language
// they read the till in, and the way out. At every width: the POS is one
// screen with a checkout bar along the bottom, so there is no "More" sheet
// here to put a second copy in, and this menu is the only place either lives.
//
// The language moved in from the header, where the shop's name, the sandbox
// chip, the language and the account had been sharing one row and the
// language had already given up its label to fit (see the note in
// language-switcher.tsx). A cashier changing the till's language is changing
// their own setting, so it sits with their name rather than beside it.
//
// Built in GROUPS — identity, preferences, the way out, the build — and a
// mirror of the admin's own components/layout/account-menu.tsx, because the
// same person moves between the two apps on the same phone within the same
// minute. Anything added later joins one of those groups or starts a fourth
// with a heading of its own.
export function AccountMenu({ className }: AccountMenuProps) {
  const t = useTranslations("common");
  const { user, logout } = useSession();

  // Their name, or their address, or their role — never an internal id
  // (lib/user-display.ts). The letter comes from the same source as the name,
  // so the circle and the word beside it always agree.
  const { name, initial } = useUserDisplay()(user);
  const tRole = useTranslations("common.role");
  const roleLabel = user?.role ? tRole(user.role) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account")}
        data-test-selector="pos-account-menu"
        className={cn(
          "group flex min-h-11 min-w-0 items-center gap-2 rounded-control px-1 text-start text-foreground",
          "transition-colors hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "data-[state=open]:bg-soft",
          className
        )}
      >
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-pale text-base font-bold text-pale-foreground">{initial}</AvatarFallback>
        </Avatar>
        {/* Name over role, as the design draws it. Below 600px the bar has
            room for the avatar only (the brief's phone layout); the full name
            and the address are the first thing inside the menu either way.
            Capped and truncating so a long name never widens the bar. */}
        <span className="hidden min-w-0 max-w-40 flex-col tab:flex">
          <span className="truncate text-sm font-bold">{name}</span>
          {roleLabel && <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {/* The whole identity, where there is room for it: the name the
            trigger may have had to truncate, and the address underneath. */}
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
          {user?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* PREFERENCES. Flat rather than behind a submenu: two taps from the
            sale screen — open the menu, pick the language — and the one in use
            is ticked, so a cashier handed the phone mid-shift can see which
            language it is in without opening anything further. */}
        <LanguageSwitcher variant="menu" />

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void logout()}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t("logout")}
        </DropdownMenuItem>
        {/* Last, and quiet: this is the one place a cashier can find out which
            build their phone is running when they call about a problem. Not a
            menu item — tapping it copies rather than navigating, so it must
            not close the menu the way a DropdownMenuItem would. */}
        <DropdownMenuSeparator />
        <div className="px-1 pb-1">
          <AppVersion />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
