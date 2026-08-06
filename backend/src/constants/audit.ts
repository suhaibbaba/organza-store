// Entity type labels written to AuditLog.entityType (CLAUDE.md rule 6).
export const AUDIT_ENTITY = {
  CATEGORY: "Category",
  PRODUCT: "Product",
  VARIANT: "Variant",
  PRODUCT_IMAGE: "ProductImage",
  ORDER: "Order",
  USER: "User",
  SETTING: "Setting",
  VARIANT_TYPE: "VariantType",
  VARIANT_OPTION_VALUE: "VariantOptionValue",
  EXPENSE: "Expense",
  EXPENSE_CATEGORY: "ExpenseCategory",
  CASH_SESSION: "CashSession",
  // Requests themselves are audited too: "who asked for this price" and "who
  // agreed to it" are separate questions from "what did the price become".
  CHANGE_REQUEST: "ChangeRequest",
} as const;
