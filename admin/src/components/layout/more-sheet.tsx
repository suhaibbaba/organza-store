"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Drawer } from "@store/ui";
import { usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { DesignSystemNavLink, NavLink } from "@/components/layout/nav-link";
import { useSession } from "@/components/providers/session-provider";
import { AppVersion } from "@/components/pwa/app-version";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import type { NavItem } from "@/types/nav";

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
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t("more")} descriptionKey="nav.more" data-testid="sheet-more-menu">
      <div className="flex min-h-full flex-col gap-4">
        <nav>
          <ul>
            {items.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={t(item.key)}
                isActive={pathname === item.href}
                testSelector={testSelectorFor("more-item", item.key)}
                onClick={close}
                trailing={item.key === "changeRequests" ? <NavPendingBadge className="ms-auto" /> : undefined}
              />
            ))}
            <DesignSystemNavLink pathname={pathname} onClick={close} />
          </ul>
        </nav>

        {/* Language and sign-out repeated from the account menu: a full-width row is an easier thumb target on a phone. */}
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          <LanguageSwitcher className="px-1" />
          <button
            type="button"
            data-test-selector="more-logout"
            onClick={() => {
              close();
              void logout();
            }}
            className="flex min-h-11 items-center gap-[11px] rounded-nav px-3 text-label font-medium text-danger-700 transition-colors hover:bg-danger-50"
          >
            <LogOut className="size-[19px]" aria-hidden="true" />
            {tCommon("logout")}
          </button>
          <AppVersion className="px-1" />
        </div>
      </div>
    </Drawer>
  );
}
