import { ERROR_CODES } from "@shared/constants/errors";

// Backend error codes (e.g. "error.validation.required") can't be used as
// next-intl message paths directly — "error.validation" is both a leaf code
// and the parent of "error.validation.required", which nested JSON can't
// represent. This maps each backend code to a flat, collision-free message
// key instead. Keep in sync with ERROR_CODES and messages/*.json#errors.
//
// Only the codes this app can actually provoke are listed: the POS reads
// products and writes orders, so product/order/auth codes are covered and
// the admin-only ones (categories, images, users, settings) are not —
// anything unmapped falls back to the generic message below, which is the
// right outcome for a code the counter can do nothing about anyway.
export const ERROR_MESSAGE_KEYS: Record<string, string> = {
  [ERROR_CODES.NOT_FOUND]: "errors.notFound",
  [ERROR_CODES.VALIDATION]: "errors.validation",
  [ERROR_CODES.INTERNAL]: "errors.internal",
  [ERROR_CODES.UNAUTHORIZED]: "errors.unauthorized",
  [ERROR_CODES.FORBIDDEN]: "errors.forbidden",
  [ERROR_CODES.ACCOUNT_INACTIVE]: "errors.accountInactive",

  [ERROR_CODES.VALIDATION_REQUIRED]: "errors.validationRequired",
  [ERROR_CODES.VALIDATION_INVALID_NUMBER]: "errors.validationInvalidNumber",
  [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: "errors.validationOutOfRange",
  [ERROR_CODES.VALIDATION_INVALID_PHONE]: "errors.validationInvalidPhone",
  [ERROR_CODES.VALIDATION_INVALID_EMAIL]: "errors.validationInvalidEmail",
  [ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT]: "errors.validationPasswordTooShort",

  [ERROR_CODES.PRODUCT_NOT_FOUND]: "errors.productNotFound",
  [ERROR_CODES.VARIANT_NOT_FOUND]: "errors.variantNotFound",

  [ERROR_CODES.ORDER_NOT_FOUND]: "errors.orderNotFound",
  [ERROR_CODES.ORDER_ITEMS_REQUIRED]: "errors.orderItemsRequired",
  [ERROR_CODES.ORDER_CUSTOMER_REQUIRED]: "errors.orderCustomerRequired",
  [ERROR_CODES.ORDER_LOCATION_INVALID]: "errors.orderLocationInvalid",
  [ERROR_CODES.ORDER_DISCOUNT_INVALID]: "errors.orderDiscountInvalid",
  [ERROR_CODES.ORDER_INSUFFICIENT_STOCK]: "errors.orderInsufficientStock",
  [ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE]: "errors.orderProductUnavailable",
  [ERROR_CODES.ORDER_VARIANT_REQUIRED]: "errors.orderVariantRequired",
};

export const FALLBACK_ERROR_MESSAGE_KEY = "errors.internal";
