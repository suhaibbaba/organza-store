// Backend error codes — translation KEYS only (CLAUDE.md rule 12), never
// literal sentences. Every frontend renders these via t().
export const ERROR_CODES = {
  NOT_FOUND: "error.not_found",
  VALIDATION: "error.validation",
  INTERNAL: "error.internal",
  UNAUTHORIZED: "error.unauthorized",
  FORBIDDEN: "error.forbidden",
  ACCOUNT_INACTIVE: "error.account.inactive",

  DUPLICATE: "error.duplicate",
  SKU_DUPLICATE: "error.sku.duplicate",
  BARCODE_DUPLICATE: "error.barcode.duplicate",
  SLUG_DUPLICATE: "error.slug.duplicate",
  EMAIL_DUPLICATE: "error.email.duplicate",
  PHONE_DUPLICATE: "error.phone.duplicate",
  WHATSAPP_DUPLICATE: "error.whatsapp.duplicate",

  VALIDATION_REQUIRED: "error.validation.required",
  VALIDATION_INVALID_NUMBER: "error.validation.invalid_number",
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

  REPORT_RANGE_INVALID: "error.report.range_invalid",
  REPORT_RANGE_TOO_LONG: "error.report.range_too_long",

  SETTING_DEFAULT_LANGUAGE_NOT_SUPPORTED: "error.setting.default_language_not_supported",

  USER_NOT_FOUND: "error.user.not_found",
  AUTH_SIGNUP_FAILED: "error.auth.signup_failed",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
