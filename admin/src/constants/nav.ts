import { LayoutDashboard, Shirt, Boxes, FolderTree, ReceiptText, Users, Settings } from "lucide-react";
import type { NavItem } from "@/types/nav";

// CLAUDE.md rule 5 / task spec: Users + Settings are Admin-only in the nav;
// everything else is visible to every authenticated role.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, action: "dashboard.view" },
  { key: "orders", href: "/orders", icon: ReceiptText, action: "order.view" },
  { key: "products", href: "/products", icon: Shirt, action: "product.view" },
  { key: "inventory", href: "/inventory", icon: Boxes, action: "inventory.view" },
  { key: "categories", href: "/categories", icon: FolderTree, action: "category.view" },
  { key: "users", href: "/users", icon: Users, action: "user.manage" },
  { key: "settings", href: "/settings", icon: Settings, action: "settings.manage" },
] as const;

// Bottom nav (mobile) shows these directly; everything else lives in the
// "More" sheet, reachable via one extra tap. Orders earns a slot over
// Categories: incoming orders are checked many times a day, while the
// category tree is set up once and rarely revisited.
export const PRIMARY_NAV_KEYS: readonly string[] = ["dashboard", "orders", "products", "inventory"];
