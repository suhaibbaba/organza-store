import { can, type PermissionSubject } from "@organza/shared/lib/permissions";
import { NAV_ITEMS } from "@/constants/nav";

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
