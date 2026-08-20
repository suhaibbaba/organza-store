import type { PermissionAction } from "@organza/shared/types/permission";
import { PERMISSION_ACTIONS } from "@organza/shared/constants/permissions";

/**
 * The Permissions screen, laid out the way somebody running a shop thinks
 * about it: by the part of the shop each action belongs to, not by the order
 * the actions happen to be declared in.
 *
 * Every action appears in exactly one group — checked below, so an action
 * added to the shared list and forgotten here is a crash on the first render
 * rather than a row that is silently missing from the screen that exists to
 * show all of them.
 *
 * Labels come from `permissions.actions.*` in the message files, keyed by the
 * action itself (CLAUDE.md rule 12), and so do the group headings.
 */
export interface PermissionGroup {
  key: string;
  actions: readonly PermissionAction[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: "products",
    actions: [
      "product.view",
      "product.create",
      "product.edit",
      "product.editPrice",
      "product.delete",
      "product.hide",
      "product.editVariantSet",
      "product.viewCost",
      "product.printLabels",
      "product.quickSell",
      "product.complete",
    ],
  },
  {
    key: "catalogue",
    actions: ["category.view", "category.manage", "variantType.create", "variantType.manage", "images.edit", "images.delete"],
  },
  {
    key: "inventory",
    actions: ["inventory.view", "inventory.adjust"],
  },
  {
    key: "orders",
    actions: [
      "order.view",
      "order.create",
      "order.updateStatus",
      "order.edit",
      "order.cancel",
      "order.delete",
      "order.return",
      "order.markCollected",
      "order.createGift",
    ],
  },
  {
    key: "money",
    actions: [
      "dashboard.view",
      "report.view",
      "cashSession.view",
      "cashSession.manage",
      "expense.create",
      "expense.view",
      "expense.manage",
      "expense.approve",
      "expenseCategory.view",
      "expenseCategory.manage",
    ],
  },
  {
    key: "approvals",
    actions: ["changeRequest.create", "changeRequest.view", "changeRequest.cancel", "changeRequest.approve"],
  },
  {
    key: "staff",
    actions: ["user.manage", "user.delete", "user.viewSensitive", "settings.manage", "permission.manage"],
  },
];

// The screen's own promise: it shows EVERY action. Broken loudly rather than
// quietly, at module load, because the failure it prevents — a permission
// that exists and cannot be found anywhere — is invisible by nature.
const grouped = PERMISSION_GROUPS.flatMap((group) => group.actions);
const missing = PERMISSION_ACTIONS.filter((action) => !grouped.includes(action));
const duplicated = grouped.filter((action, index) => grouped.indexOf(action) !== index);

if (missing.length > 0 || duplicated.length > 0) {
  throw new Error(
    `PERMISSION_GROUPS must list every action exactly once. Missing: [${missing.join(", ")}]. ` +
      `Duplicated: [${duplicated.join(", ")}].`
  );
}

/** Roles down the columns of the matrix, in the order the shop thinks of them. */
export const PERMISSION_MATRIX_ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;
