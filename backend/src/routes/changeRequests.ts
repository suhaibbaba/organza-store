import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { queueOwnerSync } from "@/lib/search";
import { queueMarkedImages } from "@/lib/markedImage";
import { changeRequestInclude, serializeChangeRequest } from "@/lib/changeRequests";
import {
  DECIDER_PERMISSIONS,
  applierFor,
  decisionPermissionFor,
  fieldsDecidableBy,
  type ApplyOutcome,
} from "@/lib/changeRequestAppliers";
import {
  decideChangeRequestSchema,
  listChangeRequestsQuerySchema,
  type DecideChangeRequestInput,
  type ListChangeRequestsQuery,
} from "@/validation/changeRequest";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  AUDIT_ENTITY,
  ERROR_CODES,
  PENDING_CHANGE_REQUEST_STATUS,
  REJECTED_CHANGE_REQUEST_STATUS,
  CHANGE_REQUEST_ENTITIES,
} from "@/constants";
import type { ChangeRequestStatus } from "@/types";

// Change requests: one endpoint pair for every gated change; without changeRequest.approve you see only your own.
const router = Router();
router.use(requireAuth);

async function loadRequest(id: string) {
  const request = await prisma.changeRequest.findUnique({ where: { id }, include: changeRequestInclude });
  if (!request) {
    throw new AppError(404, ERROR_CODES.CHANGE_REQUEST_NOT_FOUND);
  }
  return request;
}

/** What this caller may read: null for Admins, else their own requests plus fields they decide (quick sell for Managers). */
function visibleRequestScope(user: { id: string; role: string }): Prisma.ChangeRequestWhereInput | null {
  if (can(user, "changeRequest.approve")) {
    return null;
  }

  const decidable = DECIDER_PERMISSIONS.filter(
    (action) => action !== "changeRequest.approve" && can(user, action),
  ).flatMap(fieldsDecidableBy);

  return {
    OR: [{ requestedById: user.id }, ...decidable.map(({ entityType, field }) => ({ entityType, field }))],
  };
}

/** ...and whether they may read this ONE request. Same rule, one row. */
function mayReadRequest(
  user: { id: string; role: string },
  request: { entityType: string; field: string; requestedById: string },
): boolean {
  if (can(user, "changeRequest.approve")) {
    return true;
  }
  if (request.requestedById === user.id) {
    return true;
  }
  return can(user, decisionPermissionFor(request.entityType, request.field));
}

