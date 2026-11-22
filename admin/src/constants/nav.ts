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
  WalletMinimal,
  Contact,
  Truck,
  ShoppingBag,
  Package,
  Landmark,
  Building2,
} from "lucide-react";
import type { NavEntry, NavItem } from "@/types/nav";

// CLAUDE.md rule 5 / task spec: Users + Settings are Admin-only in the nav;
// everything else is visible to every authenticated role.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, action: "dashboard.view" },
  { key: "orders", href: "/orders", icon: ReceiptText, action: "order.view" },
  // Money still with the delivery company. Gated on the permission that lets
  // someone settle it, so an Employee — who may take orders but never declare
  // their money received — doesn't see a screen they can't act on.
  { key: "collection", href: "/orders/collection", icon: HandCoins, action: "order.markCollected" },
  // Customers and what each owes on credit (spec.md "Customers and selling on credit").
  { key: "customers", href: "/customers", icon: Contact, action: "customer.view" },
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
  // What the shop spent; reading it is Admin/Manager, the same gate as the API.
  { key: "expenses", href: "/expenses", icon: WalletMinimal, action: "expense.view" },
  // What the shop bought and still owes; Admin only as shipped, since an invoice shows what the stock cost.
  { key: "suppliers", href: "/suppliers", icon: Truck, action: "supplier.view" },
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

// One tree for the sidebar and the phone menu: single pages stay on top, related pages fold into a group.
export const NAV_TREE: readonly NavEntry[] = [
  { kind: "item", key: "dashboard" },
  { kind: "group", key: "sales", icon: ShoppingBag, items: ["orders", "collection", "customers"] },
  { kind: "group", key: "catalogue", icon: Package, items: ["products", "inventory", "labels", "categories"] },
  { kind: "group", key: "finance", icon: Landmark, items: ["reports", "expenses", "suppliers"] },
  { kind: "item", key: "changeRequests" },
  { kind: "group", key: "manage", icon: Building2, items: ["users", "permissions", "settings"] },
];

// The group the design system link joins (Admin role only).
export const DESIGN_SYSTEM_NAV_GROUP = "manage";
