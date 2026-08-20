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
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { AppVersion } from "@/components/pwa/app-version";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  className?: string;
}

// Desktop header only — on mobile the same actions live in the bottom nav's
// "More" sheet, where a nested popup inside an open sheet would be awkward.
// Mirrors LanguageSwitcher's dropdown variant (same trigger shape, same
// animated Radix content) so the two sit together consistently in the header.
export function AccountMenu({ className }: AccountMenuProps) {
  const t = useTranslations("common");
  const { user, logout } = useSession();

  // Their name, or their address, or their role — never an internal id
  // (lib/user-display.ts). The letter comes from the same source as the name,
  // so the circle and the word beside it always agree.
  const { name, initial } = useUserDisplay()(user);

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
            width, which is how the sandbox chip ended up painted over the
            language switcher. */}
        <span className="min-w-0 max-w-24 truncate sm:max-w-40">{name}</span>
        {/* data-state lives on the trigger, so the arrow flips via the group. */}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        {/* The whole identity, where there is room for it: the name the
            trigger may have had to truncate, and the address underneath. */}
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
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
