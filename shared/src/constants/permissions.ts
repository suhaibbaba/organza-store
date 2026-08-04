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
  // What a product SELLS for: basePrice, compareAtPrice and a variant's
  // priceOverride. Split out of product.edit so an Employee can fix a name,
  // a description or a category on a piece already on the shelf without
  // being able to re-price it — the money side stays with Admin/Manager.
  // `cost` is not here: it is invisible to an Employee entirely
  // (product.viewCost, CLAUDE.md rule 19).
  "product.editPrice",
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

  // Adding to the global option lists — a new type (Material), or a new
  // value under an existing one (Emerald). Additive only, which is what
  // makes it safe for an Employee to hold: it is part of adding a product
  // (spec.md "Inline add"), and nothing already on the shelf changes just
  // because a new colour exists.
  "variantType.create",
  // Changing or removing what is already there. A rename reaches every
  // product using that value (CLAUDE.md rule 2) and a deletion would pull it
  // out from under them, so this one stays with Admin/Manager.
  "variantType.manage",

  "images.edit",
  "images.delete",

  "order.view",
  "order.create",
  // Advancing an order along the flow, up to handing it to the courier
  // (spec.md: Employees "create + hand over" orders). Cancelling is NOT part
  // of this — it has its own action below, so an Employee can move an order
  // forward but never void it.
  "order.updateStatus",
  "order.edit",
  "order.cancel",
  "order.delete",
  // Reversing a sale, in whole or in part. Gated with cancel/delete rather
  // than with updateStatus for the same reason: a sale must not be undoable
  // by the person who rang it up.
  "order.return",
  // Recording that the delivery company has actually paid for an order.
  // Admin/Manager only: this is the shop's cash position, and the person who
  // took the order must not be able to declare its money received — the same
  // anti-theft reasoning that keeps cancel and delete out of their hands.
  "order.markCollected",

  "user.manage",
  "user.viewSensitive",

  "settings.manage",
] as const;

type Action = (typeof PERMISSION_ACTIONS)[number];

// spec.md "Roles & Permissions" table, verbatim:
// Admin: everything. Manager: products/stock/orders full, no users/settings.
// Employee: POS, add and edit products, edit images, create + hand over
// orders — cannot delete/hide products, cannot delete/edit/cancel orders,
// cannot mark money collected, no users/settings, no cost/idNumber
// visibility, and neither the dashboard nor the inventory list: both are
// shop-wide overviews (stock levels, inventory value, low-stock alerts) that
// belong to whoever manages stock, which an Employee does not.
// Editing a product is the details only — its price is product.editPrice,
// its stock inventory.adjust, its visibility product.hide, none of which an
// Employee holds. On the global option lists they may add (variantType.create,
// so the inline add on the product form keeps working) but not rename or
// remove (variantType.manage), which would reach every product at once.
export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  ADMIN: [...PERMISSION_ACTIONS],
  MANAGER: [
    "dashboard.view",
    "product.view",
    "product.create",
    "product.edit",
    "product.editPrice",
    "product.delete",
    "product.hide",
    "product.viewCost",
    "product.printLabels",
    "category.view",
    "category.manage",
    "inventory.view",
    "inventory.adjust",
    "variantType.create",
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
    "order.markCollected",
  ],
  EMPLOYEE: [
    "product.view",
    "product.create",
    "product.edit",
    "product.printLabels",
    "category.view",
    "variantType.create",
    "images.edit",
    "order.view",
    "order.create",
    "order.updateStatus",
  ],
};
