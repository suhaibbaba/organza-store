import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lineView } from "@/lib/reports";
import { expenseCashTotal, queryExpenseTotals } from "@/lib/expenses";
import { formatMoney, money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { pickedRange } from "@/lib/reportRange";
import { DEFAULT_OPENING_FLOAT, MONEY_DECIMAL_PLACES } from "@/constants";
import type { AnyRecord, CashSessionFigures, CashSessionMovements, ReportRange } from "@/types";

// Cash drawer: expected = float + cash sales − cash expenses; the figures are live while OPEN and frozen onto the row at close.

// A drawer day's window, from its local date plus the offset frozen at open, so every read resolves the same window.
export function sessionWindow(date: Date, tzOffset: number): ReportRange {
  const localDate = date.toISOString().slice(0, 10);
  return pickedRange(localDate, localDate, tzOffset);
}

export function sessionDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Zero, in the same 2dp string shape every money field crosses the API in.
const NO_MONEY = ZERO_MONEY().toFixed(MONEY_DECIMAL_PLACES);

// Cash handed over inside the window (by collectedAt), from the reports' per-line view so returns and the sales figures agree.
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

// Only APPROVED, paidInCash expenses count against the till.
export async function queryMovements(range: ReportRange): Promise<CashSessionMovements> {
  const [cashSales, expenses] = await Promise.all([queryCashSales(range), queryExpenseTotals(range)]);
  return { cashSales, cashExpenses: expenseCashTotal(expenses) };
}

export function expectedAmount(openingFloat: Prisma.Decimal, movements: CashSessionMovements): Prisma.Decimal {
  return roundMoney(openingFloat.add(movements.cashSales).sub(movements.cashExpenses));
}

// Live figures for an OPEN session; a closed one reads its frozen columns (serializeCashSession).
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

// The next opening float: the last closed session's COUNTED amount minus its withdrawal, carried over automatically.
export async function suggestedOpeningFloat(before?: Date): Promise<Prisma.Decimal> {
  const previous = await prisma.cashSession.findFirst({
    where: { status: "CLOSED", ...(before ? { date: { lt: before } } : {}) },
    orderBy: [{ date: "desc" }, { closedAt: "desc" }],
    select: { closingBalance: true },
  });
  return roundMoney(previous?.closingBalance ?? money(DEFAULT_OPENING_FLOAT));
}

// Closed days with a carried difference never signed off — the follow-up list the shop acts on.
export function openFollowUpWhere(): Prisma.CashSessionWhereInput {
  return { differenceCarried: true, followUpResolvedAt: null };
}

export function countOpenFollowUps(): Promise<number> {
  return prisma.cashSession.count({ where: openFollowUpWhere() });
}

function actor(user: AnyRecord | null | undefined) {
  return user ? { id: user.id, name: user.name } : null;
}

// `figures` is passed in: live for an OPEN session, frozen for a CLOSED one.
export function serializeCashSession(session: AnyRecord, figures: CashSessionFigures) {
  return {
    id: session.id,
    date: sessionDateString(session.date),
    tzOffset: session.tzOffset,
    status: session.status,

    // NOT NULL columns; the `?? NO_MONEY` only satisfies formatMoney's nullable typing.
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

// An OPEN session's figures are live; a CLOSED one's are whatever was true when it was signed off.
export async function figuresFor(session: AnyRecord): Promise<CashSessionFigures> {
  if (session.status === "CLOSED") {
    return storedFigures(session);
  }
  return computeFigures(session as { date: Date; tzOffset: number; openingFloat: Prisma.Decimal });
}
