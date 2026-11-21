"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { FIXED_ROLE } from "@organza/shared/constants/roles";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { cn } from "@/lib/utils";

// ADMIN role only, not a configurable permission: the page carries no shop data.
export const DESIGN_SYSTEM_HREF = "/design-system";
export const DESIGN_SYSTEM_NAV_SELECTOR = "nav-item-design-system";

export function useShowsDesignSystem(): boolean {
  const { user } = useSession();
  return user?.role === FIXED_ROLE;
}

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  testSelector: string;
  trailing?: ReactNode;
  onClick?: () => void;
}

export function NavLink({ href, icon: Icon, label, isActive, testSelector, trailing, onClick }: NavLinkProps) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        data-test-selector={testSelector}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "mb-0.5 flex min-h-11 cursor-pointer items-center gap-[11px] rounded-nav px-3",
          "text-label font-medium transition-[background-color,color,box-shadow] duration-150",
          isActive
            ? "nav-active-wash text-ink-inverse shadow-nav-active"
            : "text-ink-muted hover:bg-primary-100 hover:text-primary-700"
        )}
      >
        <Icon className="size-[19px] shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
        {trailing}
      </Link>
    </li>
  );
}

export function DesignSystemNavLink({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  const t = useTranslations();
  if (!useShowsDesignSystem()) return null;

  return (
    <NavLink
      href={DESIGN_SYSTEM_HREF}
      icon={Palette}
      label={t("designSystem.title")}
      isActive={pathname === DESIGN_SYSTEM_HREF}
      testSelector={DESIGN_SYSTEM_NAV_SELECTOR}
      onClick={onClick}
    />
  );
}
