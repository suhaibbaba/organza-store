"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { PRIMARY_NAV_KEYS, type PrimaryNavKey } from "@/constants/nav";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { SOLID_NAV_ICONS } from "@/components/icons/nav-solid-icons";
import { MoreSheet } from "@/components/layout/more-sheet";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/nav";

function isPrimary(item: NavItem): item is NavItem & { key: PrimaryNavKey } {
  return (PRIMARY_NAV_KEYS as readonly string[]).includes(item.key);
}

export function BottomNav() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = items.filter(isPrimary);
  const overflowItems = items.filter((item) => !isPrimary(item));

  return (
    // Height comes from --bottom-nav-height and the home-indicator padding
    // from --safe-bottom (globals.css); together they are --bottom-bar-inset,
    // which is what the page content pads by. Never hard-code a height here —
    // the two would drift and the last card would end up under the nav again.
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[var(--safe-bottom)] md:hidden"
      aria-label={tCommon("mainNavigation")}
      data-test-selector="bottom-nav"
    >
      <div className="flex h-[var(--bottom-nav-height)] items-stretch">
        {primaryItems.map((item) => {
          const isActive = pathname === item.href;
          // Two glyphs, not one glyph filled in: the outline for the tabs you
          // are not on, a drawn solid twin for the one you are (see
          // components/icons/nav-solid-icons.tsx for why filling the outline
          // is not an option).
          const Icon = isActive ? SOLID_NAV_ICONS[item.key] : item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              // Named by WHERE it goes, never by where it sits: the bar
              // mirrors itself in Arabic, so "the second one from the left"
              // is a different tab depending on the language.
              data-test-selector={testSelectorFor("nav-item", item.key)}
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
              <Icon className="size-6" aria-hidden="true" />
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
            {/* "More" opens a sheet rather than being a page, so it is never
                the tab you are ON and has no solid state to go to — and its
                glyph is three dots, which read the same filled or not, so
                there is nothing here that could blob either way.

                Approvals live behind "More" on a phone, so the count has to
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
