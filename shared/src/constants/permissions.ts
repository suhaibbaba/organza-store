import type { Role } from "@/types/role";

// Every action currently enforced across backend + admin (CLAUDE.md rule 5,
// spec.md "Roles & Permissions"). Adding a capability later means adding an
// entry here and to ROLE_PERMISSIONS below — callers only ever call
// `can(user, action)` (see lib/permissions.ts) and never touch this list, so
// the source of rules can become backend-driven later without changing them.
export const PERMISSION_ACTIONS = [
  "dashboard.view",

  "product.view",
  "product.create",
  "product.edit",
  "product.delete",
  "product.hide",
  "product.viewCost",
  // Printing barcode labels and recording that they were printed. Held by
  // every role on purpose: an Employee may add products (spec.md), and a new
  // piece is useless on the shelf until its label is on it. It writes nothing
  // but the print timestamp — no price, stock or visibility — so it stays
  // clear of the edit/delete/hide gates an Employee must not pass.
  "product.printLabels",

  "category.view",
  "category.manage",

  "inventory.view",
  "inventory.adjust",

  "variantType.manage",

  "images.edit",
  "images.delete",

  "order.view",
  "order.create",
  // Advancing an order along the delivery flow (spec.md: Employees "create +
  // mark delivered"). Cancelling is NOT part of this — it has its own action
  // below, so an Employee can move an order forward but never void it.
  "order.updateStatus",
  "order.edit",
  "order.cancel",
  "order.delete",
  // Reversing a sale, in whole or in part. Gated with cancel/delete rather
  // than with updateStatus for the same reason: a sale must not be undoable
  // by the person who rang it up.
  "order.return",

  "user.manage",
  "user.viewSensitive",

  "settings.manage",
] as const;

type Action = (typeof PERMISSION_ACTIONS)[number];

// spec.md "Roles & Permissions" table, verbatim:
// Admin: everything. Manager: products/stock/orders full, no users/settings.
// Employee: POS, add products, edit images, create + mark-delivered orders —
// cannot delete/hide products, cannot delete/edit/cancel orders, no
// users/settings, no cost/idNumber visibility.
export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  ADMIN: [...PERMISSION_ACTIONS],
  MANAGER: [
    "dashboard.view",
    "product.view",
    "product.create",
    "product.edit",
    "product.delete",
    "product.hide",
    "product.viewCost",
    "product.printLabels",
    "category.view",
    "category.manage",
    "inventory.view",
    "inventory.adjust",
    "variantType.manage",
    "images.edit",
    "images.delete",
    "order.view",
    "order.create",
    "order.updateStatus",
    "order.edit",
    "order.cancel",
    "order.delete",
    "order.return",
  ],
  EMPLOYEE: [
    "dashboard.view",
    "product.view",
    "product.create",
    "product.printLabels",
    "category.view",
    "inventory.view",
    "variantType.manage",
    "images.edit",
    "order.view",
    "order.create",
    "order.updateStatus",
  ],
};
