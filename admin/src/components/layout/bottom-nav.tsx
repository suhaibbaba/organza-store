"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { PRIMARY_NAV_KEYS } from "@/constants/nav";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { MoreSheet } from "@/components/layout/more-sheet";
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
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-6" aria-hidden="true" />
              {t(item.key)}
            </Link>
          );
        })}
        {overflowItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
          >
            <MoreHorizontal className="size-6" aria-hidden="true" />
            {t("more")}
          </button>
        )}
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} items={overflowItems} />
    </nav>
  );
}
