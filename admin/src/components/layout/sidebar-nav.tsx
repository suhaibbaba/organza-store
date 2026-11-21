"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { useSession } from "@/components/providers/session-provider";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { DesignSystemNavLink, NavLink } from "@/components/layout/nav-link";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { ShopLogo } from "@/components/brand/shop-logo";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";
import { activeHref, landingHref } from "@/lib/nav";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

export function SidebarNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const { user } = useSession();
  const active = activeHref(pathname, items);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 border-e border-rail-line bg-rail transition-[width] duration-300 ease-glide md:block",
        collapsed ? "w-20" : "w-60 lg:w-[266px]"
      )}
      aria-label={t("common.mainNavigation")}
      data-test-selector="sidebar-nav"
      data-state={collapsed ? "collapsed" : "expanded"}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
        aria-expanded={!collapsed}
        data-test-selector="sidebar-toggle"
        className="absolute top-1/2 -end-3 z-10 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill bg-rail-active text-ink-inverse shadow-card ring-2 ring-canvas transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-primary-300"
      >
        <ChevronLeft
          className={cn("size-3.5 transition-transform duration-300 ease-glide", collapsed ? "ltr:rotate-180" : "rtl:rotate-180")}
          aria-hidden="true"
        />
      </button>

      <div
        className={cn(
          "flex h-full flex-col pt-[calc(var(--safe-top)+1.25rem)] pb-[18px]",
          "overflow-hidden px-[18px]"
        )}
      >
        <Link
          href={landingHref(user) ?? DEFAULT_LANDING_HREF}
          data-test-selector="sidebar-brand"
          className={cn(
            "mb-[22px] flex shrink-0 items-center gap-3 border-b border-rail-line pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
            "h-20 justify-between"
          )}
        >
          <ShopLogo
            alt={t("app.name")}
            className={cn(
              "shrink-0 rounded-panel transition-[height] duration-300 ease-glide",
              collapsed ? "h-11" : "h-16"
            )}
          />
          <EnvironmentBadge
            className={cn("shrink-0 transition-opacity duration-200", collapsed && "pointer-events-none opacity-0")}
          />
        </Link>

        <nav className="scroll-lane -mx-[18px] min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[18px]">
          <ul>
            {items.map((item) => (
              // Same name as the bottom bar's tab: one nav, two shapes.
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={t(`nav.${item.key}`)}
                isActive={item.href === active}
                testSelector={testSelectorFor("nav-item", item.key)}
                onRail
                collapsed={collapsed}
                trailing={item.key === "changeRequests" ? <NavPendingBadge className="ms-auto" /> : undefined}
              />
            ))}
            <DesignSystemNavLink pathname={pathname} onRail collapsed={collapsed} />
          </ul>
        </nav>
      </div>
    </aside>
  );
}
