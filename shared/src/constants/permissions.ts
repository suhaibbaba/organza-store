import type { Role } from "@/types/role";

// Every enforced action (rule 5). A new one goes here, in DEFAULT_ROLE_PERMISSIONS and the admin's PERMISSION_GROUPS; callers only use can().
export const PERMISSION_ACTIONS = [
  "dashboard.view",

  "product.view",
  "product.create",
  "product.edit",
  // Selling price (basePrice, compareAtPrice, priceOverride), split from product.edit so an Employee can fix details without re-pricing.
  "product.editPrice",
  "product.delete",
  "product.hide",
  // Which variants a product has, split from product.edit: it reaches stock, barcodes and labels at once, so an Employee's attempt is a request.
  "product.editVariantSet",
  // Cost and everything derived from it (COGS, profit, margin, valuation at cost): Admin only, one gate for all of it (rule 19).
  "product.viewCost",
  // Every role: a new piece needs its label, and printing writes only the print timestamp.
  "product.printLabels",
  // Every role, on purpose (spec.md "Quick sell"): it creates a deliberately incomplete product for review and grants nothing of product.create.
  "product.quickSell",
  // Completing a quick-sold product (category, cost, barcode, photos, or one-off): review after the sale, separate from changeRequest.approve.
  "product.complete",

  // The Reports screen: Admin only, separate from order.view, so following your own orders never adds up to the shop's takings.
  "report.view",

  "category.view",
  "category.manage",

  "inventory.view",
  "inventory.adjust",

  // Adding option types or values is additive, so an Employee may (spec.md "Inline add").
  "variantType.create",
  // Renaming or removing reaches every product using the value (rule 2), so Admin/Manager only.
  "variantType.manage",

  "images.edit",
  "images.delete",

  "order.view",
  "order.create",
  // Moving an order forward up to the courier; cancelling has its own action, so an Employee can never void one.
  "order.updateStatus",
  "order.edit",
  "order.cancel",
  "order.delete",
  // Gated with cancel/delete: a sale must not be undoable by the person who rang it up.
  "order.return",
  // Admin/Manager: whoever took the order must not declare its money received.
  "order.markCollected",
  // A GIFT order deducts stock and takes no money, so Admin/Manager only.
  "order.createGift",
  // Credit sales (spec.md "Customers and selling on credit"): every role as shipped, each configurable.
  "order.sellOnCredit",
  "order.recordPayment",
  "order.markHandedOver",

  // A customer's page shows their balance; the total of all debt is gated on dashboard.view instead (rule 19).
  "customer.view",
  "customer.manage",

  // Cash drawer: Admin/Manager for both halves, since the count is the shop's cash position (spec.md "Cash drawer & expenses").
  "cashSession.view",
  "cashSession.manage",

  // Every role may record an expense; an Employee's opens PENDING and pays nothing until approved.
  "expense.create",
  // The expense list is the shop's spending: Admin/Manager.
  "expense.view",
  // Editing and deleting an expense after the fact.
  "expense.manage",
  // Signing off (or refusing) an expense someone else recorded.
  "expense.approve",

  // Everyone reads the categories; changing them reaches every past expense, so Admin/Manager.
  "expenseCategory.view",
  "expenseCategory.manage",

  // Asking for a change you may not make yourself (spec.md "Employee change approvals"); without it a gated action is refused.
  "changeRequest.create",
  // Every role, but the route narrows the list to your own unless you hold changeRequest.approve.
  "changeRequest.view",
  // Withdrawing your OWN pending request (the route checks the asker); decided requests can never be withdrawn.
  "changeRequest.cancel",
  // Deciding a request: Admin only as shipped, and never the asker's; its own action so widening it is one entry.
  "changeRequest.approve",

  "user.manage",
  // Erasing a staff account, separate from user.manage; the API allows it only for accounts with no history (routes/users.ts).
  "user.delete",
  "user.viewSensitive",

  "settings.manage",

  // Editing this table: Admin as shipped and grantable, but nobody edits their own role or the ADMIN role (routes/permissions.ts).
  "permission.manage",
] as const;

type Action = (typeof PERMISSION_ACTIONS)[number];

// Every action is configurable; the unconfigurable ADMIN role is what prevents a lockout. PROTECTED stays, empty, to re-lock one later.

/** Never editable through any UI or API; can() answers these from DEFAULT_ROLE_PERMISSIONS alone. Empty today. */
export const PROTECTED_ACTIONS = [] as const satisfies readonly Action[];

/** Editable per role and stored in the database; derived as the complement of PROTECTED_ACTIONS so the two cannot drift. */
export const CONFIGURABLE_ACTIONS = PERMISSION_ACTIONS.filter(
  (action) => !(PROTECTED_ACTIONS as readonly string[]).includes(action),
) as readonly Exclude<Action, (typeof PROTECTED_ACTIONS)[number]>[];

// Runtime check too, since the apps ship compiled JavaScript: a protected entry must be a real action.
for (const action of PROTECTED_ACTIONS as readonly string[]) {
  if (!(PERMISSION_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`PROTECTED_ACTIONS names "${action}", which is not a permission action.`);
  }
}

/** Shipped rules (spec.md "Roles & Permissions"): live for ADMIN and PROTECTED, the bootstrap seed and can()'s fallback otherwise. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  ADMIN: [...PERMISSION_ACTIONS],
  MANAGER: [
    "dashboard.view",
    "product.view",
    "product.create",
    "product.edit",
    "product.editPrice",
    "product.delete",
    "product.hide",
    "product.editVariantSet",
    "product.quickSell",
    // Managers complete quick-sold pieces but not their cost, which stays flagged until an Admin fills it (rule 19).
    "product.complete",
    // No product.viewCost or report.view: cost, profit and Reports are Admin only.
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
    "order.sellOnCredit",
    "order.recordPayment",
    "order.markHandedOver",
    "customer.view",
    "customer.manage",
    "cashSession.view",
    "cashSession.manage",
    "expense.create",
    "expense.view",
    "expense.manage",
    "expense.approve",
    "expenseCategory.view",
    "expenseCategory.manage",
    // Managers hold every gated permission, but never changeRequest.approve.
    "changeRequest.create",
    "changeRequest.view",
    "changeRequest.cancel",
  ],
  EMPLOYEE: [
    "product.view",
    "product.create",
    "product.edit",
    "product.printLabels",
    // The Employee is at the till at the busiest hour; completing the product afterwards is not theirs.
    "product.quickSell",
    "category.view",
    "variantType.create",
    "images.edit",
    "order.view",
    "order.create",
    "order.updateStatus",
    "order.sellOnCredit",
    "order.recordPayment",
    "order.markHandedOver",
    "customer.view",
    "customer.manage",
    "expense.create",
    // ...and to record one they have to be able to read the category list.
    "expenseCategory.view",
    // These turn the five refused gated actions into requests an Admin can approve.
    "changeRequest.create",
    "changeRequest.view",
    // ...and to withdraw one typed by mistake.
    "changeRequest.cancel",
  ],
};
