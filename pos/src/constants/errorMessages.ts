import { ERROR_CODES } from "@store/shared/constants/errors";

// Backend codes mapped to flat message keys (nested JSON can't hold a code that is also a parent); only codes the POS can provoke.
export const ERROR_MESSAGE_KEYS: Record<string, string> = {
  [ERROR_CODES.NOT_FOUND]: "errors.notFound",
  [ERROR_CODES.VALIDATION]: "errors.validation",
  [ERROR_CODES.INTERNAL]: "errors.internal",
  [ERROR_CODES.UNAUTHORIZED]: "errors.unauthorized",
  [ERROR_CODES.FORBIDDEN]: "errors.forbidden",
  [ERROR_CODES.ACCOUNT_INACTIVE]: "errors.accountInactive",
  // The emailed-link form is rate-limited per address, so the POS can see this too.
  [ERROR_CODES.RATE_LIMITED]: "errors.rateLimited",

  [ERROR_CODES.VALIDATION_REQUIRED]: "errors.validationRequired",
  [ERROR_CODES.VALIDATION_INVALID_NUMBER]: "errors.validationInvalidNumber",
  [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: "errors.validationOutOfRange",
  [ERROR_CODES.VALIDATION_INVALID_PHONE]: "errors.validationInvalidPhone",
  [ERROR_CODES.VALIDATION_INVALID_EMAIL]: "errors.validationInvalidEmail",
  [ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT]: "errors.validationPasswordTooShort",
  [ERROR_CODES.PHONE_DUPLICATE]: "errors.phoneDuplicate",
  [ERROR_CODES.WHATSAPP_DUPLICATE]: "errors.whatsappDuplicate",
  [ERROR_CODES.PROFILE_WRONG_PASSWORD]: "errors.profileWrongPassword",
  [ERROR_CODES.PROFILE_SESSION_NOT_FOUND]: "errors.profileSessionNotFound",
  [ERROR_CODES.PROFILE_PASSKEY_NOT_FOUND]: "errors.profilePasskeyNotFound",

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
  [ERROR_CODES.ORDER_ITEM_SOURCE_INVALID]: "errors.orderItemSourceInvalid",
  [ERROR_CODES.ORDER_CREDIT_INVALID]: "errors.orderCreditInvalid",
  [ERROR_CODES.ORDER_PAYMENT_EXCEEDS_BALANCE]: "errors.orderPaymentExceedsBalance",
  [ERROR_CODES.CUSTOMER_NOT_FOUND]: "errors.customerNotFound",
  [ERROR_CODES.CUSTOMER_PHONE_TAKEN]: "errors.customerPhoneTaken",
  [ERROR_CODES.VALIDATION_PASSCODE_FORMAT]: "errors.passcodeFormat",
  [ERROR_CODES.POS_DEVICE_UNKNOWN]: "errors.posDeviceUnknown",
  [ERROR_CODES.POS_PASSCODE_WRONG]: "errors.posPasscodeWrong",
  [ERROR_CODES.POS_PASSCODE_LOCKED]: "errors.posPasscodeLocked",
};

export const FALLBACK_ERROR_MESSAGE_KEY = "errors.internal";

// Every backend error code starts with this; anything else in a field error is already a screen key.
export const BACKEND_ERROR_PREFIX = "error.";
