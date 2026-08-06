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

// The cash drawer (spec.md "Cash drawer & expenses").
//
//   expected   = openingFloat + cash sales - cash expenses
//   difference = counted - expected
//   tomorrow's openingFloat = counted - withdrawn
//
// ADMIN + MANAGER ONLY, both reading and writing. The count IS the shop's
// cash position: the person standing at the till must not be the one who
// declares what should have been in it — the same anti-theft reasoning that
// keeps "mark collected" out of an Employee's hands.
//
// A difference NEVER blocks the close. The money in the drawer is a fact, and
// a system that refuses to record it only teaches people to fudge the count.
// It is saved, it requires a note, and it can be carried to the next day as a
// follow-up.
const router = Router();
router.use(requireAuth);

const sessionInclude = {
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  followUpResolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.CashSessionInclude;

async function loadSession(id: string) {
  const session = await prisma.cashSession.findUnique({ where: { id }, include: sessionInclude });
  if (!session) throw new AppError(404, ERROR_CODES.CASH_SESSION_NOT_FOUND);
  return session;
}

// The local calendar date it is "now" on the caller's clock — what a drawer
// opened without an explicit date should be labelled with.
function todayOn(tzOffset: number): string {
  return new Date(Date.now() + tzOffset * MS_PER_MINUTE).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// GET /api/cash-sessions/current — the drawer as it stands right now.
// Declared before /:id so the literal path isn't swallowed as an id.
//
// Answers three things at once, because they are always asked together: is a
// drawer open (and what does it say), what would the next one open with, and
// is there a day still waiting to be explained.
//
// "The" open session is the newest one by date — the drawer being stood at.
// An older day left open is not lost: it is still in the list under
// ?status=OPEN, waiting to be counted.
// ---------------------------------------------------------------------------
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
      // The day just finished. Without it a caller cannot tell a counted,
      // closed day from a day nobody has started — and would offer to open a
      // drawer that has already been signed off.
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
  })
);

// ---------------------------------------------------------------------------
// GET /api/cash-sessions — list (pagination + filtering + sorting)
// ---------------------------------------------------------------------------
router.get(
  "/",
  requirePermission("cashSession.view"),
  validateQuery(listCashSessionsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListCashSessionsQuery;
    const where: Prisma.CashSessionWhereInput = {};

    if (query.status) where.status = query.status;
    // The follow-up list: closed days whose difference was carried forward
    // and never signed off.
    if (query.openFollowUpOnly) Object.assign(where, openFollowUpWhere());

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

    // A list may hold at most one OPEN session, so at most one of these
    // recomputes anything; the rest read their frozen columns back.
    const serialized = await Promise.all(
      sessions.map(async (session) => serializeCashSession(session, await figuresFor(session)))
    );

    sendOk(res, serialized, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/cash-sessions/:id
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  requirePermission("cashSession.view"),
  asyncHandler(async (req, res) => {
    const session = await loadSession(req.params.id);
    sendOk(res, serializeCashSession(session, await figuresFor(session)));
  })
);

// ---------------------------------------------------------------------------
// POST /api/cash-sessions — open the day's drawer.
//
// openingFloat is normally left out: the previous day's remainder carries
// over on its own, which is the whole point of recording a withdrawal at
// close. Sending it explicitly overrides that — the first day the shop uses
// the drawer, or when the owner has put a different float in by hand.
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("cashSession.manage"),
  validateBody(openCashSessionSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as OpenCashSessionInput;
    const date = body.date ?? todayOn(body.tzOffset);
    const dateValue = new Date(`${date}T00:00:00.000Z`);

    // One drawer per day, and that is the only restriction. Note what is
    // deliberately NOT enforced: yesterday's session still being open does
    // not stop today's from starting. Money is attributed to a day by its
    // own window, never by "whichever drawer happens to be open", so a second
    // open session can't double-count anything — and refusing to let the shop
    // start trading because someone forgot to count last night would be
    // exactly the kind of block this feature rejects everywhere else. An
    // uncounted day stays visible as an OPEN row in the list.
    const taken = await prisma.cashSession.findUnique({ where: { date: dateValue } });
    if (taken) throw new AppError(409, ERROR_CODES.CASH_SESSION_DATE_TAKEN);

    // The previous day's remainder: the newest session closed BEFORE this
    // one's date, not merely the newest closed row — so opening a day that
    // was missed carries what that day should actually have started with.
    const openingFloat =
      body.openingFloat === undefined
        ? await suggestedOpeningFloat(dateValue)
        : roundMoney(money(body.openingFloat));

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
  })
);

// ---------------------------------------------------------------------------
// POST /api/cash-sessions/:id/close — count the drawer and shut the day.
//
// The count is recorded whatever it says. What is enforced is that a
// difference is EXPLAINED (a note) — not that it doesn't exist.
// ---------------------------------------------------------------------------
router.post(
  "/:id/close",
  requirePermission("cashSession.manage"),
  validateBody(closeCashSessionSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadSession(req.params.id);
    if (existing.status === "CLOSED") throw new AppError(409, ERROR_CODES.CASH_SESSION_ALREADY_CLOSED);

    const body = req.body as CloseCashSessionInput;
    const counted = roundMoney(money(body.countedAmount));
    const withdrawn = roundMoney(money(body.withdrawnAmount ?? 0));

    // You cannot take out more than is in there.
    if (withdrawn.greaterThan(counted)) {
      throw new AppError(400, ERROR_CODES.CASH_SESSION_WITHDRAWAL_EXCEEDS_COUNT);
    }

    // Computed here, at the close, from the same views the reports use — and
    // then frozen onto the row, so a return processed next week can never
    // rewrite what someone put their name to tonight.
    const movements = await queryMovements(sessionWindow(existing.date, existing.tzOffset));
    const expected = expectedAmount(existing.openingFloat, movements);
    const difference = roundMoney(counted.sub(expected));

    // The only thing a discrepancy is refused for: being left unexplained. A
    // note is what makes it investigable instead of invisible.
    //
    // The figures ride along on the refusal on purpose. Counting is BLIND —
    // the closing screen deliberately withholds what the drawer was expected
    // to hold until a count has been submitted, so that nobody can make the
    // count agree with the books. That leaves the client unable to know a
    // difference exists, let alone how big, until it asks: this response is
    // what lets it reveal "expected 380, counted 350, short 30" and then ask
    // for the explanation, without ever having been told the answer up front.
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
        // What stays in the drawer overnight — and therefore what tomorrow
        // opens with, automatically. The COUNTED figure, not the expected
        // one: the next day starts on the money that is really there.
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
  })
);

// ---------------------------------------------------------------------------
// POST /api/cash-sessions/:id/resolve-follow-up — sign off a carried
// difference once someone has worked out what happened to it.
// ---------------------------------------------------------------------------
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
  })
);

export default router;
