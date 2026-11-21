"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { PRIMARY_NAV_KEYS, type PrimaryNavKey } from "@/constants/nav";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { SOLID_NAV_ICONS } from "@/components/icons/nav-solid-icons";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";
import { activeHref } from "@/lib/nav";
import type { NavItem } from "@/types/nav";

function isPrimary(item: NavItem): item is NavItem & { key: PrimaryNavKey } {
  return (PRIMARY_NAV_KEYS as readonly string[]).includes(item.key);
}

export function BottomNav() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const items = useVisibleNavItems();

  const primaryItems = items.filter(isPrimary);
  const active = activeHref(pathname, items);

  return (
    // Sized from --bottom-nav-height + --safe-bottom (= --bottom-bar-inset, what the page pads by); never hard-code it.
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[var(--safe-bottom)] md:hidden"
      aria-label={tCommon("mainNavigation")}
      data-test-selector="bottom-nav"
    >
      <div className="flex h-[var(--bottom-nav-height)] items-stretch">
        {primaryItems.map((item) => {
          const isActive = item.href === active;
          // Outline icon for the other tabs, a drawn solid twin for the current one.
          const Icon = isActive ? SOLID_NAV_ICONS[item.key] : item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              data-test-selector={testSelectorFor("nav-item", item.key)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-micro focus-visible:bg-primary-100 focus-visible:text-primary-800",
                isActive ? "font-semibold text-primary-600" : "font-medium text-ink-muted"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-6" aria-hidden="true" />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
