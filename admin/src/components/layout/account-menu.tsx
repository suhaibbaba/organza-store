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

  const initials = user?.name ? user.name.trim().slice(0, 1).toUpperCase() : "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account")}
        className={cn(
          "group flex min-h-11 items-center gap-2 rounded-md border border-input px-2 text-sm font-medium text-foreground",
          "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "data-[state=open]:bg-accent",
          className
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="max-w-40 truncate">{user?.name}</span>
        {/* data-state lives on the trigger, so the arrow flips via the group. */}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
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
