import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lineView } from "@/lib/reports";
import { expenseCashTotal, queryExpenseTotals } from "@/lib/expenses";
import { formatMoney, money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { pickedRange } from "@/lib/reportRange";
import { DEFAULT_OPENING_FLOAT, MONEY_DECIMAL_PLACES } from "@/constants";
import type { AnyRecord, CashSessionFigures, CashSessionMovements, ReportRange } from "@/types";

// ============================================================================
//  The cash drawer (spec.md "Cash drawer & expenses").
//
//    expected   = openingFloat + cashSales - cashExpenses
//    difference = countedAmount - expected
//    tomorrow's openingFloat = countedAmount - withdrawnAmount
//
//  The three figures move with every sale while the session is OPEN, and are
//  FROZEN onto the row at close. That is deliberate: a return processed next
//  week, or an expense backdated into a day that has already been counted and
//  signed off, must not silently rewrite what someone put their name to.
// ============================================================================

// The instants a drawer day actually covers, resolved from the local
// calendar date it is labelled with plus the offset frozen onto the session
// at open — so every later read of that day resolves the same window, no
// matter who asks or from where.
export function sessionWindow(date: Date, tzOffset: number): ReportRange {
  const localDate = date.toISOString().slice(0, 10);
  return pickedRange(localDate, localDate, tzOffset);
}

export function sessionDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Zero, in the same 2dp string shape every money field crosses the API in.
const NO_MONEY = ZERO_MONEY().toFixed(MONEY_DECIMAL_PLACES);

// Cash that reached the till inside the window.
//
// Windowed on collectedAt rather than createdAt, because a drawer holds the
// money it was actually handed: a courier order rung up three weeks ago and
// settled this morning is this morning's cash. Computed from the SAME
// per-line view the reports use, so a partly returned order contributes only
// what stayed sold and the drawer can never disagree with the sales figures.
async function queryCashSales(range: ReportRange): Promise<Prisma.Decimal> {
  const rows = await prisma.$queryRaw<{ amount: Prisma.Decimal | null }[]>`
    WITH line AS (${lineView(null)})
    SELECT COALESCE(SUM(unit_net_price * net_units), 0) AS "amount"
    FROM line
    WHERE payment_status = 'COLLECTED'
      AND payment_method = 'CASH'
      AND collected_at >= ${range.from}
      AND collected_at < ${range.to}
  `;
  const amount = rows[0]?.amount;
  return roundMoney(amount === null || amount === undefined ? ZERO_MONEY() : money(amount));
}

// What went in and what went out of the till on this day. Only APPROVED,
// paidInCash expenses count against it: a pending request has not been agreed
// to, and a transfer never touched the drawer.
export async function queryMovements(range: ReportRange): Promise<CashSessionMovements> {
  const [cashSales, expenses] = await Promise.all([queryCashSales(range), queryExpenseTotals(range)]);
  return { cashSales, cashExpenses: expenseCashTotal(expenses) };
}

export function expectedAmount(openingFloat: Prisma.Decimal, movements: CashSessionMovements): Prisma.Decimal {
  return roundMoney(openingFloat.add(movements.cashSales).sub(movements.cashExpenses));
}

// The live figures for an OPEN session. A closed one reads its frozen
// columns instead — see serializeCashSession.
export async function computeFigures(session: {
  date: Date;
  tzOffset: number;
  openingFloat: Prisma.Decimal;
}): Promise<CashSessionFigures> {
  const movements = await queryMovements(sessionWindow(session.date, session.tzOffset));
  return {
    cashSales: movements.cashSales.toFixed(MONEY_DECIMAL_PLACES),
    cashExpenses: movements.cashExpenses.toFixed(MONEY_DECIMAL_PLACES),
    expected: expectedAmount(session.openingFloat, movements).toFixed(MONEY_DECIMAL_PLACES),
  };
}

// What the next drawer should open with: whatever the last CLOSED session
// was counted at, less whatever was taken out of it. This is the whole point
// of recording a withdrawal — the remainder carries over on its own, and
// nobody has to remember a number overnight.
//
// Note it carries the COUNTED figure, not the expected one: the drawer opens
// on the money that is really in it, which is also why a difference needs no
// correcting entry the next day, only an explanation.
//
// `before` scopes it to the day being opened: the newest session closed
// BEFORE that date, rather than merely the newest closed row anywhere. Filling
// in a day that was missed then carries what that day should really have
// started with, instead of a balance from its future. Omitted (the /current
// suggestion, where no date has been chosen yet) it means "the latest".
export async function suggestedOpeningFloat(before?: Date): Promise<Prisma.Decimal> {
  const previous = await prisma.cashSession.findFirst({
    where: { status: "CLOSED", ...(before ? { date: { lt: before } } : {}) },
    orderBy: [{ date: "desc" }, { closedAt: "desc" }],
    select: { closingBalance: true },
  });
  return roundMoney(previous?.closingBalance ?? money(DEFAULT_OPENING_FLOAT));
}

// Closed days whose difference was carried forward and never signed off —
// the follow-up reminder the shop actually acts on.
export function openFollowUpWhere(): Prisma.CashSessionWhereInput {
  return { differenceCarried: true, followUpResolvedAt: null };
}

export function countOpenFollowUps(): Promise<number> {
  return prisma.cashSession.count({ where: openFollowUpWhere() });
}

function actor(user: AnyRecord | null | undefined) {
  return user ? { id: user.id, name: user.name } : null;
}

// `figures` is passed in rather than fetched: an OPEN session gets live ones
// (computeFigures), a CLOSED one reads back exactly what was frozen at close.
export function serializeCashSession(session: AnyRecord, figures: CashSessionFigures) {
  return {
    id: session.id,
    date: sessionDateString(session.date),
    tzOffset: session.tzOffset,
    status: session.status,

    // NOT NULL columns, so these always render — the `?? NO_MONEY` is only
    // there because formatMoney is typed for the nullable ones below it.
    openingFloat: formatMoney(session.openingFloat?.toString()) ?? NO_MONEY,
    cashSales: figures.cashSales,
    cashExpenses: figures.cashExpenses,
    expected: figures.expected,

    countedAmount: formatMoney(session.countedAmount?.toString()),
    withdrawnAmount: formatMoney(session.withdrawnAmount?.toString()) ?? NO_MONEY,
    difference: formatMoney(session.difference?.toString()),
    closingBalance: formatMoney(session.closingBalance?.toString()),
    note: session.note ?? null,

    differenceCarried: session.differenceCarried,
    followUpResolvedAt: session.followUpResolvedAt ?? null,
    followUpResolvedBy: actor(session.followUpResolvedBy),

    openedBy: actor(session.openedBy),
    closedBy: actor(session.closedBy),
    openedAt: session.openedAt,
    closedAt: session.closedAt ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

// The frozen figures of a closed session, read straight back off the row.
export function storedFigures(session: AnyRecord): CashSessionFigures {
  return {
    cashSales: formatMoney(session.cashSales?.toString()) ?? NO_MONEY,
    cashExpenses: formatMoney(session.cashExpenses?.toString()) ?? NO_MONEY,
    expected: formatMoney(session.expectedAmount?.toString()) ?? NO_MONEY,
  };
}

// An OPEN session's figures are live; a CLOSED one's are whatever was true
// when it was signed off.
export async function figuresFor(session: AnyRecord): Promise<CashSessionFigures> {
  if (session.status === "CLOSED") return storedFigures(session);
  return computeFigures(session as { date: Date; tzOffset: number; openingFloat: Prisma.Decimal });
}
