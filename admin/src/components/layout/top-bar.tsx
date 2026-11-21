"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { ShopLogo } from "@/components/brand/shop-logo";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";
import { landingHref } from "@/lib/nav";
import { MenuSheet } from "@/components/layout/menu-sheet";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { GlobalSearch } from "@/components/layout/global-search";

// Menu, shop logo and sandbox chip (phones only; the sidebar carries them from md), then the language and the account, for every role at every width.
export function TopBar() {
  const t = useTranslations();
  const { user } = useSession();
  const items = useVisibleNavItems();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-surface pt-[var(--safe-top)] md:border-b-0 md:bg-canvas"
      data-test-selector="top-bar"
    >
      <div className="h-[var(--top-bar-height)] px-4 md:px-6 md:pt-3">
        <div className="flex h-full items-center gap-2 md:rounded-field md:border md:border-line md:bg-surface md:px-3 md:shadow-card">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("nav.openMenu")}
              data-test-selector="top-bar-menu"
              className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink transition-colors hover:bg-inset hover:text-primary-700 focus-visible:bg-neutral-200 focus-visible:text-primary-800 md:hidden"
            >
              <Menu className="size-6" aria-hidden="true" />
              {items.some((item) => item.key === "changeRequests") && (
                <NavPendingBadge className="absolute -top-0.5 -end-0.5" />
              )}
            </button>
            <Link
              href={landingHref(user) ?? DEFAULT_LANDING_HREF}
              data-test-selector="top-bar-brand"
              className="flex h-10 shrink-0 items-center rounded-control focus-darken md:hidden"
            >
              <ShopLogo className="h-full w-auto max-w-32" />
            </Link>
            <EnvironmentBadge className="md:hidden" />
          </div>
          <div className="flex shrink-0 justify-center md:min-w-0 md:flex-1">
            <GlobalSearch />
          </div>
          <LanguageSwitcher variant="pill" />
          <AccountMenu />
        </div>
      </div>
      <MenuSheet open={menuOpen} onOpenChange={setMenuOpen} items={items} />
    </header>
  );
}
