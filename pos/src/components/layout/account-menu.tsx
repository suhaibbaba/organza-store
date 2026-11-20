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
import { TOP_BAR_PILL } from "@/components/layout/top-bar-pill";
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { AppVersion } from "@/components/pwa/app-version";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  className?: string;
}

// WHO IS SIGNED IN, and the way out. At every width: the POS is one screen
// with a checkout bar along the bottom, so there is no "More" sheet here to
// put a second copy in. A pill like the language beside it (top-bar-pill.ts):
// the avatar, the name, a chevron. The role and the address are the first
// thing inside the menu.
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
        className={cn(TOP_BAR_PILL, "ps-1.5", className)}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">{initial}</AvatarFallback>
        </Avatar>
        {/* Below 600px the bar has room for the avatar only; the full name is
            the first thing inside the menu either way. Capped and truncating
            so a long name never widens the bar. */}
        <span className="hidden min-w-0 max-w-40 truncate text-sm font-semibold tab:block">{name}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {/* The whole identity, where there is room for it: the name the
            trigger may have had to truncate, and the address underneath. */}
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
          {roleLabel && <span className="truncate text-xs font-normal text-muted-foreground">{roleLabel}</span>}
          {user?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          )}
        </DropdownMenuLabel>
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