// GET /api/change-requests — list (pagination + filtering + sorting)
router.get(
  "/",
  requirePermission("changeRequest.view"),
  validateQuery(listChangeRequestsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListChangeRequestsQuery;
    const where: Prisma.ChangeRequestWhereInput = {};

    if (query.status) {
      where.status = query.status as ChangeRequestStatus;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }

    // Enforced here, not in the UI: non-deciders only read their own; `mine` narrows anyone to their own.
    const scope = query.mine ? { requestedById: req.user!.id } : visibleRequestScope(req.user!);
    if (scope) {
      Object.assign(where, scope);
    }

    const orderBy: Prisma.ChangeRequestOrderByWithRelationInput =
      query.sortBy === "entityType"
        ? { entityType: query.sortDir }
        : // "createdAt" means "when was this last asked for" — a superseded
          // The row's requestedAt moves forward with a newer ask — the date the screen shows.
          { requestedAt: query.sortDir };

    const [total, requests] = await Promise.all([
      prisma.changeRequest.count({ where }),
      prisma.changeRequest.findMany({
        where,
        include: changeRequestInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    sendOk(res, requests.map(serializeChangeRequest), {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  }),
);

// GET /api/change-requests/count — the nav badge, scoped like the list; declared before /:id.
router.get(
  "/count",
  requirePermission("changeRequest.view"),
  asyncHandler(async (req, res) => {
    const pending = await prisma.changeRequest.count({
      where: {
        status: PENDING_CHANGE_REQUEST_STATUS as ChangeRequestStatus,
        // The badge counts exactly what the list would show, scoped the same way.
        ...(visibleRequestScope(req.user!) ?? {}),
      },
    });
    sendOk(res, { pending });
  }),
);

// GET /api/change-requests/:id
router.get(
  "/:id",
  requirePermission("changeRequest.view"),
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!mayReadRequest(req.user!, request)) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }
    sendOk(res, serializeChangeRequest(request));
  }),
);

// Shared by approve and reject: still open, not the asker, apply, stamp — all in one transaction.
async function decide(
  requestId: string,
  decider: { id: string; role: string },
  status: typeof APPROVED_CHANGE_REQUEST_STATUS | typeof REJECTED_CHANGE_REQUEST_STATUS,
  note: string | undefined,
) {
  const existing = await loadRequest(requestId);

  // May this person decide this at all? Asked first, by the field's permission (see decisionPermissionFor).
  if (!can(decider, decisionPermissionFor(existing.entityType, existing.field))) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN);
  }

  // Deciding something already decided would overwrite who decided — refused.
  if (existing.status !== PENDING_CHANGE_REQUEST_STATUS) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
  }
  const applier = applierFor(existing.entityType, existing.field);

  // Nobody decides their own ask, except quick sell's completion, which is data entry, not a gate.
  if (existing.requestedById === decider.id && !applier.allowSelfDecision) {
    throw new AppError(403, ERROR_CODES.CHANGE_REQUEST_SELF_DECISION);
  }

  const decidedAt = new Date();

  const { request, outcome } = await prisma.$transaction(async (tx) => {
    const ctx = { deciderId: decider.id, decidedAt };
    // Approving applies the change; rejecting discards it, writing only where an entity would be stuck (an expense).
    const result: ApplyOutcome =
      status === APPROVED_CHANGE_REQUEST_STATUS
        ? await applier.apply(tx, existing, ctx)
        : ((await applier.reject?.(tx, existing, ctx)) ?? { audits: [] });

    const updated = await tx.changeRequest.update({
      where: { id: existing.id },
      data: {
        status: status as ChangeRequestStatus,
        // Freed once no longer pending, so the next request for the field can take the slot.
        pendingKey: null,
        decidedById: decider.id,
        decidedAt,
        decisionNote: note ?? null,
      },
      include: changeRequestInclude,
    });

    return { request: updated, outcome: result };
  });

  // The decision is audited separately from what it changed (rule 6).
  await writeAudit({
    userId: decider.id,
    action: status === APPROVED_CHANGE_REQUEST_STATUS ? AuditAction.APPROVE : AuditAction.REJECT,
    entityType: AUDIT_ENTITY.CHANGE_REQUEST,
    entityId: request.id,
    oldValue: {
      status: existing.status,
      requestedById: existing.requestedById,
      entityType: existing.entityType,
      entityId: existing.entityId,
      field: existing.field,
      value: existing.oldValue,
    },
    newValue: { status: request.status, value: request.newValue, decisionNote: request.decisionNote },
  });

  // …and the change itself, attributed to whoever approved it.
  for (const entry of outcome.audits) {
    await writeAudit({ ...entry, userId: decider.id });
  }

  // Only after commit: deleting image files cannot be rolled back.
  if (outcome.afterCommit) {
    await outcome.afterCommit();
  }

  // Whatever the decision changed (price, stock, visibility, variants, an image, a one-off) is re-indexed.
  await queueOwnerSync({
    productId: request.productId ?? (request.entityType === CHANGE_REQUEST_ENTITIES.PRODUCT ? request.entityId : null),
    variantId: request.entityType === CHANGE_REQUEST_ENTITIES.VARIANT ? request.entityId : null,
  });
  queueMarkedImages([
    request.productId ?? (request.entityType === CHANGE_REQUEST_ENTITIES.PRODUCT ? request.entityId : null),
  ]);

  return request;
}

// POST /api/change-requests/:id/approve — apply it, atomically.
router.post(
  "/:id/approve",
  // The read gate only; decide() applies the field's own permission, unknowable from the URL.
  requirePermission("changeRequest.view"),
  validateBody(decideChangeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as DecideChangeRequestInput;
    const request = await decide(req.params.id, req.user!, APPROVED_CHANGE_REQUEST_STATUS, body.note);
    sendOk(res, serializeChangeRequest(request));
  }),
);

// POST /api/change-requests/:id/reject — discard it; the request stays on record with who and why.
router.post(
  "/:id/reject",
  // Same as approve above: gated per field inside decide().
  requirePermission("changeRequest.view"),
  validateBody(decideChangeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as DecideChangeRequestInput;
    const request = await decide(req.params.id, req.user!, REJECTED_CHANGE_REQUEST_STATUS, body.note);
    sendOk(res, serializeChangeRequest(request));
  }),
);

// POST /api/change-requests/:id/cancel — withdraw your own pending ask; refused once decided.
router.post(
  "/:id/cancel",
  requirePermission("changeRequest.cancel"),
  asyncHandler(async (req, res) => {
    const existing = await loadRequest(req.params.id);

    // Yours only, enforced here (rule 5), with no Admin override — Admins have reject.
    if (existing.requestedById !== req.user!.id) {
      throw new AppError(403, ERROR_CODES.CHANGE_REQUEST_NOT_REQUESTER);
    }
    // Already answered. Withdrawing it now would erase the answer.
    if (existing.status !== PENDING_CHANGE_REQUEST_STATUS) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
    }

    await prisma.changeRequest.delete({ where: { id: existing.id } });

    // The withdrawn value is kept in the audit trail (rule 6), in the same shape as the request entry.
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CANCEL,
      entityType: AUDIT_ENTITY.CHANGE_REQUEST,
      entityId: existing.id,
      oldValue: {
        status: existing.status,
        entityType: existing.entityType,
        entityId: existing.entityId,
        field: existing.field,
        requestedById: existing.requestedById,
        requestedAt: existing.requestedAt,
        value: existing.newValue,
      },
      newValue: null,
    });

    sendOk(res, { id: existing.id, cancelled: true });
  }),
);

export default router;
