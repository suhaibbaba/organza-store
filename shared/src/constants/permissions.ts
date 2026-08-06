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
  // What a piece COST the shop, and everything derived from it: COGS, gross
  // and net profit, margin, the inventory valuation at cost. ADMIN ONLY —
  // this is the owner's own margin, and it is not a Manager's to read
  // (CLAUDE.md rule 19). One action gates the field and every figure computed
  // from it, so there is no second place a profit number can slip out of.
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
  // Giving stock away: an order of type GIFT, rung up at the POS, which
  // deducts stock exactly like a sale but takes no money. Admin/Manager only
  // — an Employee who could file a sale as a gift could walk out with the
  // piece, which is the same reasoning that keeps cancel and delete from
  // them.
  "order.createGift",

  // --- the cash drawer (spec.md "Cash drawer & expenses") ---
  // Opening the day's drawer, closing it against a physical count, and
  // reading what it says. Admin/Manager only, both halves: the count IS the
  // shop's cash position, so the person standing at the till must not be the
  // one who declares what should have been in it.
  "cashSession.view",
  "cashSession.manage",

  // --- expenses ---
  // Recording what the shop spent. Held by every role on purpose: whoever
  // pays the electricity bill should be able to write it down there and then.
  // An Employee's expense opens PENDING and buys nothing until it is
  // approved, so this is a request, not a payout.
  "expense.create",
  // Reading the expense list, which is the shop's spending laid bare —
  // Admin/Manager, like every other figure that adds up to profit.
  "expense.view",
  // Editing and deleting an expense after the fact.
  "expense.manage",
  // Signing off (or refusing) an expense someone else recorded.
  "expense.approve",

  // The category list an expense is filed under. Everyone may READ it —
  // picking "Utilities" is part of recording an expense — but changing the
  // list itself reaches every past expense, so it stays with Admin/Manager.
  "expenseCategory.view",
  "expenseCategory.manage",

  "user.manage",
  "user.viewSensitive",

  "settings.manage",
] as const;

type Action = (typeof PERMISSION_ACTIONS)[number];

// spec.md "Roles & Permissions" table, verbatim:
// Admin: everything. Manager: products/stock/orders full, no users/settings,
// AND NO COST OR PROFIT. Employee: POS, add and edit products, edit images,
// create + hand over orders — cannot delete/hide products, cannot
// delete/edit/cancel orders, cannot mark money collected, no users/settings,
// no cost/idNumber visibility, and neither the dashboard nor the inventory
// list: both are shop-wide overviews (stock levels, inventory value,
// low-stock alerts) that belong to whoever manages stock, which an Employee
// does not.
//
// Cost and profit are ADMIN ONLY (spec.md "Sensitive fields"). A Manager runs
// the shop floor — stock, orders, the drawer, what was spent — but what each
// piece cost the owner, and therefore what the shop earns on it, is the
// owner's alone. product.viewCost is the single gate: dropping it from
// MANAGER below is what removes cost from products, unitCost from order
// lines, the cost basis from the inventory valuation, and COGS / gross
// profit / net profit / margin from every report, all at once.
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
    // NOTE: no "product.viewCost" — cost and profit are Admin only.
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
    "order.createGift",
    "cashSession.view",
    "cashSession.manage",
    "expense.create",
    "expense.view",
    "expense.manage",
    "expense.approve",
    "expenseCategory.view",
    "expenseCategory.manage",
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
    // Whoever pays the bill writes it down. It opens PENDING and needs an
    // Admin/Manager to approve it before it touches the drawer or the books,
    // so recording one spends nothing on its own.
    "expense.create",
    // ...and to record one they have to be able to read the category list.
    "expenseCategory.view",
  ],
};
