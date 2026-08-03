import { LayoutDashboard, Shirt, Boxes, FolderTree, Users, Settings } from "lucide-react";
import type { NavItem } from "@/types/nav";

// CLAUDE.md rule 5 / task spec: Users + Settings are Admin-only in the nav;
// everything else is visible to every authenticated role.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, action: "dashboard.view" },
  { key: "products", href: "/products", icon: Shirt, action: "product.view" },
  { key: "inventory", href: "/inventory", icon: Boxes, action: "inventory.view" },
  { key: "categories", href: "/categories", icon: FolderTree, action: "category.view" },
  { key: "users", href: "/users", icon: Users, action: "user.manage" },
  { key: "settings", href: "/settings", icon: Settings, action: "settings.manage" },
] as const;

// Bottom nav (mobile) shows these directly; everything else lives in the
// "More" sheet, reachable via one extra tap.
export const PRIMARY_NAV_KEYS: readonly string[] = ["dashboard", "products", "inventory", "categories"];
