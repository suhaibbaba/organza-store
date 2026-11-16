import { z } from 'zod';

/**
 * Reports (proposal G phase 6). Money figures read the ledger, so each equals it for any
 * period after cut-over. Counts (sales, pieces) read the documents. Cost and profit figures are
 * null for anyone without `reports.cost`.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportRangeSchema = z
  .object({ from: day, to: day })
  .refine((v) => v.from <= v.to, { message: 'RANGE_INVALID', path: ['to'] });
export type ReportRange = z.infer<typeof reportRangeSchema>;

export const SALES_GROUPS = ['day', 'month', 'category', 'product', 'staff', 'source'] as const;
export type SalesGroup = (typeof SALES_GROUPS)[number];

export const salesReportQuerySchema = z
  .object({ from: day, to: day, groupBy: z.enum(SALES_GROUPS).default('day') })
  .refine((v) => v.from <= v.to, { message: 'RANGE_INVALID', path: ['to'] });

export const dailyQuerySchema = z.object({ date: day });

export interface ProfitAndLoss {
  from: string;
  to: string;
  revenue: string;
  discounts: string;
  netSales: string;
  cogs: string | null;
  grossProfit: string | null;
  expenses: { category: string; amount: string }[];
  expensesTotal: string;
  damageAndLoss: string | null;
  promotions: string | null;
  cashOverShort: string;
  exchangeDifferences: string;
  otherIncome: string;
  netProfit: string | null;
  sales: { count: number; pieces: number; average: string };
  /** Sales brought over from the old system in the range: figures only, never in the ledger. */
  imported: { count: number; total: string };
}

export interface SalesReportRow {
  key: string;
  /** A product or category name in three languages, a staff name, a source or a date. */
  label: string | { ar?: string; en?: string; he?: string };
  sales: number;
  pieces: number;
  revenue: string;
  cost: string | null;
  profit: string | null;
}

export const MONEY_ACCOUNTS = ['CASH_DRAWER', 'SAFE', 'BANK', 'CARD_CLEARING'] as const;
export type MoneyAccount = (typeof MONEY_ACCOUNTS)[number];

export interface CashReport {
  from: string;
  to: string;
  accounts: { account: MoneyAccount; opening: string; in: string; out: string; closing: string }[];
  /** Where the money came from and went, by kind of document. */
  flows: { event: string; in: string; out: string }[];
}

export interface PaymentMethodRow {
  method: string;
  purpose: string;
  direction: 'IN' | 'OUT';
  count: number;
  amount: string;
}

export interface AgingBuckets {
  current: string;
  days30: string;
  days60: string;
  days90: string;
}

export interface DebtsReport {
  /** As of today. */
  customers: {
    id: string;
    name: string;
    phone: string | null;
    owed: string;
    aging: AgingBuckets;
    oldest: string | null;
  }[];
  totals: { owed: string; aging: AgingBuckets; customerCredit: string };
}

export interface SupplierDebtsReport {
  suppliers: {
    id: string;
    name: string;
    owed: string;
    aging: AgingBuckets;
    oldest: string | null;
  }[];
  totals: { owed: string; aging: AgingBuckets };
}

export interface InventoryValuation {
  /** At average cost; pieces with no known cost are counted, not valued. */
  categories: {
    id: string | null;
    name: string | { ar?: string; en?: string; he?: string };
    pieces: number;
    value: string;
    retail: string;
  }[];
  totals: {
    pieces: number;
    value: string;
    retail: string;
    unknownCost: number;
    damaged: number;
    /** The Inventory account in the ledger; equals `value` when everything reconciles. */
    ledger: string;
  };
}

export interface ExpenseRow {
  category: string;
  amount: string;
}

export interface DailySummary {
  date: string;
  sales: { count: number; total: string; pieces: number };
  returns: { count: number; total: string };
  payments: PaymentMethodRow[];
  expenses: { category: string; amount: string }[];
  shifts: {
    id: string;
    number: string;
    register: string;
    openedBy: string;
    status: string;
    difference: string | null;
  }[];
  grossProfit: string | null;
}

/** The Today screen, per role (proposal F: employee own sales; manager shop; admin all). */
export interface TodayView {
  date: string;
  scope: 'OWN' | 'SHOP';
  sales: { count: number; total: string; pieces: number };
  byMethod: { method: string; amount: string }[];
  grossProfit: string | null;
  /** Compared with the same weekday a week ago. */
  lastWeek: { count: number; total: string };
  orders: { status: string; count: number }[];
  heldSales: number;
  approvalsWaiting: number;
  openShifts: number;
  lowStock: number;
  debtsOwed: string | null;
  last7: { date: string; total: string }[];
}

export interface ActivityItem {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  by: string | null;
  summary: Record<string, unknown> | null;
}
