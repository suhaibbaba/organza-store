import type {
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_STATUSES,
  CHANGE_REQUEST_VALUE_KINDS,
  CHANGE_REQUEST_VARIANT_SET_ACTIONS,
} from "@/constants/changeRequest";
import type { I18n } from "@/types/common";

export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];
export type ChangeRequestEntityType = (typeof CHANGE_REQUEST_ENTITIES)[keyof typeof CHANGE_REQUEST_ENTITIES];
export type ChangeRequestValueKind = (typeof CHANGE_REQUEST_VALUE_KINDS)[keyof typeof CHANGE_REQUEST_VALUE_KINDS];
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

/** Extra shape for compound fields; scalar fields carry everything in `value`. */
export interface ChangeRequestValueDetail {
  /** variantSet only: whether the request adds combinations or removes one. */
  action?: ChangeRequestVariantSetAction;
  /** variantSet only: the combinations themselves, for the "old → requested" line. */
  variants?: ChangeRequestVariantSummary[];
  /** variantSet add only: what the applier re-runs, with value ids as references (rule 2), so renames still resolve. */
  optionSelections?: { variantTypeId: string; valueIds: string[] }[];
  comboStocks?: { valueIds: string[]; stock: number }[];
  /** variantSet + remove only: which variant goes. */
  variantId?: string;

  /** quickSell only: the sale already made, snapshotted at filing, which makes the card "complete its details" (spec.md "Quick sell"). */
  sale?: {
    orderId: string;
    orderNumber: number;
    quantity: number;
    /** What the cashier typed beside the name — a colour, a size, a number. */
    detail?: string | null;
  };
}

/** A request value as data, never prose: `kind` says how to read it, the apps word it via t() (rule 12). */
export interface ChangeRequestValue {
  kind: ChangeRequestValueKind;
  /** Money as a 2dp string, a count as an integer, a flag as a boolean. */
  value: string | number | boolean | null;
  detail?: ChangeRequestValueDetail;
}

/** entityLabel/entityDetail are display snapshots from filing; the change always applies to (entityType, entityId, field). */
export interface ChangeRequest {
  id: string;
  entityType: ChangeRequestEntityType;
  entityId: string;
  field: string;
  status: ChangeRequestStatus;

  oldValue: ChangeRequestValue | null;
  newValue: ChangeRequestValue | null;

  entityLabel: I18n | null;
  /** The owning product's name for the card heading; null without a product (an expense). */
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

/** Pending requests on a product, its variants and images, so an Employee sees "waiting for approval" beside their edit. */
export type PendingChange = ChangeRequest;

/** GET /api/change-requests/count — what the nav badge shows. */
export interface ChangeRequestCount {
  pending: number;
}

/** Withdrawing removes the row (the audit trail keeps it), so only the id is returned. */
export interface ChangeRequestCancelled {
  id: string;
  cancelled: boolean;
}
