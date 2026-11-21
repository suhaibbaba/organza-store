import { can, type PermissionSubject } from "@store/shared/lib/permissions";
import { NAV_ITEMS } from "@/constants/nav";
import type { NavItem } from "@/types/nav";

// The first nav entry the user may see; null when none, and callers must not redirect then, or they loop.
export function landingHref(user: PermissionSubject | null | undefined): string | null {
  return NAV_ITEMS.find((item) => can(user, item.action))?.href ?? null;
}

// The deepest matching href wins, so /orders/collection lights Collection and not Orders as well.
export function activeHref(pathname: string, items: readonly NavItem[]): string | undefined {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
