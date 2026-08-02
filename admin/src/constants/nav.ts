import { LayoutDashboard, Shirt, Boxes, FolderTree, Users, Settings } from "lucide-react";
import { ROLES } from "@shared/constants/roles";
import type { NavItem } from "@/types/nav";

// CLAUDE.md rule 5 / task spec: Users + Settings are Admin-only in the nav;
// everything else is visible to every authenticated role.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ROLES },
  { key: "products", href: "/products", icon: Shirt, roles: ROLES },
  { key: "inventory", href: "/inventory", icon: Boxes, roles: ROLES },
  { key: "categories", href: "/categories", icon: FolderTree, roles: ROLES },
  { key: "users", href: "/users", icon: Users, roles: ["ADMIN"] },
  { key: "settings", href: "/settings", icon: Settings, roles: ["ADMIN"] },
] as const;

// Bottom nav (mobile) shows these directly; everything else lives in the
// "More" sheet, reachable via one extra tap.
export const PRIMARY_NAV_KEYS: readonly string[] = ["dashboard", "products", "inventory", "categories"];
