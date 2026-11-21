import {
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_FIELDS,
  CHANGE_REQUEST_VALUE_KINDS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@store/shared/constants/changeRequest";
import type { ChangeRequestStatus, ChangeRequestValue } from "@store/shared/types/changeRequest";

// The API sends only (entityType, field) (rule 12); an unknown pair gets a generic label.
const FIELD_LABEL_KEYS: Record<string, string> = {
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE}`]: "fields.price",
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_COMPARE_AT_PRICE}`]: "fields.comparePrice",
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}`]: "fields.stock",
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE}`]: "fields.visibility",
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET}`]: "fields.variantSet",
  [`${CHANGE_REQUEST_ENTITIES.VARIANT}:${CHANGE_REQUEST_FIELDS.VARIANT_PRICE_OVERRIDE}`]: "fields.variantPrice",
  [`${CHANGE_REQUEST_ENTITIES.VARIANT}:${CHANGE_REQUEST_FIELDS.VARIANT_STOCK}`]: "fields.variantStock",
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE}:${CHANGE_REQUEST_FIELDS.IMAGE_DELETION}`]: "fields.photoDeletion",
  [`${CHANGE_REQUEST_ENTITIES.EXPENSE}:${CHANGE_REQUEST_FIELDS.EXPENSE_APPROVAL}`]: "fields.expense",
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION}`]: "fields.completion",
};

export function changeRequestLabelKey(entityType: string, field: string): string {
  return FIELD_LABEL_KEYS[`${entityType}:${field}`] ?? "fields.other";
}

// A quick-sold request reviews a completed sale; it must never read as "approve", which implies refusing undoes it.
export function isQuickSoldRequest(request: { entityType: string; field: string }): boolean {
  return (
    request.entityType === CHANGE_REQUEST_ENTITIES.PRODUCT && request.field === CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION
  );
}

// An expense's field is its approval status, so once decided show the outcome, not the always-"approved" ask.
export function resolveRequestedValue(
  newValue: ChangeRequestValue | null,
  status: ChangeRequestStatus,
): ChangeRequestValue | null {
  if (!newValue || newValue.kind !== CHANGE_REQUEST_VALUE_KINDS.APPROVAL) {
    return newValue;
  }
  if (status === PENDING_CHANGE_REQUEST_STATUS) {
    return newValue;
  }
  return { ...newValue, value: status };
}
