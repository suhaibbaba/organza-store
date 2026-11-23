import { PERMISSION_ACTIONS } from "@store/shared/constants/permissions";
import type { EditableRole, PermissionGroup } from "@/types/permission";

// Grouped by part of the shop; every action must appear in exactly one group (checked below).
export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: "products",
    icon: "package",
    tone: "blue",
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
    icon: "layers",
    tone: "violet",
    actions: [
      "category.view",
      "category.manage",
      "variantType.create",
      "variantType.manage",
      "images.edit",
      "images.delete",
    ],
  },
  {
    key: "inventory",
    icon: "shapes",
    tone: "green",
    actions: ["inventory.view", "inventory.adjust"],
  },
  {
    key: "orders",
    icon: "receipt",
    tone: "amber",
    actions: [
      "order.view",
      "order.create",
      "order.updateStatus",
      "order.edit",
      "order.cancel",
      "order.delete",
      "order.return",
      "order.exchange",
      "order.markCollected",
      "order.createGift",
      "order.sellOnCredit",
      "order.recordPayment",
      "order.markHandedOver",
    ],
  },
  {
    key: "customers",
    icon: "users",
    tone: "rose",
    actions: ["customer.view", "customer.manage"],
  },
  {
    key: "suppliers",
    icon: "store",
    tone: "rose",
    actions: ["supplier.view", "supplier.manage", "supplier.pay"],
  },
  {
    key: "money",
    icon: "money",
    tone: "rose",
    actions: [
      "dashboard.view",
      "sales.view",
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
    icon: "clipboard",
    tone: "red",
    actions: ["changeRequest.create", "changeRequest.view", "changeRequest.cancel", "changeRequest.approve"],
  },
  {
    key: "staff",
    icon: "users",
    tone: "neutral",
    actions: ["user.manage", "user.delete", "user.viewSensitive", "settings.manage", "permission.manage"],
  },
];

// Fails at load: a permission missing from this screen would otherwise be invisible.
const grouped = PERMISSION_GROUPS.flatMap((group) => group.actions);
const missing = PERMISSION_ACTIONS.filter((action) => !grouped.includes(action));
const duplicated = grouped.filter((action, index) => grouped.indexOf(action) !== index);

if (missing.length > 0 || duplicated.length > 0) {
  throw new Error(
    `PERMISSION_GROUPS must list every action exactly once. Missing: [${missing.join(", ")}]. ` +
      `Duplicated: [${duplicated.join(", ")}].`,
  );
}

// The Admin holds everything and is never editable (rule 22), so only these two are columns.
export const EDITABLE_ROLES: readonly EditableRole[] = ["MANAGER", "EMPLOYEE"];
