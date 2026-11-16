import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
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
//   * product.complete      — Admin/Manager, and ONE field's decision only:
//                             finishing off a quick-sold piece (spec.md "Quick
//                             sell"). Which permission decides which field is
//                             decided by the appliers, not here
//                             (decisionPermissionFor), so these routes stay
//                             entity-agnostic. It is a separate action rather
//                             than a widened changeRequest.approve because the
//                             two are opposites: approving a gated change is
//                             permission BEFORE the fact, completing a quick
//                             sale is review AFTER money has changed hands.
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

/**
 * How much of the queue this caller may READ, as a where-clause.
 *
 * `null` means "no narrowing at all" — the Admin's view, and the only one
 * that sees somebody else's price change.
 *
 * Everybody else gets their own requests, plus whichever fields they are
 * themselves the decider for. That second half exists for quick sell (spec.md
 * "Quick sell"): a Manager holds product.complete and has to be able to find
 * the pieces waiting on them, without that turning into a licence to read the
 * gated changes an Employee filed. Derived from the appliers' own table rather
 * than hard-coded, so a future field that answers to another permission is
 * scoped correctly for free.
 */
function visibleRequestScope(user: { id: string; role: string }): Prisma.ChangeRequestWhereInput | null {
  if (can(user, "changeRequest.approve")) return null;

  const decidable = DECIDER_PERMISSIONS.filter(
    (action) => action !== "changeRequest.approve" && can(user, action)
  ).flatMap(fieldsDecidableBy);

  return {
    OR: [
      { requestedById: user.id },
      ...decidable.map(({ entityType, field }) => ({ entityType, field })),
    ],
  };
}

/** ...and whether they may read this ONE request. Same rule, one row. */
function mayReadRequest(user: { id: string; role: string }, request: { entityType: string; field: string; requestedById: string }): boolean {
  if (can(user, "changeRequest.approve")) return true;
  if (request.requestedById === user.id) return true;
  return can(user, decisionPermissionFor(request.entityType, request.field));
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
    // only ever read their own, whatever they ask for. `mine` narrows to your
    // own regardless of what you hold, which is what the "my requests" view
    // asks for.
    const scope = query.mine ? { requestedById: req.user!.id } : visibleRequestScope(req.user!);
    if (scope) Object.assign(where, scope);

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
        // The badge counts exactly what the list would show, scoped the same
        // way — a Manager's badge counts the quick-sold pieces waiting on
        // them, an Employee's counts their own asks (spec.md "Quick sell").
        ...(visibleRequestScope(req.user!) ?? {}),
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
    if (!mayReadRequest(req.user!, request)) throw new AppError(403, ERROR_CODES.FORBIDDEN);
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

  // MAY THIS PERSON DECIDE THIS AT ALL — asked first, before anything about
  // the request's state, so somebody who has no business here learns nothing
  // about it beyond that they may not.
  //
  // WHICH permission it answers to depends on the field: changeRequest.approve
  // for every gated change, product.complete for a quick sale's completion
  // (see decisionPermissionFor). Checked here rather than on the route so that
  // one endpoint pair keeps serving every field, and so the API refuses
  // server-side rather than relying on a hidden button (CLAUDE.md rule 5).
  if (!can(decider, decisionPermissionFor(existing.entityType, existing.field))) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN);
  }

  // Deciding something already decided is not a no-op: it would overwrite who
  // decided what, which is the one thing this record exists to hold.
  if (existing.status !== PENDING_CHANGE_REQUEST_STATUS) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
  }
  const applier = applierFor(existing.entityType, existing.field);

  // Nobody signs off their own ask — that would make the gate decorative.
  // Reachable in principle by an Admin whose own action was gated; kept as a
  // rule of the flow rather than an accident of who holds what today.
  //
  // The one field that opts out is quick sell's completion, which is not a
  // gate: the sale already happened and finishing the product off is data
  // entry (see ChangeRequestApplier.allowSelfDecision).
  if (existing.requestedById === decider.id && !applier.allowSelfDecision) {
    throw new AppError(403, ERROR_CODES.CHANGE_REQUEST_SELF_DECISION);
  }

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
  // Deliberately the READ gate here, with the real one applied per field
  // inside decide(): which permission may decide a request depends on WHICH
  // request it is, and that is not knowable from the URL (see
  // decisionPermissionFor). Nothing is loosened — a caller holding neither
  // changeRequest.approve nor the field's own action is refused with 403
  // before anything is touched.
  requirePermission("changeRequest.view"),
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
  // Same as approve above: gated per field inside decide().
  requirePermission("changeRequest.view"),
  validateBody(decideChangeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as DecideChangeRequestInput;
    const request = await decide(req.params.id, req.user!, REJECTED_CHANGE_REQUEST_STATUS, body.note);
    sendOk(res, serializeChangeRequest(request));
  })
);

// ---------------------------------------------------------------------------
// POST /api/change-requests/:id/cancel — take your own ask back.
//
// Not a third decision: a decision is somebody ELSE's answer to the question,
// and this is withdrawing the question. Which is why it is the asker's alone
// and why it is refused the moment the request has been decided — a refusal
// with an Admin's name on it is a record, and nobody gets to delete a record
// of their own by asking nicely.
//
// The row goes rather than gaining a fourth status, which is exactly what
// SUPERSEDING already does to a request replaced by a newer one: what was
// asked for lives on in the audit trail, and the approval screen is left
// holding only decisions that are still somebody's to make. It also frees
// the pendingKey, so the same field can be asked about again straight away.
// ---------------------------------------------------------------------------
router.post(
  "/:id/cancel",
  requirePermission("changeRequest.cancel"),
  asyncHandler(async (req, res) => {
    const existing = await loadRequest(req.params.id);

    // Yours only. Checked here, not in the UI (CLAUDE.md rule 5) — and
    // deliberately without an Admin override: an Admin who disagrees with a
    // request has REJECT, which says who disagreed and why.
    if (existing.requestedById !== req.user!.id) {
      throw new AppError(403, ERROR_CODES.CHANGE_REQUEST_NOT_REQUESTER);
    }
    // Already answered. Withdrawing it now would erase the answer.
    if (existing.status !== PENDING_CHANGE_REQUEST_STATUS) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_PENDING);
    }

    await prisma.changeRequest.delete({ where: { id: existing.id } });

    // What was asked for, kept (CLAUDE.md rule 6) — the row is gone, so the
    // trail is the only place the withdrawn value survives. Same shape as the
    // REQUEST entry it undoes, so the pair reads as one story.
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
  })
);

export default router;
