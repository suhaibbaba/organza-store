// Backend error codes — translation KEYS only (CLAUDE.md rule 12), never
// literal sentences. Every frontend renders these via t().
export const ERROR_CODES = {
  NOT_FOUND: "error.not_found",
  VALIDATION: "error.validation",
  INTERNAL: "error.internal",
  UNAUTHORIZED: "error.unauthorized",
  FORBIDDEN: "error.forbidden",
  ACCOUNT_INACTIVE: "error.account.inactive",
  // Too many attempts in too short a window. Carries no detail about what
  // was being attempted — a rate limit that explains itself is a rate limit
  // that helps whoever is probing.
  RATE_LIMITED: "error.rate_limited",

  DUPLICATE: "error.duplicate",
  SKU_DUPLICATE: "error.sku.duplicate",
  // A code already in use somewhere in the store — on a product or on a
  // variant, since barcodes share one namespace. Carries `details` naming
  // what it clashes with, because "already used" is unanswerable without
  // knowing by what (see lib/barcode.ts).
  BARCODE_DUPLICATE: "error.barcode.duplicate",
  // Not a barcode at all: too short, too long, or characters no scanner
  // could have produced.
  BARCODE_INVALID: "error.barcode.invalid",
  // "Use the supplier's code" with no code given. Nothing is generated in
  // its place — the garment either carries a tag or it doesn't.
  BARCODE_REQUIRED: "error.barcode.required",
  SLUG_DUPLICATE: "error.slug.duplicate",
  EMAIL_DUPLICATE: "error.email.duplicate",
  PHONE_DUPLICATE: "error.phone.duplicate",
  WHATSAPP_DUPLICATE: "error.whatsapp.duplicate",

  VALIDATION_REQUIRED: "error.validation.required",
  VALIDATION_INVALID_NUMBER: "error.validation.invalid_number",
  // A number that parses fine but sits outside what the field accepts (a
  // 5-metre label, a grid of 900 columns). Separate from invalid_number so
  // the user is told the value is too big/small, not that it isn't a number.
  VALIDATION_OUT_OF_RANGE: "error.validation.out_of_range",
  VALIDATION_INVALID_PHONE: "error.validation.invalid_phone",
  VALIDATION_INVALID_EMAIL: "error.validation.invalid_email",
  VALIDATION_PASSWORD_TOO_SHORT: "error.validation.password_too_short",
  VALIDATION_IMAGE_POINT_OUT_OF_RANGE: "error.validation.image_point_out_of_range",

  CATEGORY_NOT_FOUND: "error.category.not_found",
  CATEGORY_CIRCULAR_PARENT: "error.category.circular_parent",
  CATEGORY_HAS_CHILDREN: "error.category.has_children",
  CATEGORY_HAS_PRODUCTS: "error.category.has_products",

  PRODUCT_NOT_FOUND: "error.product.not_found",
  VARIANT_NOT_FOUND: "error.variant.not_found",

  // Numbered products (spec.md "Numbered shawls") are an explicit choice
  // (Product.isNumbered), and the two shapes never mix: a numbered product
  // sells numbers and nothing else, an ordinary one never sells numbers.
  PRODUCT_NUMBERED_ONLY_NUMBERS: "error.product.numbered_only_numbers",
  PRODUCT_NUMBERS_REQUIRE_NUMBERED: "error.product.numbers_require_numbered",
  // Flipping the choice on a product that already has variants would strand
  // (or destroy) them, so it is refused until they are removed.
  PRODUCT_NUMBERED_SWITCH_HAS_VARIANTS: "error.product.numbered_switch_has_variants",

  VARIANT_TYPE_NOT_FOUND: "error.variantType.not_found",
  VARIANT_TYPE_VALUE_NOT_FOUND: "error.variantType.value_not_found",
  VARIANT_TYPE_VALUE_DUPLICATE: "error.variantType.value_duplicate",

  IMAGE_INVALID_TYPE: "error.image.invalid_type",
  IMAGE_TOO_LARGE: "error.image.too_large",
  IMAGE_UPLOAD_FAILED: "error.image.upload_failed",
  IMAGE_FILE_REQUIRED: "error.image.file_required",
  IMAGE_NOT_FOUND: "error.image.not_found",
  IMAGE_OWNER_REQUIRED: "error.image.owner_required",
  IMAGE_REORDER_DUPLICATE: "error.image.reorder_duplicate",
  IMAGE_REORDER_MISMATCH: "error.image.reorder_mismatch",

  INVENTORY_PARENT_HAS_VARIANTS: "error.inventory.parent_has_variants",

  ORDER_NOT_FOUND: "error.order.not_found",
  ORDER_ITEM_NOT_FOUND: "error.order.item_not_found",
  ORDER_ITEMS_REQUIRED: "error.order.items_required",
  ORDER_CUSTOMER_REQUIRED: "error.order.customer_required",
  ORDER_LOCATION_INVALID: "error.order.location_invalid",
  ORDER_DISCOUNT_INVALID: "error.order.discount_invalid",
  ORDER_INVALID_STATUS_TRANSITION: "error.order.invalid_status_transition",
  ORDER_INSUFFICIENT_STOCK: "error.order.insufficient_stock",
  ORDER_NOT_EDITABLE: "error.order.not_editable",
  ORDER_NOT_RETURNABLE: "error.order.not_returnable",
  ORDER_RETURN_QUANTITY_EXCEEDED: "error.order.return_quantity_exceeded",
  ORDER_PRODUCT_UNAVAILABLE: "error.order.product_unavailable",
  ORDER_VARIANT_REQUIRED: "error.order.variant_required",
  // A cancelled or fully returned sale owes the shop nothing, so there is no
  // money on it to record as collected.
  ORDER_NOT_COLLECTABLE: "error.order.not_collectable",
  // A gift is rung up at the counter with the person standing there, so it
  // only exists on the STORE channel (spec.md "Gifts").
  ORDER_GIFT_CHANNEL_INVALID: "error.order.gift_channel_invalid",

  // --- cash drawer ---
  CASH_SESSION_NOT_FOUND: "error.cashSession.not_found",
  // One drawer per trading day. (Yesterday's still being open is deliberately
  // NOT an error — see routes/cashSessions.ts.)
  CASH_SESSION_DATE_TAKEN: "error.cashSession.date_taken",
  // A closed drawer is a counted, signed record — it is not re-counted.
  CASH_SESSION_ALREADY_CLOSED: "error.cashSession.already_closed",
  // The count and the expectation disagree. NEVER a refusal to close — this
  // is only raised when the difference was left unexplained: the note is what
  // makes a discrepancy investigable instead of invisible.
  CASH_SESSION_DIFFERENCE_NOTE_REQUIRED: "error.cashSession.difference_note_required",
  // More taken out of the drawer than was counted in it.
  CASH_SESSION_WITHDRAWAL_EXCEEDS_COUNT: "error.cashSession.withdrawal_exceeds_count",
  // Nothing to sign off: this day's difference was never carried forward, or
  // has already been dealt with.
  CASH_SESSION_NO_OPEN_FOLLOW_UP: "error.cashSession.no_open_follow_up",

  // --- expenses ---
  EXPENSE_NOT_FOUND: "error.expense.not_found",
  // NOTE: there is no expense-specific "already decided" code any more. An
  // expense's approval is an ordinary change request now (spec.md "Employee
  // change approvals"), so deciding one twice answers with
  // CHANGE_REQUEST_NOT_PENDING like every other gated change.
  EXPENSE_CATEGORY_NOT_FOUND: "error.expenseCategory.not_found",
  EXPENSE_CATEGORY_KEY_DUPLICATE: "error.expenseCategory.key_duplicate",
  EXPENSE_CATEGORY_KEY_INVALID: "error.expenseCategory.key_invalid",
  // Deleting a category would strand the expenses filed under it, so it is
  // refused while any exist — deactivate it instead.
  EXPENSE_CATEGORY_HAS_EXPENSES: "error.expenseCategory.has_expenses",

  // --- change requests (spec.md "Employee change approvals") ---
  CHANGE_REQUEST_NOT_FOUND: "error.changeRequest.not_found",
  // Approving or rejecting something already decided. Never a no-op: it
  // would overwrite who decided what, which is the one thing the record
  // exists to hold (the same reasoning as an expense that isn't pending).
  CHANGE_REQUEST_NOT_PENDING: "error.changeRequest.not_pending",
  // Nobody signs off their own request — that would make the gate decorative.
  CHANGE_REQUEST_SELF_DECISION: "error.changeRequest.self_decision",
  // Withdrawing somebody else's request. Taking an ask back is the ASKER's,
  // and only theirs: an Admin who disagrees with a request rejects it, on the
  // record, rather than making it disappear.
  CHANGE_REQUEST_NOT_REQUESTER: "error.changeRequest.not_requester",
  // The change was asked for, but by the time it was approved the thing it
  // was about had gone (a product soft-deleted, a photo already removed) or
  // the change no longer makes sense against what is stored now.
  CHANGE_REQUEST_TARGET_MISSING: "error.changeRequest.target_missing",
  CHANGE_REQUEST_NOT_APPLICABLE: "error.changeRequest.not_applicable",

  REPORT_RANGE_INVALID: "error.report.range_invalid",
  REPORT_RANGE_TOO_LONG: "error.report.range_too_long",

  SETTING_DEFAULT_LANGUAGE_NOT_SUPPORTED: "error.setting.default_language_not_supported",
  // A sale-notification mode that exists in the schema but isn't implemented
  // yet (see IMPLEMENTED_SALE_NOTIFICATION_MODES) — told apart from a plain
  // validation error so the admin can say "not available yet" rather than
  // "invalid value".
  SETTING_SALE_NOTIFICATION_MODE_UNSUPPORTED: "error.setting.sale_notification_mode_unsupported",

  // Web Push
  PUSH_ENDPOINT_INVALID: "error.push.endpoint_invalid",
  PUSH_NOT_CONFIGURED: "error.push.not_configured",
  PUSH_SUBSCRIPTION_NOT_FOUND: "error.push.subscription_not_found",

  USER_NOT_FOUND: "error.user.not_found",
  AUTH_SIGNUP_FAILED: "error.auth.signup_failed",

  // --- password set / reset by email ---
  // ONE code for unknown, expired, already-used and revoked links, on
  // purpose: telling the difference apart is telling whoever is holding a
  // stale link whether the account behind it exists. The screen says "ask
  // for a new link" either way, which is the only useful answer.
  PASSWORD_TOKEN_INVALID: "error.passwordToken.invalid",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
