"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_ICON_FILL_ACTIVE, NAV_ICON_FILL_INACTIVE, PRIMARY_NAV_KEYS } from "@/constants/nav";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { MoreSheet } from "@/components/layout/more-sheet";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = items.filter((item) => PRIMARY_NAV_KEYS.includes(item.key));
  const overflowItems = items.filter((item) => !PRIMARY_NAV_KEYS.includes(item.key));

  return (
    // Height comes from --bottom-nav-height and the home-indicator padding
    // from --safe-bottom (globals.css); together they are --bottom-bar-inset,
    // which is what the page content pads by. Never hard-code a height here —
    // the two would drift and the last card would end up under the nav again.
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[var(--safe-bottom)] md:hidden"
      aria-label={tCommon("mainNavigation")}
    >
      <div className="flex h-[var(--bottom-nav-height)] items-stretch">
        {primaryItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs",
                // Solid icon + brand colour + a heavier label for the tab you
                // are on; outline + muted + regular weight for the rest. No
                // border or filled pill behind it — on a four-tab bar that
                // reads as a button someone still has to press, and it is the
                // icon that carries the difference here.
                isActive ? "font-semibold text-primary" : "font-medium text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="size-6"
                fill={isActive ? NAV_ICON_FILL_ACTIVE : NAV_ICON_FILL_INACTIVE}
                aria-hidden="true"
              />
              {t(item.key)}
            </Link>
          );
        })}
        {overflowItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
          >
            {/* Approvals live behind "More" on a phone, so the count has to
                surface on the tab itself — otherwise a request waiting on
                somebody is a screen deep and invisible. Anchored to the ICON,
                not to the tab: tab width changes with how many a role can
                see, and a badge positioned against the tab would drift onto
                the dots on some roles and off them on others. */}
            <span className="relative">
              <MoreHorizontal className="size-6" aria-hidden="true" />
              {overflowItems.some((item) => item.key === "changeRequests") && (
                <NavPendingBadge className="absolute -top-1.5 -end-2.5" />
              )}
            </span>
            {t("more")}
          </button>
        )}
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} items={overflowItems} />
    </nav>
  );
}
