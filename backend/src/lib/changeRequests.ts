import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { isGatedField } from "@/lib/changeRequestAppliers";
import { scheduleChangeRequestNotification } from "@/lib/changeRequestNotifications";
import {
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_VALUE_KINDS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@/constants";
import type {
  AnyRecord,
  ChangeRequestActorRef,
  ChangeRequestDraft,
  ChangeRequestValue,
  ChangeRequestValueDetail,
  DbClient,
} from "@/types";

// Filing, superseding and reading change requests, entity-agnostic; superseding is enforced by the unique pendingKey.

export const changeRequestInclude = {
  // Just id + name of whoever asked or decided — the same shape, and the same reasoning, as an order's createdBy.
  requestedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
} satisfies Prisma.ChangeRequestInclude;

// Values carry a rendering hint (`kind`), never a sentence (rule 12); the wording is the frontend's.

export function moneyValue(value: Prisma.Decimal | string | number | null | undefined): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.MONEY, value: formatMoney(value ?? null) };
}

export function countValue(value: number): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.COUNT, value };
}

export function flagValue(value: boolean): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.FLAG, value };
}

export function deletionValue(deleted: boolean): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.DELETION, value: deleted };
}

export function approvalValue(status: string): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.APPROVAL, value: status };
}

export function variantSetValue(count: number, detail: ChangeRequestValueDetail): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.VARIANT_SET, value: count, detail };
}

/** A sale that already happened (quick sell): the price it went for and its order — "sold for X", there is no old value. */
export function quickSellValue(
  price: Prisma.Decimal | string | number,
  detail: ChangeRequestValueDetail,
): ChangeRequestValue {
  return { kind: CHANGE_REQUEST_VALUE_KINDS.QUICK_SELL, value: formatMoney(price), detail };
}

// --- filing ----------------------------------------------------------------

function pendingKeyFor(draft: Pick<ChangeRequestDraft, "entityType" | "entityId" | "field">): string {
  return `${draft.entityType}:${draft.entityId}:${draft.field}`;
}

// Prisma's unique-constraint code, reached only by two simultaneous asks; the answer is to re-read and replace.
const UNIQUE_VIOLATION = "P2002";

async function upsertPending(actor: ChangeRequestActorRef, draft: ChangeRequestDraft) {
  const pendingKey = pendingKeyFor(draft);
  const requestedAt = new Date();
  const data = {
    entityType: draft.entityType,
    entityId: draft.entityId,
    field: draft.field,
    oldValue: draft.oldValue as never,
    newValue: draft.newValue as never,
    entityLabel: (draft.entityLabel ?? null) as never,
    productLabel: (draft.productLabel ?? null) as never,
    entityDetail: draft.entityDetail ?? null,
    productId: draft.productId ?? null,
    requestedById: actor.id,
    requestedAt,
  };

  const existing = await prisma.changeRequest.findUnique({ where: { pendingKey }, include: changeRequestInclude });
  if (existing) {
    // Replaced in place, not queued behind: the newest ask is the only one anybody should be deciding on.
    const updated = await prisma.changeRequest.update({
      where: { id: existing.id },
      data,
      include: changeRequestInclude,
    });
    return { request: updated, superseded: existing };
  }

  const created = await prisma.changeRequest.create({
    data: { ...data, pendingKey, status: PENDING_CHANGE_REQUEST_STATUS as never },
    include: changeRequestInclude,
  });
  return { request: created, superseded: null };
}

/** Records a change someone may not make themselves; returned so the screen shows the edit held, not dropped. */
export async function fileChangeRequest(actor: ChangeRequestActorRef, draft: ChangeRequestDraft): Promise<AnyRecord> {
  // A field nothing can apply must never become a pending row.
  if (!isGatedField(draft.entityType, draft.field)) {
    throw new Error(`No change-request applier registered for ${draft.entityType}.${draft.field}`);
  }

  let result: Awaited<ReturnType<typeof upsertPending>>;
  try {
    result = await upsertPending(actor, draft);
  } catch (error) {
    // Someone else filed for the same field between read and write; this pass finds and replaces theirs.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      result = await upsertPending(actor, draft);
    } else {
      throw error;
    }
  }

  const { request, superseded } = result;

  // Both halves are audited (rule 6): the ask, and any older ask it displaced.
  await writeAudit({
    userId: actor.id,
    action: superseded ? AuditAction.SUPERSEDE : AuditAction.REQUEST,
    entityType: AUDIT_ENTITY.CHANGE_REQUEST,
    entityId: request.id,
    oldValue: superseded
      ? { requestedById: superseded.requestedById, requestedAt: superseded.requestedAt, newValue: superseded.newValue }
      : { entityType: request.entityType, entityId: request.entityId, field: request.field, value: request.oldValue },
    newValue: {
      entityType: request.entityType,
      entityId: request.entityId,
      field: request.field,
      value: request.newValue,
    },
  });

  // Fire-and-forget: a failed push never fails the ask.
  scheduleChangeRequestNotification(request, actor);

  return request;
}

