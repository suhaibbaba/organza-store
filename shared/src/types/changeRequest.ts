import type {
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_STATUSES,
  CHANGE_REQUEST_VALUE_KINDS,
  CHANGE_REQUEST_VARIANT_SET_ACTIONS,
} from "@/constants/changeRequest";
import type { I18n } from "@/types/common";

export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];
export type ChangeRequestEntityType = (typeof CHANGE_REQUEST_ENTITIES)[keyof typeof CHANGE_REQUEST_ENTITIES];
export type ChangeRequestValueKind =
  (typeof CHANGE_REQUEST_VALUE_KINDS)[keyof typeof CHANGE_REQUEST_VALUE_KINDS];
export type ChangeRequestVariantSetAction =
  (typeof CHANGE_REQUEST_VARIANT_SET_ACTIONS)[keyof typeof CHANGE_REQUEST_VARIANT_SET_ACTIONS];

/** Who asked, and who decided. Just id + name, like every other actor here. */
export interface ChangeRequestActor {
  id: string;
  name: string;
}

/** One variant a variantSet request would add or remove. */
export interface ChangeRequestVariantSummary {
  id?: string;
  sku?: string | null;
  name: I18n;
}

/**
 * The extra shape a compound field needs. Scalar fields (a price, a count, a
 * flag) leave it out entirely and carry everything in `value`.
 */
export interface ChangeRequestValueDetail {
  /** variantSet only: whether the request adds combinations or removes one. */
  action?: ChangeRequestVariantSetAction;
  /** variantSet only: the combinations themselves, for the "old → requested" line. */
  variants?: ChangeRequestVariantSummary[];
  /**
   * variantSet + add only: exactly what the applier re-runs on approval. The
   * option value ids are references, never copied text (CLAUDE.md rule 2), so
   * a value renamed while the request waits still resolves correctly.
   */
  optionSelections?: { variantTypeId: string; valueIds: string[] }[];
  /** variantSet + remove only: which variant goes. */
  variantId?: string;
}

/**
 * A value on either side of a request. Data, never prose: `kind` says how to
 * read it and the frontends supply the wording through t() (CLAUDE.md rule 12).
 */
export interface ChangeRequestValue {
  kind: ChangeRequestValueKind;
  /** Money as a 2dp string, a count as an integer, a flag as a boolean. */
  value: string | number | boolean | null;
  detail?: ChangeRequestValueDetail;
}

/**
 * A pending or decided request (GET /api/change-requests).
 *
 * `entityLabel` / `entityDetail` are snapshots taken when the request was
 * filed, purely so the approval screen can say WHICH piece is being re-priced
 * without a second round trip — and so a request still reads correctly if the
 * thing it is about has since gone. They are never what the change is applied
 * to: that is always (entityType, entityId, field).
 */
export interface ChangeRequest {
  id: string;
  entityType: ChangeRequestEntityType;
  entityId: string;
  field: string;
  status: ChangeRequestStatus;

  oldValue: ChangeRequestValue | null;
  newValue: ChangeRequestValue | null;

  entityLabel: I18n | null;
  /**
   * The owning product's name — what the approval screen heads the card
   * with. Distinct from entityLabel on a variant, where the entity is the
   * combination; null where there is no product behind the request (an
   * expense), and the entity's own label is the heading instead.
   */
  productLabel: I18n | null;
  entityDetail: string | null;
  /** Where the admin screen links to, when the request is about a product. */
  productId: string | null;

  requestedBy: ChangeRequestActor | null;
  requestedById: string;
  requestedAt: string;

  decidedBy: ChangeRequestActor | null;
  decidedById: string | null;
  decidedAt: string | null;
  /** Why it was turned down, as written by whoever turned it down. */
  decisionNote: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * The pending requests hanging off one product, its variants and its images —
 * attached to every product response so an Employee's screen can say "waiting
 * for approval" next to the value they changed, instead of appearing to have
 * dropped their edit.
 */
export type PendingChange = ChangeRequest;

/** GET /api/change-requests/count — what the nav badge shows. */
export interface ChangeRequestCount {
  pending: number;
}

/**
 * POST /api/change-requests/:id/cancel — the asker took it back.
 *
 * There is no request to return: withdrawing removes the row (what was asked
 * for stays in the audit trail), so the id is all there is left to say.
 */
export interface ChangeRequestCancelled {
  id: string;
  cancelled: boolean;
}
