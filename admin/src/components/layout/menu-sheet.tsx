"use client";

import { useTranslations } from "next-intl";
import { Drawer } from "@store/ui";
import { usePathname } from "@/i18n/navigation";
import { DesignSystemNavLink, NavLink, useShowsDesignSystem } from "@/components/layout/nav-link";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { ShopLogo } from "@/components/brand/shop-logo";
import { NAV_GROUPS } from "@/constants/nav";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import type { NavItem } from "@/types/nav";
import { activeHref } from "@/lib/nav";

interface MenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
}

export function MenuSheet({ open, onOpenChange, items }: MenuSheetProps) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const showsDesignSystem = useShowsDesignSystem();
  const active = activeHref(pathname, items);
  const close = () => onOpenChange(false);

  const groups = NAV_GROUPS.map((group) => ({
    key: group.key,
    items: group.items.flatMap((key) => items.filter((item) => item.key === key)),
    withDesignSystem: group.key === "manage" && showsDesignSystem,
  })).filter((group) => group.items.length > 0 || group.withDesignSystem);

  return (
    <Drawer
      side="start"
      size="sm"
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <ShopLogo alt={tApp("name")} className="h-9 w-auto max-w-28" />
          <EnvironmentBadge />
        </span>
      }
      descriptionKey="nav.menu"
      data-testid="sheet-nav-menu"
    >
      <nav className="-mx-2 flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.key} data-test-selector={testSelectorFor("menu-group", group.key)}>
            <h3 className="mb-1 px-3 text-micro font-medium text-ink-subtle">{t(`groups.${group.key}`)}</h3>
            <ul>
              {group.items.map((item) => (
                <NavLink
                  key={item.key}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.key)}
                  isActive={item.href === active}
                  testSelector={testSelectorFor("menu-item", item.key)}
                  onClick={close}
                  trailing={item.key === "changeRequests" ? <NavPendingBadge className="ms-auto" /> : undefined}
                />
              ))}
              {group.withDesignSystem && <DesignSystemNavLink pathname={pathname} onClick={close} />}
            </ul>
          </section>
        ))}
      </nav>
    </Drawer>
  );
}
