"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useSession } from "@/components/providers/session-provider";
import { AppVersion } from "@/components/pwa/app-version";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import type { NavItem } from "@/types/nav";
import { cn } from "@/lib/utils";

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
}

export function MoreSheet({ open, onOpenChange, items }: MoreSheetProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { logout } = useSession();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t("more")}</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3">
          {items.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium",
                  isActive ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-accent"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(item.key)}
                {item.key === "changeRequests" && <NavPendingBadge className="ms-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-3">
          <Separator />
          <LanguageSwitcher className="px-1" />
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              void logout();
            }}
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-5" aria-hidden="true" />
            {tCommon("logout")}
          </button>
          {/* Which build this phone is running. Installed from a home screen
              there is nowhere else to find it, and this sheet is where the
              95% who are on a phone already come for everything else. */}
          <AppVersion className="px-1" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
