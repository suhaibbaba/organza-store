import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS } from "@shared/constants/changeRequest";

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
