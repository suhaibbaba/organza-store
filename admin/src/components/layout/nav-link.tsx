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
  onRail?: boolean;
  collapsed?: boolean;
}

export function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
  testSelector,
  trailing,
  onClick,
  onRail = false,
  collapsed = false,
}: NavLinkProps) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        data-test-selector={testSelector}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "relative mb-0.5 flex min-h-11 cursor-pointer items-center gap-[11px] rounded-nav px-3",
          "text-label font-medium transition-[background-color,color,box-shadow] duration-150",
          isActive
            ? "nav-active-wash text-ink-inverse shadow-nav-active"
            : onRail
              ? "text-rail-ink hover:bg-rail-hover hover:text-rail-hover-ink"
              : "text-ink-muted hover:bg-primary-100 hover:text-primary-700"
        )}
      >
        <Icon className="size-[19px] shrink-0" aria-hidden="true" />
        <span className={cn("truncate whitespace-nowrap transition-opacity duration-200", collapsed && "opacity-0")}>
          {label}
        </span>
        {trailing && (collapsed ? <span className="absolute -top-1 end-0.5">{trailing}</span> : trailing)}
      </Link>
    </li>
  );
}

export function DesignSystemNavLink({
  pathname,
  onClick,
  onRail,
  collapsed,
}: {
  pathname: string;
  onClick?: () => void;
  onRail?: boolean;
  collapsed?: boolean;
}) {
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
      onRail={onRail}
      collapsed={collapsed}
    />
  );
}
