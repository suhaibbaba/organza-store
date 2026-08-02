import { useMemo } from "react";
import { NAV_ITEMS } from "@/constants/nav";
import { useSession } from "@/components/providers/session-provider";
import type { NavItem } from "@/types/nav";

// CLAUDE.md rule 5: role gating is enforced on the backend; this only
// decides what the nav shows, never what a page is allowed to do.
export function useVisibleNavItems(): NavItem[] {
  const { user } = useSession();
  return useMemo(() => NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)), [user]);
}
