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

  "category.view",
  "category.manage",

  "inventory.view",
  "inventory.adjust",

  "variantType.manage",

  "images.edit",
  "images.delete",

  // Phase 2 (spec.md) — not wired to any route yet, modeled now so the
  // Roles & Permissions table stays a single source of truth.
  "order.create",
  "order.edit",
  "order.cancel",
  "order.delete",

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
    "category.view",
    "category.manage",
    "inventory.view",
    "inventory.adjust",
    "variantType.manage",
    "images.edit",
    "images.delete",
    "order.create",
    "order.edit",
    "order.cancel",
    "order.delete",
  ],
  EMPLOYEE: [
    "dashboard.view",
    "product.view",
    "product.create",
    "category.view",
    "inventory.view",
    "variantType.manage",
    "images.edit",
    "order.create",
  ],
};