/** The same filing inside the caller's transaction, so quick sell's product, sale and request commit together. */
export async function fileChangeRequestInTransaction(
  tx: DbClient,
  actor: ChangeRequestActorRef,
  draft: ChangeRequestDraft,
): Promise<AnyRecord> {
  if (!isGatedField(draft.entityType, draft.field)) {
    throw new Error(`No change-request applier registered for ${draft.entityType}.${draft.field}`);
  }

  return tx.changeRequest.create({
    data: {
      entityType: draft.entityType,
      entityId: draft.entityId,
      field: draft.field,
      oldValue: draft.oldValue as never,
      newValue: draft.newValue as never,
      entityLabel: (draft.entityLabel ?? null) as never,
      productLabel: (draft.productLabel ?? null) as never,
      entityDetail: draft.entityDetail ?? null,
      productId: draft.productId ?? null,
      requestedById: actor.id,
      requestedAt: new Date(),
      pendingKey: pendingKeyFor(draft),
      status: PENDING_CHANGE_REQUEST_STATUS as never,
    },
    include: changeRequestInclude,
  });
}

/** The audit entry and push owed by a request filed inside a transaction, sent after it commits. */
export async function announceFiledChangeRequest(request: AnyRecord, actor: ChangeRequestActorRef): Promise<void> {
  await writeAudit({
    userId: actor.id,
    action: AuditAction.REQUEST,
    entityType: AUDIT_ENTITY.CHANGE_REQUEST,
    entityId: request.id,
    oldValue: {
      entityType: request.entityType,
      entityId: request.entityId,
      field: request.field,
      value: request.oldValue,
    },
    newValue: {
      entityType: request.entityType,
      entityId: request.entityId,
      field: request.field,
      value: request.newValue,
    },
  });

  scheduleChangeRequestNotification(request, actor);
}

/** Files several drafts at once — one save that touched a price AND the visibility. */
export async function fileChangeRequests(
  actor: ChangeRequestActorRef,
  drafts: ChangeRequestDraft[],
): Promise<AnyRecord[]> {
  const filed: AnyRecord[] = [];
  for (const draft of drafts) {
    filed.push(await fileChangeRequest(actor, draft));
  }
  return filed;
}

// --- reading ---------------------------------------------------------------

/** Everything pending on one product (its fields, variants and images), in one bounded query. */
export async function findPendingChangesForProduct(product: {
  id: string;
  variants?: { id: string }[];
  images?: { id: string }[];
}): Promise<AnyRecord[]> {
  const variantIds = (product.variants ?? []).map((v) => v.id);
  const imageIds = (product.images ?? []).map((i) => i.id);

  return prisma.changeRequest.findMany({
    where: {
      status: PENDING_CHANGE_REQUEST_STATUS as never,
      OR: [
        { entityType: CHANGE_REQUEST_ENTITIES.PRODUCT, entityId: product.id },
        ...(variantIds.length ? [{ entityType: CHANGE_REQUEST_ENTITIES.VARIANT, entityId: { in: variantIds } }] : []),
        ...(imageIds.length ? [{ entityType: CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE, entityId: { in: imageIds } }] : []),
      ],
    },
    include: changeRequestInclude,
    orderBy: { requestedAt: "desc" },
  });
}

/** Pending requests for a batch of entities, grouped by id — one query for a whole inventory page. */
export async function findPendingChangesByEntity(
  targets: { entityType: string; entityId: string }[],
): Promise<Map<string, AnyRecord[]>> {
  const grouped = new Map<string, AnyRecord[]>();
  if (targets.length === 0) {
    return grouped;
  }

  const byType = new Map<string, string[]>();
  for (const target of targets) {
    const ids = byType.get(target.entityType) ?? [];
    ids.push(target.entityId);
    byType.set(target.entityType, ids);
  }

  const rows = await prisma.changeRequest.findMany({
    where: {
      status: PENDING_CHANGE_REQUEST_STATUS as never,
      OR: [...byType.entries()].map(([entityType, entityIds]) => ({ entityType, entityId: { in: entityIds } })),
    },
    include: changeRequestInclude,
    orderBy: { requestedAt: "desc" },
  });

  for (const row of rows) {
    const list = grouped.get(row.entityId) ?? [];
    list.push(row);
    grouped.set(row.entityId, list);
  }
  return grouped;
}

/** Clears anything still pending on entities that have just ceased to exist. */
export async function cancelPendingChangesFor(
  client: DbClient,
  targets: { entityType: string; entityId: string }[],
): Promise<void> {
  if (targets.length === 0) {
    return;
  }
  await client.changeRequest.deleteMany({
    where: {
      status: PENDING_CHANGE_REQUEST_STATUS as never,
      OR: targets.map((t) => ({ entityType: t.entityType, entityId: t.entityId })),
    },
  });
}

// --- serialization ---------------------------------------------------------

function actor(user: AnyRecord | null | undefined) {
  return user ? { id: user.id, name: user.name } : null;
}

export function serializeChangeRequest(request: AnyRecord) {
  return {
    id: request.id,
    entityType: request.entityType,
    entityId: request.entityId,
    field: request.field,
    status: request.status,
    oldValue: request.oldValue ?? null,
    newValue: request.newValue ?? null,
    entityLabel: request.entityLabel ?? null,
    productLabel: request.productLabel ?? null,
    entityDetail: request.entityDetail ?? null,
    productId: request.productId ?? null,
    requestedById: request.requestedById,
    requestedBy: actor(request.requestedBy),
    requestedAt: request.requestedAt,
    decidedById: request.decidedById ?? null,
    decidedBy: actor(request.decidedBy),
    decidedAt: request.decidedAt ?? null,
    decisionNote: request.decisionNote ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function serializeChangeRequests(requests: AnyRecord[]) {
  return requests.map(serializeChangeRequest);
}
