import type { Prisma } from "@prisma/client";
import type {
  ChangeRequest,
  ChangeRequestActor,
  ChangeRequestCancelled,
  ChangeRequestEntityType,
  ChangeRequestStatus,
  ChangeRequestValue,
  ChangeRequestValueDetail,
  ChangeRequestValueKind,
  ChangeRequestVariantSummary,
  ChangeRequestCount,
  PendingChange,
} from "@organza/shared/types/changeRequest";

export type {
  ChangeRequest,
  ChangeRequestActor,
  ChangeRequestCancelled,
  ChangeRequestCount,
  ChangeRequestEntityType,
  ChangeRequestStatus,
  ChangeRequestValue,
  ChangeRequestValueDetail,
  ChangeRequestValueKind,
  ChangeRequestVariantSummary,
  PendingChange,
};

// Anything that can run a query: the client itself, or the transaction client
// handed to a $transaction callback. Appliers take one of these so that
// approving a change and writing its audit entry are one atomic unit.
export type DbClient = Prisma.TransactionClient;

/** Who is asking for, or deciding, a change. */
export interface ChangeRequestActorRef {
  id: string;
  role: string;
}

/**
 * Everything needed to file one request. The caller (a route that just
 * refused to apply something) describes WHAT it would have done; nothing here
 * knows which entity that is beyond the triple.
 */
export interface ChangeRequestDraft {
  entityType: ChangeRequestEntityType;
  entityId: string;
  field: string;
  oldValue: ChangeRequestValue;
  newValue: ChangeRequestValue;
  /** Snapshots for the approval screen — see the schema comment. */
  entityLabel?: unknown;
  /**
   * The owning product's name. Set it on every draft that HAS a product,
   * whether the entity is the product, one of its variants or one of its
   * photos — it is what the approval screen heads the card with, and without
   * it a variant request names only the combination.
   */
  productLabel?: unknown;
  entityDetail?: string | null;
  productId?: string | null;
}

/** One entity type + field pair, and how to apply an approved change to it. */
export interface ChangeRequestApplier {
  /**
   * Applies the requested value. Runs inside the approval's transaction, so
   * throwing leaves the request pending and the entity untouched.
   */
  apply: (tx: DbClient, request: AppliedChangeRequestRow) => Promise<void>;
}

/** The columns an applier reads off the request row it is applying. */
export interface AppliedChangeRequestRow {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  requestedById: string;
}
