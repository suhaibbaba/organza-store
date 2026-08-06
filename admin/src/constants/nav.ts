import {
  LayoutDashboard,
  Shirt,
  Boxes,
  Barcode,
  FolderTree,
  ReceiptText,
  HandCoins,
  ChartColumn,
  Users,
  Settings,
} from "lucide-react";
import type { NavItem } from "@/types/nav";

// CLAUDE.md rule 5 / task spec: Users + Settings are Admin-only in the nav;
// everything else is visible to every authenticated role.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, action: "dashboard.view" },
  { key: "orders", href: "/orders", icon: ReceiptText, action: "order.view" },
  // Money still with the delivery company. Gated on the permission that lets
  // someone settle it, so an Employee — who may take orders but never declare
  // their money received — doesn't see a screen they can't act on.
  { key: "collection", href: "/orders/collection", icon: HandCoins, action: "order.markCollected" },
  { key: "products", href: "/products", icon: Shirt, action: "product.view" },
  { key: "inventory", href: "/inventory", icon: Boxes, action: "inventory.view" },
  // Barcode labels. Every role can print (CLAUDE.md rule 13: a new piece
  // isn't shelf-ready until its label is on it), so it is gated on the same
  // action the backend enforces.
  { key: "labels", href: "/labels", icon: Barcode, action: "product.printLabels" },
  { key: "categories", href: "/categories", icon: FolderTree, action: "category.view" },
  // Sales & profit. Gated with order.view, the same permission the orders
  // list uses — cost and profit inside the page are gated separately, on the
  // backend, by product.viewCost (CLAUDE.md rule 19).
  { key: "reports", href: "/reports", icon: ChartColumn, action: "order.view" },
  { key: "users", href: "/users", icon: Users, action: "user.manage" },
  { key: "settings", href: "/settings", icon: Settings, action: "settings.manage" },
] as const;

// How the bottom nav says which tab you are on. Lucide ships one outline set
// and no solid twin, so "filled" is the icon's own `fill` — its real geometry
// flooded with the current colour (a lucide-supported SVG attribute, which is
// how Heart, Star and friends are filled) rather than a look faked underneath
// it with a background or a border. Outline vs solid is a difference you can
// see across a room; a tint alone is not, which is what this replaces.
export const NAV_ICON_FILL_ACTIVE = "currentColor";
export const NAV_ICON_FILL_INACTIVE = "none";

// Bottom nav (mobile) shows these directly; everything else lives in the
// "More" sheet, reachable via one extra tap. Orders earns a slot over
// Categories: incoming orders are checked many times a day, while the
// category tree is set up once and rarely revisited.
export const PRIMARY_NAV_KEYS: readonly string[] = ["dashboard", "orders", "products", "inventory"];
