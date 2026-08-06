import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { can } from "@shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { changeRequestInclude, serializeChangeRequest } from "@/lib/changeRequests";
import { applierFor, type ApplyOutcome } from "@/lib/changeRequestAppliers";
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
} from "@/constants";
import type { ChangeRequestStatus } from "@/types";

// Change requests (spec.md "Employee change approvals") — one screen, one
// endpoint pair, for every gated change in the shop.
//
// The gates:
//   * changeRequest.view    — every role, but it does NOT mean "everyone's":
//                             without changeRequest.approve the list is
//                             narrowed to your own, because an Employee has
//                             to see their price change waiting rather than
//                             lost, and nothing more.
//   * changeRequest.approve — ADMIN only. Deciding is the whole point of the
//                             gate; modelled as a permission so widening it
//                             later is one entry in ROLE_PERMISSIONS.
//
// There is deliberately no POST: a request is born from the action it stands
// in for (an Employee saving a new price), never asked for directly. That is
// what keeps a request from describing a change nobody actually attempted.
const router = Router();
router.use(requireAuth);

async function loadRequest(id: string) {
  const request = await prisma.changeRequest.findUnique({ where: { id }, include: changeRequestInclude });
  if (!request) throw new AppError(404, ERROR_CODES.CHANGE_REQUEST_NOT_FOUND);
  return request;
}

// ---------------------------------------------------------------------------
// GET /api/change-requests — list (pagination + filtering + sorting)
// ---------------------------------------------------------------------------
router.get(
  "/",
  requirePermission("changeRequest.view"),
  validateQuery(listChangeRequestsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListChangeRequestsQuery;
    const where: Prisma.ChangeRequestWhereInput = {};

    if (query.status) where.status = query.status as ChangeRequestStatus;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    // Enforced here, not in the UI: someone who cannot decide requests may
    // only ever read their own, whatever they ask for.
    const seesEveryone = can(req.user!, "changeRequest.approve");
    if (!seesEveryone || query.mine) where.requestedById = req.user!.id;

    const orderBy: Prisma.ChangeRequestOrderByWithRelationInput =
      query.sortBy === "entityType"
        ? { entityType: query.sortDir }
        : // "createdAt" means "when was this last asked for" — a superseded
          // row's requestedAt moves forward with the newer ask, which is the
          // date the screen shows.
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
  })
);

// ---------------------------------------------------------------------------
// GET /api/change-requests/count — what the nav badge shows.
//
// Declared before "/:id" — Express matches in order, so a literal path
// registered after the parameter route would never be reached.
//
// Scoped the same way the list is: an Admin sees how many are waiting on
// them, everyone else how many of their own are still waiting.
// ---------------------------------------------------------------------------
router.get(
  "/count",
  requirePermission("changeRequest.view"),
  asyncHandler(async (req, res) => {
    const pending = await prisma.changeRequest.count({
      where: {
        status: PENDING_CHANGE_REQUEST_STATUS as ChangeRequestStatus,
        ...(can(req.user!, "changeRequest.approve") ? {} : { requestedById: req.user!.id }),
      },
    });
    sendOk(res, { pending });
  })
);

// ---------------------------------------------------------------------------
// GET /api/change-requests/:id
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  requirePermission("changeRequest.view"),
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!can(req.user!, "changeRequest.approve") && request.requestedById !== req.user!.id) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }
    sendOk(res, serializeChangeRequest(request));
  })
);

// The half both decisions share: check it is still open, check the decider
// isn't the asker, run whatever the field needs, and stamp the row. All of it
// in ONE transaction, so a change is either applied and recorded together or
// neither — an approval that half-applied would be worse than one that failed.
async function decide(
  requestId: string,
  decider: { id: string; role: string },
  status: typeof APPROVED_CHANGE_REQUEST_STATUS | typeof REJECTED_CHANGE_REQUEST_STATUS,
  note: string | undefined
) {
  const existing = await loadRequest(requestId);

  // Deciding something already decided is not a no-op: it would overwrite who
  // decided what, which is the one thing this record exists to hold.
  if (existing.status !== PENDING_CHANGE_REQUEST_STATUS) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
  }
  // Nobody signs off their own ask — that would make the gate decorative.
  // Reachable in principle by an Admin whose own action was gated; kept as a
  // rule of the flow rather than an accident of who holds what today.
  if (existing.requestedById === decider.id) {
    throw new AppError(403, ERROR_CODES.CHANGE_REQUEST_SELF_DECISION);
  }

  const applier = applierFor(existing.entityType, existing.field);
  const decidedAt = new Date();

  const { request, outcome } = await prisma.$transaction(async (tx) => {
    const ctx = { deciderId: decider.id, decidedAt };
    // Approving applies the change; rejecting discards it, and only the
    // entities that would otherwise be left stuck (an expense) do anything
    // at all on the way out.
    const result: ApplyOutcome =
      status === APPROVED_CHANGE_REQUEST_STATUS
        ? await applier.apply(tx, existing, ctx)
        : ((await applier.reject?.(tx, existing, ctx)) ?? { audits: [] });

    const updated = await tx.changeRequest.update({
      where: { id: existing.id },
      data: {
        status: status as ChangeRequestStatus,
        // Freed the moment it stops being pending, which is what lets the
        // next request for this same field take the slot.
        pendingKey: null,
        decidedById: decider.id,
        decidedAt,
        decisionNote: note ?? null,
      },
      include: changeRequestInclude,
    });

    return { request: updated, outcome: result };
  });

  // The decision itself (CLAUDE.md rule 6) — "who agreed to this" is a
  // different question from "what did the price become", so both are written.
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

  // ...and whatever the change did to the entity itself, attributed to
  // whoever approved it — they are the one who made it happen.
  for (const entry of outcome.audits) {
    await writeAudit({ ...entry, userId: decider.id });
  }

  // Only now, with everything committed: deleting an image's files cannot be
  // rolled back, so it must never run inside the transaction that might.
  if (outcome.afterCommit) await outcome.afterCommit();

  return request;
}

// ---------------------------------------------------------------------------
// POST /api/change-requests/:id/approve — apply it, atomically.
// ---------------------------------------------------------------------------
router.post(
  "/:id/approve",
  requirePermission("changeRequest.approve"),
  validateBody(decideChangeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as DecideChangeRequestInput;
    const request = await decide(req.params.id, req.user!, APPROVED_CHANGE_REQUEST_STATUS, body.note);
    sendOk(res, serializeChangeRequest(request));
  })
);

// ---------------------------------------------------------------------------
// POST /api/change-requests/:id/reject — discard it. The entity is not
// touched; the request stays on the record, with who turned it down and why.
// ---------------------------------------------------------------------------
router.post(
  "/:id/reject",
  requirePermission("changeRequest.approve"),
  validateBody(decideChangeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as DecideChangeRequestInput;
    const request = await decide(req.params.id, req.user!, REJECTED_CHANGE_REQUEST_STATUS, body.note);
    sendOk(res, serializeChangeRequest(request));
  })
);

export default router;
