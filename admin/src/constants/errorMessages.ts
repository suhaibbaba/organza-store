import { ERROR_CODES } from "@shared/constants/errors";

// Backend error codes (e.g. "error.validation.required") can't be used as
// next-intl message paths directly — "error.validation" is both a leaf code
// and the parent of "error.validation.required", which nested JSON can't
// represent. This maps each backend code to a flat, collision-free message
// key instead. Keep in sync with ERROR_CODES and messages/*.json#errors.
export const ERROR_MESSAGE_KEYS: Record<string, string> = {
  [ERROR_CODES.NOT_FOUND]: "errors.notFound",
  [ERROR_CODES.VALIDATION]: "errors.validation",
  [ERROR_CODES.INTERNAL]: "errors.internal",
  [ERROR_CODES.UNAUTHORIZED]: "errors.unauthorized",
  [ERROR_CODES.FORBIDDEN]: "errors.forbidden",
  [ERROR_CODES.ACCOUNT_INACTIVE]: "errors.accountInactive",

  [ERROR_CODES.DUPLICATE]: "errors.duplicate",
  [ERROR_CODES.SKU_DUPLICATE]: "errors.skuDuplicate",
  [ERROR_CODES.BARCODE_DUPLICATE]: "errors.barcodeDuplicate",
  [ERROR_CODES.SLUG_DUPLICATE]: "errors.slugDuplicate",
  [ERROR_CODES.EMAIL_DUPLICATE]: "errors.emailDuplicate",
  [ERROR_CODES.PHONE_DUPLICATE]: "errors.phoneDuplicate",
  [ERROR_CODES.WHATSAPP_DUPLICATE]: "errors.whatsappDuplicate",

  [ERROR_CODES.VALIDATION_REQUIRED]: "errors.validationRequired",
  [ERROR_CODES.VALIDATION_INVALID_NUMBER]: "errors.validationInvalidNumber",
  [ERROR_CODES.VALIDATION_INVALID_PHONE]: "errors.validationInvalidPhone",
  [ERROR_CODES.VALIDATION_INVALID_EMAIL]: "errors.validationInvalidEmail",
  [ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT]: "errors.validationPasswordTooShort",
  [ERROR_CODES.VALIDATION_IMAGE_POINT_OUT_OF_RANGE]: "errors.validationImagePointOutOfRange",

  [ERROR_CODES.CATEGORY_NOT_FOUND]: "errors.categoryNotFound",
  [ERROR_CODES.CATEGORY_CIRCULAR_PARENT]: "errors.categoryCircularParent",
  [ERROR_CODES.CATEGORY_HAS_CHILDREN]: "errors.categoryHasChildren",
  [ERROR_CODES.CATEGORY_HAS_PRODUCTS]: "errors.categoryHasProducts",

  [ERROR_CODES.PRODUCT_NOT_FOUND]: "errors.productNotFound",
  [ERROR_CODES.VARIANT_NOT_FOUND]: "errors.variantNotFound",

  [ERROR_CODES.VARIANT_TYPE_NOT_FOUND]: "errors.variantTypeNotFound",
  [ERROR_CODES.VARIANT_TYPE_VALUE_NOT_FOUND]: "errors.variantTypeValueNotFound",
  [ERROR_CODES.VARIANT_TYPE_VALUE_DUPLICATE]: "errors.variantTypeValueDuplicate",

  [ERROR_CODES.IMAGE_INVALID_TYPE]: "errors.imageInvalidType",
  [ERROR_CODES.IMAGE_TOO_LARGE]: "errors.imageTooLarge",
  [ERROR_CODES.IMAGE_UPLOAD_FAILED]: "errors.imageUploadFailed",
  [ERROR_CODES.IMAGE_FILE_REQUIRED]: "errors.imageFileRequired",
  [ERROR_CODES.IMAGE_NOT_FOUND]: "errors.imageNotFound",
  [ERROR_CODES.IMAGE_OWNER_REQUIRED]: "errors.imageOwnerRequired",
  [ERROR_CODES.IMAGE_REORDER_DUPLICATE]: "errors.imageReorderDuplicate",
  [ERROR_CODES.IMAGE_REORDER_MISMATCH]: "errors.imageReorderMismatch",

  [ERROR_CODES.INVENTORY_PARENT_HAS_VARIANTS]: "errors.inventoryParentHasVariants",

  [ERROR_CODES.ORDER_NOT_FOUND]: "errors.orderNotFound",
  [ERROR_CODES.ORDER_ITEM_NOT_FOUND]: "errors.orderItemNotFound",
  [ERROR_CODES.ORDER_ITEMS_REQUIRED]: "errors.orderItemsRequired",
  [ERROR_CODES.ORDER_CUSTOMER_REQUIRED]: "errors.orderCustomerRequired",
  [ERROR_CODES.ORDER_LOCATION_INVALID]: "errors.orderLocationInvalid",
  [ERROR_CODES.ORDER_DISCOUNT_INVALID]: "errors.orderDiscountInvalid",
  [ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION]: "errors.orderInvalidStatusTransition",
  [ERROR_CODES.ORDER_INSUFFICIENT_STOCK]: "errors.orderInsufficientStock",
  [ERROR_CODES.ORDER_NOT_EDITABLE]: "errors.orderNotEditable",
  [ERROR_CODES.ORDER_NOT_RETURNABLE]: "errors.orderNotReturnable",
  [ERROR_CODES.ORDER_RETURN_QUANTITY_EXCEEDED]: "errors.orderReturnQuantityExceeded",
  [ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE]: "errors.orderProductUnavailable",
  [ERROR_CODES.ORDER_VARIANT_REQUIRED]: "errors.orderVariantRequired",

  [ERROR_CODES.REPORT_RANGE_INVALID]: "errors.reportRangeInvalid",
  [ERROR_CODES.REPORT_RANGE_TOO_LONG]: "errors.reportRangeTooLong",

  [ERROR_CODES.SETTING_DEFAULT_LANGUAGE_NOT_SUPPORTED]: "errors.settingDefaultLanguageNotSupported",

  [ERROR_CODES.USER_NOT_FOUND]: "errors.userNotFound",
  [ERROR_CODES.AUTH_SIGNUP_FAILED]: "errors.authSignupFailed",
};

export const FALLBACK_ERROR_MESSAGE_KEY = "errors.internal";
