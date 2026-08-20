import {
  LayoutDashboard,
  Shirt,
  Boxes,
  Barcode,
  FolderTree,
  ReceiptText,
  HandCoins,
  ChartColumn,
  ClipboardCheck,
  Users,
  ShieldCheck,
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
  // Sales & profit. ADMIN ONLY, on its own permission: it used to be gated
  // with order.view — the permission that lets somebody ring up and follow
  // the orders they take — which put the shop's whole takings one tap away
  // from an Employee. Cost and profit inside the page are gated again, and
  // separately, by product.viewCost (CLAUDE.md rule 19).
  { key: "reports", href: "/reports", icon: ChartColumn, action: "report.view" },
  // Changes waiting on somebody (spec.md "Employee change approvals").
  // Gated on the permission to READ requests, which every role holds — an
  // Admin comes here to decide, an Employee to see their own edit waiting
  // rather than wondering where it went. The badge next to it counts
  // whichever of those two the reader actually has.
  { key: "changeRequests", href: "/change-requests", icon: ClipboardCheck, action: "changeRequest.view" },
  { key: "users", href: "/users", icon: Users, action: "user.manage" },
  // Who may do what (spec.md "Editable role permissions"). Gated on the
  // permission to edit the table rather than on user.manage: the two live
  // next to each other on the nav and are different powers, and whoever may
  // add a member of staff is not automatically whoever may decide what a
  // whole role is allowed to do.
  { key: "permissions", href: "/permissions", icon: ShieldCheck, action: "permission.manage" },
  { key: "settings", href: "/settings", icon: Settings, action: "settings.manage" },
] as const;

// Bottom nav (mobile) shows these directly; everything else lives in the
// "More" sheet, reachable via one extra tap. Orders earns a slot over
// Categories: incoming orders are checked many times a day, while the
// category tree is set up once and rarely revisited.
//
// A tuple, not a string[], so the solid-icon table can be typed against it:
// every tab here MUST have a drawn solid twin (components/icons/
// nav-solid-icons.tsx) or the build fails. Outline vs solid is how this bar
// says which tab you are on — a difference you can see across a room, unlike a
// tint — and that only holds if the solid is legible, which only holds if
// somebody drew it.
export const PRIMARY_NAV_KEYS = ["dashboard", "orders", "products", "inventory"] as const;

export type PrimaryNavKey = (typeof PRIMARY_NAV_KEYS)[number];
