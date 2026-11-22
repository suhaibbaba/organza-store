// Backend error codes — translation KEYS only (CLAUDE.md rule 12), never literal sentences.
export const ERROR_CODES = {
  NOT_FOUND: "error.not_found",
  VALIDATION: "error.validation",
  INTERNAL: "error.internal",
  UNAUTHORIZED: "error.unauthorized",
  FORBIDDEN: "error.forbidden",
  ACCOUNT_INACTIVE: "error.account.inactive",
  // Deliberately says nothing about what was attempted — a self-explaining rate limit helps whoever is probing.
  RATE_LIMITED: "error.rate_limited",

  DUPLICATE: "error.duplicate",
  SKU_DUPLICATE: "error.sku.duplicate",
  // Barcodes share one namespace across products and variants; `details` names the clash (see lib/barcode.ts).
  BARCODE_DUPLICATE: "error.barcode.duplicate",
  // Not a barcode at all: too short, too long, or characters no scanner could have produced.
  BARCODE_INVALID: "error.barcode.invalid",
  // "Use the supplier's code" with no code given — nothing is generated in its place.
  BARCODE_REQUIRED: "error.barcode.required",
  SLUG_DUPLICATE: "error.slug.duplicate",
  EMAIL_DUPLICATE: "error.email.duplicate",
  PHONE_DUPLICATE: "error.phone.duplicate",
  WHATSAPP_DUPLICATE: "error.whatsapp.duplicate",

  VALIDATION_REQUIRED: "error.validation.required",
  VALIDATION_INVALID_NUMBER: "error.validation.invalid_number",
  // Parses fine but outside the field's range — separate from invalid_number so the message says too big/small.
  VALIDATION_OUT_OF_RANGE: "error.validation.out_of_range",
  VALIDATION_INVALID_PHONE: "error.validation.invalid_phone",
  VALIDATION_INVALID_EMAIL: "error.validation.invalid_email",
  VALIDATION_PASSWORD_TOO_SHORT: "error.validation.password_too_short",
  VALIDATION_IMAGE_POINT_OUT_OF_RANGE: "error.validation.image_point_out_of_range",
  // Text past its field's length (e.g. an option-value note); out_of_range is for numbers.
  VALIDATION_TOO_LONG: "error.validation.too_long",
  // A marker colour that is not a hex colour (spec.md "Numbered shawls").
  VALIDATION_INVALID_COLOR: "error.validation.invalid_color",

  CATEGORY_NOT_FOUND: "error.category.not_found",
  CATEGORY_CIRCULAR_PARENT: "error.category.circular_parent",
  CATEGORY_HAS_CHILDREN: "error.category.has_children",
  CATEGORY_HAS_PRODUCTS: "error.category.has_products",

  PRODUCT_NOT_FOUND: "error.product.not_found",
  VARIANT_NOT_FOUND: "error.variant.not_found",

  // Numbered products (spec.md "Numbered shawls") sell numbers and nothing else; ordinary ones never sell numbers.
  PRODUCT_NUMBERED_ONLY_NUMBERS: "error.product.numbered_only_numbers",
  PRODUCT_NUMBERS_REQUIRE_NUMBERED: "error.product.numbers_require_numbered",
  // Flipping isNumbered with variants present would strand them, so it is refused until they are removed.
  PRODUCT_NUMBERED_SWITCH_HAS_VARIANTS: "error.product.numbered_switch_has_variants",
  // An option note is scoped to the product's own use of the value (spec.md "Notes on a product's options").
  PRODUCT_OPTION_NOTE_VALUE_NOT_USED: "error.product.option_note_value_not_used",
  // A quick-sold product can't be completed while it still has no category (spec.md "Quick sell"); enforced server-side.
  PRODUCT_COMPLETION_INCOMPLETE: "error.product.completion_incomplete",

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
  // Re-crop asked for but the ORIGINAL is not on disk; the stored sizes are still fine, so not "not found".
  IMAGE_ORIGINAL_MISSING: "error.image.original_missing",

  INVENTORY_PARENT_HAS_VARIANTS: "error.inventory.parent_has_variants",

  ORDER_NOT_FOUND: "error.order.not_found",
  ORDER_ITEM_NOT_FOUND: "error.order.item_not_found",
  ORDER_ITEMS_REQUIRED: "error.order.items_required",
  ORDER_CUSTOMER_REQUIRED: "error.order.customer_required",
  ORDER_LOCATION_INVALID: "error.order.location_invalid",
  ORDER_LOCATION_LINK_INVALID: "error.order.location_link_invalid",
  ORDER_DISCOUNT_INVALID: "error.order.discount_invalid",
  ORDER_INVALID_STATUS_TRANSITION: "error.order.invalid_status_transition",
  ORDER_INSUFFICIENT_STOCK: "error.order.insufficient_stock",
  ORDER_NOT_EDITABLE: "error.order.not_editable",
  ORDER_NOT_RETURNABLE: "error.order.not_returnable",
  ORDER_RETURN_QUANTITY_EXCEEDED: "error.order.return_quantity_exceeded",
  ORDER_PRODUCT_UNAVAILABLE: "error.order.product_unavailable",
  ORDER_VARIANT_REQUIRED: "error.order.variant_required",
  // A line must name exactly one of a catalogue product or a quick sale (spec.md "Quick sell").
  ORDER_ITEM_SOURCE_INVALID: "error.order.item_source_invalid",
  // A cancelled or fully returned sale owes nothing, so there is no money to record as collected.
  ORDER_NOT_COLLECTABLE: "error.order.not_collectable",
  ORDER_CREDIT_INVALID: "error.order.credit_invalid",
  ORDER_NOT_ON_CREDIT: "error.order.not_on_credit",
  ORDER_PAYMENT_EXCEEDS_BALANCE: "error.order.payment_exceeds_balance",
  ORDER_ALREADY_HANDED_OVER: "error.order.already_handed_over",
  CUSTOMER_NOT_FOUND: "error.customer.not_found",
  CUSTOMER_PHONE_TAKEN: "error.customer.phone_taken",
  CUSTOMER_NOTHING_OWED: "error.customer.nothing_owed",
  SUPPLIER_NOT_FOUND: "error.supplier.not_found",
  SUPPLIER_PHONE_TAKEN: "error.supplier.phone_taken",
  SUPPLIER_NOTHING_OWED: "error.supplier.nothing_owed",
  SUPPLIER_INVOICE_NOT_FOUND: "error.supplier.invoice_not_found",
  SUPPLIER_PAYMENT_EXCEEDS_BALANCE: "error.supplier.payment_exceeds_balance",
  SUPPLIER_INVOICE_BELOW_PAID: "error.supplier.invoice_below_paid",
  SUPPLIER_INVOICE_HAS_PAYMENTS: "error.supplier.invoice_has_payments",

  // --- cash drawer ---
  CASH_SESSION_NOT_FOUND: "error.cashSession.not_found",
  // One drawer per trading day; yesterday's still being open is deliberately NOT an error (routes/cashSessions.ts).
  CASH_SESSION_DATE_TAKEN: "error.cashSession.date_taken",
  // A closed drawer is a counted, signed record — it is not re-counted.
  CASH_SESSION_ALREADY_CLOSED: "error.cashSession.already_closed",
  // Never a refusal to close: only raised when a difference is left without the note that makes it investigable.
  CASH_SESSION_DIFFERENCE_NOTE_REQUIRED: "error.cashSession.difference_note_required",
  // More taken out of the drawer than was counted in it.
  CASH_SESSION_WITHDRAWAL_EXCEEDS_COUNT: "error.cashSession.withdrawal_exceeds_count",
  // Nothing to sign off: this day's difference was never carried forward, or already dealt with.
  CASH_SESSION_NO_OPEN_FOLLOW_UP: "error.cashSession.no_open_follow_up",

  // --- expenses ---
  EXPENSE_NOT_FOUND: "error.expense.not_found",
  // No expense-specific "already decided" code: expense approvals answer CHANGE_REQUEST_NOT_PENDING.
  EXPENSE_CATEGORY_NOT_FOUND: "error.expenseCategory.not_found",
  EXPENSE_CATEGORY_KEY_DUPLICATE: "error.expenseCategory.key_duplicate",
  EXPENSE_CATEGORY_KEY_INVALID: "error.expenseCategory.key_invalid",
  // Deleting would strand the expenses filed under it, so it is refused while any exist — deactivate instead.
  EXPENSE_CATEGORY_HAS_EXPENSES: "error.expenseCategory.has_expenses",

  // --- change requests (spec.md "Employee change approvals") ---
  CHANGE_REQUEST_NOT_FOUND: "error.changeRequest.not_found",
  // Never a no-op: re-deciding would overwrite who decided what, which is what the record exists to hold.
  CHANGE_REQUEST_NOT_PENDING: "error.changeRequest.not_pending",
  // Nobody signs off their own request — that would make the gate decorative.
  CHANGE_REQUEST_SELF_DECISION: "error.changeRequest.self_decision",
  // Withdrawing is the asker's alone: an Admin who disagrees rejects on the record instead.
  CHANGE_REQUEST_NOT_REQUESTER: "error.changeRequest.not_requester",
  // By approval time the target is gone (soft-deleted, photo removed) or the change no longer fits what is stored.
  CHANGE_REQUEST_TARGET_MISSING: "error.changeRequest.target_missing",
  CHANGE_REQUEST_NOT_APPLICABLE: "error.changeRequest.not_applicable",

  REPORT_RANGE_INVALID: "error.report.range_invalid",
  REPORT_RANGE_TOO_LONG: "error.report.range_too_long",

  SETTING_DEFAULT_LANGUAGE_NOT_SUPPORTED: "error.setting.default_language_not_supported",
  // A mode in the schema but not implemented yet — distinct so the admin can say "not available yet".
  SETTING_SALE_NOTIFICATION_MODE_UNSUPPORTED: "error.setting.sale_notification_mode_unsupported",

  // Web Push
  PUSH_ENDPOINT_INVALID: "error.push.endpoint_invalid",
  PUSH_NOT_CONFIGURED: "error.push.not_configured",
  PUSH_SUBSCRIPTION_NOT_FOUND: "error.push.subscription_not_found",

  USER_NOT_FOUND: "error.user.not_found",
  AUTH_SIGNUP_FAILED: "error.auth.signup_failed",
  // Refused rather than turned into a reset: resetting a working password is a separate decision with its own button.
  USER_ALREADY_ACTIVATED: "error.user.already_activated",
  // Demoting/deactivating the last Admin locks the shop out, and only a terminal on the VPS could undo it.
  USER_LAST_ADMIN: "error.user.last_admin",
  // Never what somebody means: someone leaving is removed BY somebody else, which the audit trail can describe.
  USER_SELF_REMOVAL: "error.user.self_removal",
  // Records name their author (spec.md "Security rationale"), so a worked account is deactivated, never deleted.
  USER_HAS_HISTORY: "error.user.has_history",
  PROFILE_WRONG_PASSWORD: "error.profile.wrong_password",
  PROFILE_SESSION_NOT_FOUND: "error.profile.session_not_found",

  // Role permissions (spec.md "Editable role permissions"): refused on the server, never merely hidden.
  PERMISSION_ACTION_PROTECTED: "error.permission.action_protected",
  // Nobody adjusts their own authority: it is the one edit whose reviewer and subject are the same person.
  PERMISSION_SELF_ROLE: "error.permission.self_role",
  // An Admin always holds every action, so even a Manager with permission.manage can't strip it from the Admins.
  PERMISSION_ADMIN_ROLE: "error.permission.admin_role",

  // Password links: ONE code for unknown/expired/used/revoked, so a stale link never reveals if the account exists.
  PASSWORD_TOKEN_INVALID: "error.passwordToken.invalid",

  // POS passcode (spec.md "POS passcode and lock"): one code for an unknown device, person or membership.
  VALIDATION_PASSCODE_FORMAT: "error.validation.passcode_format",
  POS_DEVICE_UNKNOWN: "error.posDevice.unknown",
  POS_PASSCODE_WRONG: "error.posDevice.passcode_wrong",
  // Too many wrong tries, or no passcode set: only the password signs this person in here.
  POS_PASSCODE_LOCKED: "error.posDevice.passcode_locked",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
