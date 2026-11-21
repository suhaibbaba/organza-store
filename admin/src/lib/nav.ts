import { can, type PermissionSubject } from "@organza/shared/lib/permissions";
import { NAV_ITEMS } from "@/constants/nav";
import type { NavItem } from "@/types/nav";

// Where to send someone who lands on a screen they may not see. It used to be
// "/dashboard" for everybody, but the dashboard is now Admin/Manager only, so
// bouncing an Employee there would just bounce them again. Taking the first
// nav entry they actually hold the permission for keeps the answer in one
// place: the nav order already says what matters most (dashboard, then
// orders, ...), so an Admin/Manager still lands on the dashboard and an
// Employee lands on Orders. Returns null when a user can see nothing at all —
// callers must not redirect then, or they'd loop.
export function landingHref(user: PermissionSubject | null | undefined): string | null {
  return NAV_ITEMS.find((item) => can(user, item.action))?.href ?? null;
}

// The deepest matching href wins, so /orders/collection lights Collection and not Orders as well.
export function activeHref(pathname: string, items: readonly NavItem[]): string | undefined {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
