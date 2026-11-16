// ============================================================================
//  Change requests — the generic approval gate.
//
//  Some changes are too consequential to hand to whoever happens to be at the
//  counter: re-pricing a piece, writing stock off by hand, deleting a photo,
//  taking a product off the shelf, changing which variants a product even has.
//  spec.md "Employee change approvals": an Employee may ASK for any of them,
//  and the change waits, visible and attributed, until an Admin decides.
//
//  Nothing here names a product, an expense or an image in particular. A
//  request is (entity type, entity id, field, old value, requested value) —
//  which is why gating a new entity later is an entry in the tables below plus
//  an applier on the backend, never a second approval mechanism bolted onto
//  that entity's own table. The expense approval that used to live on
//  Expense.approvalStatus is itself just one of these now.
// ============================================================================

/** Mirrors `enum ChangeRequestStatus` in backend/prisma/schema.prisma. */
export const CHANGE_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

// The one status that is still waiting on somebody. Named rather than spelled
// out at each call site, for the same reason the expense statuses are.
export const PENDING_CHANGE_REQUEST_STATUS = "PENDING";
export const APPROVED_CHANGE_REQUEST_STATUS = "APPROVED";
export const REJECTED_CHANGE_REQUEST_STATUS = "REJECTED";

/**
 * Which kinds of thing can be gated. The value is what goes in
 * ChangeRequest.entityType, and it matches AUDIT_ENTITY on the backend on
 * purpose — one vocabulary for "what was this about", whether the row is an
 * audit entry or a request.
 */
export const CHANGE_REQUEST_ENTITIES = {
  PRODUCT: "Product",
  VARIANT: "Variant",
  PRODUCT_IMAGE: "ProductImage",
  EXPENSE: "Expense",
} as const;

/**
 * The gated fields, per entity. A request is unique on
 * (entityType, entityId, field) while it is pending — that tuple is what
 * superseding replaces, so two different fields of the same product wait
 * independently while a second opinion on the SAME field simply replaces the
 * first (spec.md: never a queue of stale requests).
 *
 * `variantSet` is not a column: it stands for "which variants this product
 * has", so adding combinations and removing one are the same field and
 * supersede each other. `deletion` and `approvalStatus` are the same idea for
 * an image and an expense.
 */
export const CHANGE_REQUEST_FIELDS = {
  PRODUCT_BASE_PRICE: "basePrice",
  PRODUCT_COMPARE_AT_PRICE: "compareAtPrice",
  PRODUCT_STOCK: "stock",
  PRODUCT_IS_ACTIVE: "isActive",
  PRODUCT_VARIANT_SET: "variantSet",

  VARIANT_PRICE_OVERRIDE: "priceOverride",
  VARIANT_STOCK: "stock",

  IMAGE_DELETION: "deletion",

  EXPENSE_APPROVAL: "approvalStatus",

  /**
   * The one request that is NOT permission before the fact.
   *
   * A quick-sold product (spec.md "Quick sell") was already sold — money
   * changed hands at the counter — and what waits here is its DETAILS:
   * category, cost, barcode, photographs, all of which the cashier skipped so
   * the queue could move. Approving completes the product; refusing rules it
   * a one-off and leaves the sale exactly where it is.
   *
   * It rides the same mechanism as every other gated change (CLAUDE.md rule
   * 21) rather than a second `status` column on Product, and it is the reason
   * the approval screen has to be able to say "this was sold — complete it"
   * instead of "approve this change": the two read as opposites to whoever is
   * deciding, and getting that wrong would invite an Admin to think refusing
   * undoes a sale.
   */
  PRODUCT_COMPLETION: "completion",
} as const;

/**
 * How a value should be READ — never how it should be worded (CLAUDE.md rule
 * 12). The admin screen renders a money kind with the store currency, a count
 * as a plain integer, a flag as shown/hidden, and the compound kinds through
 * their own little components.
 */
export const CHANGE_REQUEST_VALUE_KINDS = {
  MONEY: "money",
  COUNT: "count",
  FLAG: "flag",
  VARIANT_SET: "variantSet",
  DELETION: "deletion",
  APPROVAL: "approval",
  /**
   * A sale that has already happened: how much it went for, and how many.
   * Read as "sold for X" rather than as "from A to B" — there is no old
   * value to move away from, because the product did not exist before.
   */
  QUICK_SELL: "quickSell",
} as const;

/** What a variantSet request asks for: combinations added, or one removed. */
export const CHANGE_REQUEST_VARIANT_SET_ACTIONS = { ADD: "add", REMOVE: "remove" } as const;

export const CHANGE_REQUEST_SORT_FIELDS = ["createdAt", "entityType"] as const;

/**
 * The reason attached to a refusal. Optional in the same way an expense
 * rejection note is: asking for one makes a refusal answerable, refusing to
 * record it without one helps nobody.
 */
export const CHANGE_REQUEST_NOTE_MAX_LENGTH = 500;
