import { Router } from "express";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { money, roundMoney } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import {
  countOpenFollowUps,
  expectedAmount,
  figuresFor,
  openFollowUpWhere,
  queryMovements,
  serializeCashSession,
  sessionWindow,
  storedFigures,
  suggestedOpeningFloat,
} from "@/lib/cashSession";
import {
  closeCashSessionSchema,
  listCashSessionsQuerySchema,
  openCashSessionSchema,
  type CloseCashSessionInput,
  type ListCashSessionsQuery,
  type OpenCashSessionInput,
} from "@/validation/cash";
import { AUDIT_ENTITY, ERROR_CODES, MONEY_DECIMAL_PLACES, MS_PER_MINUTE } from "@/constants";
import type { CurrentCashSession } from "@/types";

// Cash drawer, Admin + Manager only: the person at the till must not declare what should be in it.
const router = Router();
router.use(requireAuth);

const sessionInclude = {
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  followUpResolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.CashSessionInclude;

async function loadSession(id: string) {
  const session = await prisma.cashSession.findUnique({ where: { id }, include: sessionInclude });
  if (!session) {
    throw new AppError(404, ERROR_CODES.CASH_SESSION_NOT_FOUND);
  }
  return session;
}

// Today's local date on the caller's clock, for a drawer opened without an explicit date.
function todayOn(tzOffset: number): string {
  return new Date(Date.now() + tzOffset * MS_PER_MINUTE).toISOString().slice(0, 10);
}

// GET /api/cash-sessions/current — open drawer, next opening float and any unexplained day; before /:id.
router.get(
  "/current",
  requirePermission("cashSession.view"),
  asyncHandler(async (_req, res) => {
    const [open, lastClosed, suggested, openFollowUpCount] = await Promise.all([
      prisma.cashSession.findFirst({
        where: { status: "OPEN" },
        orderBy: [{ date: "desc" }, { openedAt: "desc" }],
        include: sessionInclude,
      }),
      // The day just finished, so a closed day is not mistaken for one nobody started.
      prisma.cashSession.findFirst({
        where: { status: "CLOSED" },
        orderBy: [{ date: "desc" }, { closedAt: "desc" }],
        include: sessionInclude,
      }),
      suggestedOpeningFloat(),
      countOpenFollowUps(),
    ]);

    const current: CurrentCashSession = {
      session: open ? serializeCashSession(open, await figuresFor(open)) : null,
      lastClosed: lastClosed ? serializeCashSession(lastClosed, storedFigures(lastClosed)) : null,
      suggestedOpeningFloat: suggested.toFixed(MONEY_DECIMAL_PLACES),
      openFollowUpCount,
    };

    sendOk(res, current);
  }),
);

// GET /api/cash-sessions — list (pagination + filtering + sorting)
router.get(
  "/",
  requirePermission("cashSession.view"),
  validateQuery(listCashSessionsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListCashSessionsQuery;
    const where: Prisma.CashSessionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    // The follow-up list: closed days whose difference was carried forward and never signed off.
    if (query.openFollowUpOnly) {
      Object.assign(where, openFollowUpWhere());
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T00:00:00.000Z`) } : {}),
      };
    }

    const [total, sessions] = await Promise.all([
      prisma.cashSession.count({ where }),
      prisma.cashSession.findMany({
        where,
        include: sessionInclude,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    // At most one session in a list is OPEN and recomputed; the rest read frozen columns.
    const serialized = await Promise.all(
      sessions.map(async (session) => serializeCashSession(session, await figuresFor(session))),
    );

    sendOk(res, serialized, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  }),
);

// GET /api/cash-sessions/:id
router.get(
  "/:id",
  requirePermission("cashSession.view"),
  asyncHandler(async (req, res) => {
    const session = await loadSession(req.params.id);
    sendOk(res, serializeCashSession(session, await figuresFor(session)));
  }),
);

// POST /api/cash-sessions — open the day; openingFloat normally carries over, sending one overrides it.
router.post(
  "/",
  requirePermission("cashSession.manage"),
  validateBody(openCashSessionSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as OpenCashSessionInput;
    const date = body.date ?? todayOn(body.tzOffset);
    const dateValue = new Date(`${date}T00:00:00.000Z`);

    // One drawer per day is the only restriction; an unclosed yesterday never blocks today.
    const taken = await prisma.cashSession.findUnique({ where: { date: dateValue } });
    if (taken) {
      throw new AppError(409, ERROR_CODES.CASH_SESSION_DATE_TAKEN);
    }

    // Carries the newest session closed before this date, so a missed day opens with what it should have.
    const openingFloat =
      body.openingFloat === undefined ? await suggestedOpeningFloat(dateValue) : roundMoney(money(body.openingFloat));

    const created = await prisma.cashSession.create({
      data: {
        date: dateValue,
        tzOffset: body.tzOffset,
        status: "OPEN",
        openingFloat,
        note: body.note ?? null,
        openedById: req.user!.id,
      },
      include: sessionInclude,
    });

    const figures = await figuresFor(created);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CASH_SESSION_OPENED,
      entityType: AUDIT_ENTITY.CASH_SESSION,
      entityId: created.id,
      newValue: serializeCashSession(created, figures),
    });

    sendOk(res, serializeCashSession(created, figures), null, 201);
  }),
);

// POST /api/cash-sessions/:id/close — the count is recorded whatever it says; a difference must be explained.
router.post(
  "/:id/close",
  requirePermission("cashSession.manage"),
  validateBody(closeCashSessionSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadSession(req.params.id);
    if (existing.status === "CLOSED") {
      throw new AppError(409, ERROR_CODES.CASH_SESSION_ALREADY_CLOSED);
    }

    const body = req.body as CloseCashSessionInput;
    const counted = roundMoney(money(body.countedAmount));
    const withdrawn = roundMoney(money(body.withdrawnAmount ?? 0));

    // You cannot take out more than is in there.
    if (withdrawn.greaterThan(counted)) {
      throw new AppError(400, ERROR_CODES.CASH_SESSION_WITHDRAWAL_EXCEEDS_COUNT);
    }

    // Computed at close from the report views and frozen, so later returns never rewrite a signed-off day.
    const movements = await queryMovements(sessionWindow(existing.date, existing.tzOffset));
    const expected = expectedAmount(existing.openingFloat, movements);
    const difference = roundMoney(counted.sub(expected));

    // A difference is refused only when unexplained; the figures ride on the refusal, since counting is blind until submitted.
    const note = body.note ?? existing.note;
    if (!difference.isZero() && !note) {
      throw new AppError(400, ERROR_CODES.CASH_SESSION_DIFFERENCE_NOTE_REQUIRED, {
        expected: expected.toFixed(MONEY_DECIMAL_PLACES),
        counted: counted.toFixed(MONEY_DECIMAL_PLACES),
        difference: difference.toFixed(MONEY_DECIMAL_PLACES),
      });
    }

    const closedAt = new Date();
    const updated = await prisma.cashSession.update({
      where: { id: existing.id },
      data: {
        status: "CLOSED",
        cashSales: movements.cashSales,
        cashExpenses: movements.cashExpenses,
        expectedAmount: expected,
        countedAmount: counted,
        withdrawnAmount: withdrawn,
        difference,
        // Stays in the drawer overnight and opens tomorrow: the COUNTED figure, not the expected one.
        closingBalance: roundMoney(counted.sub(withdrawn)),
        note,
        // Carrying only makes sense when there is something to carry.
        differenceCarried: body.carryDifference && !difference.isZero(),
        closedById: req.user!.id,
        closedAt,
      },
      include: sessionInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CASH_SESSION_CLOSED,
      entityType: AUDIT_ENTITY.CASH_SESSION,
      entityId: updated.id,
      oldValue: serializeCashSession(existing, await figuresFor(existing)),
      newValue: serializeCashSession(updated, storedFigures(updated)),
    });

    sendOk(res, serializeCashSession(updated, storedFigures(updated)));
  }),
);

// POST /api/cash-sessions/:id/resolve-follow-up — sign off a carried difference.
router.post(
  "/:id/resolve-follow-up",
  requirePermission("cashSession.manage"),
  asyncHandler(async (req, res) => {
    const existing = await loadSession(req.params.id);
    if (!existing.differenceCarried || existing.followUpResolvedAt) {
      throw new AppError(409, ERROR_CODES.CASH_SESSION_NO_OPEN_FOLLOW_UP);
    }

    const updated = await prisma.cashSession.update({
      where: { id: existing.id },
      data: { followUpResolvedAt: new Date(), followUpResolvedById: req.user!.id },
      include: sessionInclude,
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.CASH_SESSION,
      entityId: updated.id,
      oldValue: { followUpResolvedAt: existing.followUpResolvedAt },
      newValue: { followUpResolvedAt: updated.followUpResolvedAt },
    });

    sendOk(res, serializeCashSession(updated, storedFigures(updated)));
  }),
);

export default router;
