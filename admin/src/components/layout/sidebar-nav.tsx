"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { useSession } from "@/components/providers/session-provider";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { DesignSystemNavLink, NavLink } from "@/components/layout/nav-link";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { ShopLogo } from "@/components/brand/shop-logo";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";
import { landingHref } from "@/lib/nav";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

export function SidebarNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const { user } = useSession();

  return (
    <aside
      className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 border-e border-line bg-rail md:block lg:w-[266px]"
      aria-label={t("common.mainNavigation")}
      data-test-selector="sidebar-nav"
    >
      <div className="flex h-full flex-col px-[18px] pt-[calc(var(--safe-top)+1.25rem)] pb-[18px]">
        <Link
          href={landingHref(user) ?? DEFAULT_LANDING_HREF}
          data-test-selector="sidebar-brand"
          className="relative mb-[22px] flex h-20 shrink-0 items-center justify-center rounded-brand border border-line bg-surface p-3"
        >
          <ShopLogo alt={t("app.name")} className="h-full max-w-full" />
          <EnvironmentBadge className="absolute top-2 end-2" />
        </Link>

        <nav className="scroll-lane -mx-[18px] min-h-0 flex-1 overflow-y-auto px-[18px]">
          <ul>
            {items.map((item) => (
              // Same name as the bottom bar's tab: one nav, two shapes.
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={t(`nav.${item.key}`)}
                isActive={pathname === item.href}
                testSelector={testSelectorFor("nav-item", item.key)}
                trailing={item.key === "changeRequests" ? <NavPendingBadge className="ms-auto" /> : undefined}
              />
            ))}
            <DesignSystemNavLink pathname={pathname} />
          </ul>
        </nav>
      </div>
    </aside>
  );
}
