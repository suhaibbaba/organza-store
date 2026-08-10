import {
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_FIELDS,
  CHANGE_REQUEST_VALUE_KINDS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@organza/shared/constants/changeRequest";
import type { ChangeRequestStatus, ChangeRequestValue } from "@organza/shared/types/changeRequest";

// Which translation key describes a given gated change.
//
// The API sends (entityType, field) and nothing else — no wording ever
// crosses it (CLAUDE.md rule 12) — so the mapping from that pair to a label
// lives here, once, rather than as a switch inside every component that draws
// a request. An unknown pair (a field gated by a newer backend than this
// build) falls back to a generic label instead of rendering a raw column name.
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
};

export function changeRequestLabelKey(entityType: string, field: string): string {
  return FIELD_LABEL_KEYS[`${entityType}:${field}`] ?? "fields.other";
}

/**
 * What the "requested" side of a decided request should actually say.
 *
 * For every gated field but one it is simply the value that was asked for: a
 * price of 39.00 stays 39.00 whether the Admin agreed to it or not, and the
 * request's own status (drawn separately, see change-request-status-badge)
 * says which happened.
 *
 * The exception is the `approval` kind — an expense, where the FIELD being
 * changed is itself an approval status. Every one of those requests asks for
 * the same thing (PENDING → APPROVED), so a refused one would sit in the
 * Rejected tab reading "→ approved": the screen contradicting itself. Once
 * decided, the request's outcome IS what the field became — approving writes
 * APPROVED onto the expense, refusing writes REJECTED — so that is what is
 * shown. The two vocabularies are the same three words on purpose
 * (CHANGE_REQUEST_STATUSES / EXPENSE_APPROVAL_STATUSES).
 */
export function resolveRequestedValue(
  newValue: ChangeRequestValue | null,
  status: ChangeRequestStatus
): ChangeRequestValue | null {
  if (!newValue || newValue.kind !== CHANGE_REQUEST_VALUE_KINDS.APPROVAL) return newValue;
  if (status === PENDING_CHANGE_REQUEST_STATUS) return newValue;
  return { ...newValue, value: status };
}
