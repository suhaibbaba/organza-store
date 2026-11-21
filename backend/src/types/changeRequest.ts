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
} from "@store/shared/types/changeRequest";

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

// The client or a transaction client, so an approval and its audit entry are atomic.
export type DbClient = Prisma.TransactionClient;

/** Who is asking for, or deciding, a change. */
export interface ChangeRequestActorRef {
  id: string;
  role: string;
}

/** Everything needed to file one request: the change a route just refused to apply. */
export interface ChangeRequestDraft {
  entityType: ChangeRequestEntityType;
  entityId: string;
  field: string;
  oldValue: ChangeRequestValue;
  newValue: ChangeRequestValue;
  /** Snapshots for the approval screen — see the schema comment. */
  entityLabel?: unknown;
  /** The owning product's name, set on every draft that has one — the approval card's heading. */
  productLabel?: unknown;
  entityDetail?: string | null;
  productId?: string | null;
}

/** One entity type + field pair, and how to apply an approved change to it. */
export interface ChangeRequestApplier {
  /** Applies the requested value inside the approval's transaction; throwing leaves it pending. */
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
