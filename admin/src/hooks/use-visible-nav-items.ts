import { useMemo } from "react";
import { can } from "@store/shared/lib/permissions";
import { NAV_ITEMS } from "@/constants/nav";
import { useSession } from "@/components/providers/session-provider";
import type { NavItem } from "@/types/nav";

// Rule 5: the backend enforces roles; this only decides what the nav shows.
export function useVisibleNavItems(): NavItem[] {
  const { user } = useSession();
  return useMemo(() => NAV_ITEMS.filter((item) => can(user, item.action)), [user]);
}
