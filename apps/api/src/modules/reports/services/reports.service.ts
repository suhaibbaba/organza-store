import { Injectable } from '@nestjs/common';
import {
  type ActivityItem,
  addMoney,
  type AgingBuckets,
  type CashReport,
  type DailySummary,
  type DebtsReport,
  fromMinor,
  type InventoryValuation,
  MONEY_ACCOUNTS,
  type PaymentMethodRow,
  type ProfitAndLoss,
  type ReportRange,
  roleCan,
  type SalesGroup,
  type SalesReportRow,
  type SupplierDebtsReport,
  toMinor,
  type TodayView,
} from '@organza/shared';
import { type SQL, sql } from 'drizzle-orm';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { InjectDb } from '../../../database/database.module.js';
import type { Database } from '../../../database/unit-of-work.js';
import { LedgerService } from '../../ledger/services/ledger.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';

const ZERO = '0.00';
const money = (v: string | number | null | undefined) => addMoney(ZERO, String(v ?? 0));
const neg = (v: string) => fromMinor(-toMinor(v));
type Row = Record<string, unknown>;

/** Adds days to an ISO date (UTC arithmetic on a calendar date). */
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Receivable and payable aging: open documents bucketed by age in days. */
const bucket = (rows: { open: string; age: number }[]): AgingBuckets => {
  const b = { current: ZERO, days30: ZERO, days60: ZERO, days90: ZERO };
  for (const r of rows) {
    const key =
      r.age <= 30 ? 'current' : r.age <= 60 ? 'days30' : r.age <= 90 ? 'days60' : 'days90';
    b[key] = addMoney(b[key], r.open);
  }
  return b;
};
const sumBuckets = (all: AgingBuckets[]): AgingBuckets => ({
  current: addMoney(ZERO, ...all.map((b) => b.current)),
  days30: addMoney(ZERO, ...all.map((b) => b.days30)),
  days60: addMoney(ZERO, ...all.map((b) => b.days60)),
  days90: addMoney(ZERO, ...all.map((b) => b.days90)),
});

/**
 * Reports read the ledger for money (so every figure equals it for any period) and the
 * documents for counts. Cost and profit are hidden from anyone without `reports.cost`.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  private async rows<T = Row>(query: SQL): Promise<T[]> {
    return [...(await this.db.execute(query))] as T[];
  }

  /** Signed sums (debit positive) per account, and per dimension where asked, over a range. */
  private async balances(range: ReportRange, accounts: string[]) {
    const rows = await this.rows<{ account: string; dimension: string | null; total: string }>(sql`
      select l.account, l.dimension, sum(l.amount)::text as total
        from journal_lines l join journal_entries e on e.id = l.entry_id
       where e.entry_date between ${range.from} and ${range.to}
         and l.account in ${sql.raw(`(${accounts.map((a) => `'${a}'`).join(',')})`)}
       group by l.account, l.dimension`);
    const byAccount = (account: string) =>
      addMoney(ZERO, ...rows.filter((r) => r.account === account).map((r) => r.total));
    return { rows, byAccount };
  }

  // ------------------------------------------------------------------ profit and loss

  async profitAndLoss(actor: Actor, range: ReportRange): Promise<ProfitAndLoss> {
    const cost = roleCan(actor.role, 'reports.cost');
    const { rows, byAccount } = await this.balances(range, [
      'SALES_REVENUE',
      'DISCOUNTS_GIVEN',
      'COGS',
      'OPERATING_EXPENSES',
      'DAMAGE_AND_LOSS',
      'PROMOTIONS',
      'CASH_OVER_SHORT',
      'EXCHANGE_DIFFERENCES',
      'OTHER_INCOME',
    ]);
    // Income accounts are credit-normal: their figure is the negated sum.
    const revenue = neg(byAccount('SALES_REVENUE'));
    const discounts = byAccount('DISCOUNTS_GIVEN');
    const netSales = addMoney(revenue, neg(discounts));
    const cogs = byAccount('COGS');
    const grossProfit = addMoney(netSales, neg(cogs));
    const expenseRows = rows.filter((r) => r.account === 'OPERATING_EXPENSES');
    const categories = new Map<string, string>();
    for (const r of expenseRows) {
      const key = r.dimension ?? 'OTHER';
      categories.set(key, addMoney(categories.get(key) ?? ZERO, r.total));
    }
    const expensesTotal = byAccount('OPERATING_EXPENSES');
    const damage = byAccount('DAMAGE_AND_LOSS');
    const promotions = byAccount('PROMOTIONS');
    const overShort = byAccount('CASH_OVER_SHORT');
    const exchange = byAccount('EXCHANGE_DIFFERENCES');
    const otherIncome = neg(byAccount('OTHER_INCOME'));
    const netProfit = addMoney(
      grossProfit,
      neg(expensesTotal),
      neg(damage),
      neg(promotions),
      neg(overShort),
      neg(exchange),
      otherIncome,
    );
    const [counts] = await this.rows<{ count: number; pieces: number; total: string }>(sql`
      select count(distinct s.id)::int as count,
             coalesce(sum(l.quantity - l.returned), 0)::int as pieces,
             coalesce((select sum(x.total - x.returned_total) from sales x
                        where x.business_date between ${range.from} and ${range.to}
                          and x.status = 'COMPLETED' and not x.imported), 0)::text as total
        from sales s join sale_lines l on l.sale_id = s.id
       where s.business_date between ${range.from} and ${range.to}
         and s.status = 'COMPLETED' and not s.imported and not l.giveaway`);
    const [imported] = await this.rows<{ count: number; total: string }>(sql`
      select count(*)::int as count, coalesce(sum(total), 0)::text as total
        from sales where imported and business_date between ${range.from} and ${range.to}`);
    const count = counts?.count ?? 0;
    return {
      from: range.from,
      to: range.to,
      revenue,
      discounts,
      netSales,
      cogs: cost ? cogs : null,
      grossProfit: cost ? grossProfit : null,
      expenses: [...categories]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => toMinor(b.amount) - toMinor(a.amount)),
      expensesTotal,
      damageAndLoss: cost ? damage : null,
      promotions: cost ? promotions : null,
      cashOverShort: overShort,
      exchangeDifferences: exchange,
      otherIncome,
      netProfit: cost ? netProfit : null,
      sales: {
        count,
        pieces: counts?.pieces ?? 0,
        average: count ? fromMinor(Math.round(toMinor(money(counts?.total)) / count)) : ZERO,
      },
      imported: { count: imported?.count ?? 0, total: money(imported?.total) },
    };
  }

  // ------------------------------------------------------------------ sales breakdown

  async sales(
    actor: Actor,
    range: ReportRange & { groupBy: SalesGroup },
  ): Promise<SalesReportRow[]> {
    const cost = roleCan(actor.role, 'reports.cost');
    const key: Record<SalesGroup, { key: string; label: string; join: string }> = {
      day: { key: `s.business_date::text`, label: `s.business_date::text`, join: '' },
      month: {
        key: `to_char(s.business_date, 'YYYY-MM')`,
        label: `to_char(s.business_date, 'YYYY-MM')`,
        join: '',
      },
      category: {
        key: `coalesce(c.id::text, '-')`,
        label: `coalesce(c.name, '{}'::jsonb)::text`,
        join: 'left join products p on p.id = l.product_id left join categories c on c.id = p.category_id',
      },
      product: {
        key: `coalesce(p.id::text, '-')`,
        label: `coalesce(p.name, l.name)::text`,
        join: 'left join products p on p.id = l.product_id',
      },
      staff: {
        key: `coalesce(u.id::text, '-')`,
        label: `coalesce(u.name, '-')`,
        join: 'left join users u on u.id = s.created_by',
      },
      source: { key: `s.source::text`, label: `s.source::text`, join: '' },
    };
    const g = key[range.groupBy];
    const rows = await this.rows<{
      key: string;
      label: string;
      sales: number;
      pieces: number;
      revenue: string;
      cost: string;
    }>(sql`
      select ${sql.raw(g.key)} as key, min(${sql.raw(g.label)}) as label,
             count(distinct s.id)::int as sales,
             coalesce(sum(l.quantity - l.returned), 0)::int as pieces,
             coalesce(sum(round(l.line_total * (l.quantity - l.returned) / nullif(l.quantity, 0), 2)), 0)::text as revenue,
             coalesce(sum(round(coalesce(l.unit_cost, 0) * (l.quantity - l.returned), 2)), 0)::text as cost
        from sales s join sale_lines l on l.sale_id = s.id ${sql.raw(g.join)}
       where s.business_date between ${range.from} and ${range.to}
         and s.status = 'COMPLETED' and not s.imported
       group by 1
       order by ${sql.raw(range.groupBy === 'day' || range.groupBy === 'month' ? '1' : '5 desc')}`);
    const parse = (label: string) => {
      if (range.groupBy !== 'category' && range.groupBy !== 'product') return label;
      try {
        return JSON.parse(label) as { ar?: string; en?: string; he?: string };
      } catch {
        return label;
      }
    };
    return rows.map((r) => ({
      key: r.key,
      label: parse(r.label),
      sales: r.sales,
      pieces: r.pieces,
      revenue: money(r.revenue),
      cost: cost ? money(r.cost) : null,
      profit: cost ? addMoney(r.revenue, neg(r.cost)) : null,
    }));
  }

  // ------------------------------------------------------------------ cash

  async cash(range: ReportRange): Promise<CashReport> {
    const accounts = MONEY_ACCOUNTS.map((a) => `'${a}'`).join(',');
    const rows = await this.rows<{
      account: string;
      opening: string;
      inflow: string;
      outflow: string;
    }>(sql`
      select l.account,
             coalesce(sum(l.amount) filter (where e.entry_date < ${range.from}), 0)::text as opening,
             coalesce(sum(l.amount) filter (where e.entry_date between ${range.from} and ${range.to} and l.amount > 0), 0)::text as inflow,
             coalesce(-sum(l.amount) filter (where e.entry_date between ${range.from} and ${range.to} and l.amount < 0), 0)::text as outflow
        from journal_lines l join journal_entries e on e.id = l.entry_id
       where l.account in ${sql.raw(`(${accounts})`)} and e.entry_date <= ${range.to}
       group by l.account`);
    const flows = await this.rows<{ event: string; inflow: string; outflow: string }>(sql`
      select e.event,
             coalesce(sum(l.amount) filter (where l.amount > 0), 0)::text as inflow,
             coalesce(-sum(l.amount) filter (where l.amount < 0), 0)::text as outflow
        from journal_lines l join journal_entries e on e.id = l.entry_id
       where l.account in ${sql.raw(`(${accounts})`)}
         and e.entry_date between ${range.from} and ${range.to}
         -- Money moving between the drawer, the safe and the bank is not a flow in or out.
         and exists (select 1 from journal_lines o where o.entry_id = e.id
                       and o.account not in ${sql.raw(`(${accounts})`)})
       group by e.event
       order by 1`);
    return {
      from: range.from,
      to: range.to,
      accounts: MONEY_ACCOUNTS.map((account) => {
        const r = rows.find((x) => x.account === account);
        const opening = money(r?.opening);
        const inflow = money(r?.inflow);
        const outflow = money(r?.outflow);
        return {
          account,
          opening,
          in: inflow,
          out: outflow,
          closing: addMoney(opening, inflow, neg(outflow)),
        };
      }),
      flows: flows.map((f) => ({ event: f.event, in: money(f.inflow), out: money(f.outflow) })),
    };
  }

  async paymentMethods(range: ReportRange): Promise<PaymentMethodRow[]> {
    const rows = await this.rows<{
      method: string;
      purpose: string;
      direction: 'IN' | 'OUT';
      count: number;
      amount: string;
    }>(sql`
      select method::text, purpose, direction::text, count(*)::int as count,
             sum(amount_default)::text as amount
        from payments
       where not imported and business_date between ${range.from} and ${range.to}
       group by 1, 2, 3
       order by 1, 2, 3`);
    return rows.map((r) => ({ ...r, amount: money(r.amount) }));
  }

  async expenses(range: ReportRange) {
    const { rows } = await this.balances(range, ['OPERATING_EXPENSES']);
    const byCategory = new Map<string, string>();
    for (const r of rows)
      byCategory.set(
        r.dimension ?? 'OTHER',
        addMoney(byCategory.get(r.dimension ?? 'OTHER') ?? ZERO, r.total),
      );
    return [...byCategory]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => toMinor(b.amount) - toMinor(a.amount));
  }

  // ------------------------------------------------------------------ debts

  async debts(): Promise<DebtsReport> {
    const today = await this.ledger.today(this.db);
    const balances = await this.rows<{
      id: string;
      name: string;
      phone: string | null;
      owed: string;
    }>(sql`
      select c.id, c.name, c.phone, sum(l.amount)::text as owed
        from journal_lines l join customers c on c.id = l.party_id
       where l.account = 'CUSTOMER_RECEIVABLES' and l.party_type = 'CUSTOMER'
       group by c.id
      having sum(l.amount) > 0
       order by sum(l.amount) desc`);
    const open = await this.rows<{
      customerId: string;
      open: string;
      age: number;
      date: string;
    }>(sql`
      select s.customer_id as "customerId",
             (s.total - s.returned_total - coalesce((select sum(a.amount) from payment_allocations a where a.sale_id = s.id), 0))::text as open,
             (${today}::date - s.business_date)::int as age,
             s.business_date::text as date
        from sales s
       where s.customer_id is not null and s.status = 'COMPLETED'
         and s.total - s.returned_total > coalesce((select sum(a.amount) from payment_allocations a where a.sale_id = s.id), 0)`);
    const [credit] = await this.rows<{ total: string }>(sql`
      select coalesce(-sum(amount), 0)::text as total from journal_lines where account = 'CUSTOMER_CREDIT'`);
    const customers = balances.map((c) => {
      const mine = open.filter((o) => o.customerId === c.id);
      const aging = bucket(mine);
      // Debt with no open sale behind it (opening balances) counts as oldest.
      const covered = addMoney(ZERO, ...mine.map((o) => o.open));
      const rest = addMoney(c.owed, neg(covered));
      if (toMinor(rest) > 0) aging.days90 = addMoney(aging.days90, rest);
      const oldest = mine.map((o) => o.date).sort()[0] ?? null;
      return { id: c.id, name: c.name, phone: c.phone, owed: money(c.owed), aging, oldest };
    });
    return {
      customers,
      totals: {
        owed: addMoney(ZERO, ...customers.map((c) => c.owed)),
        aging: sumBuckets(customers.map((c) => c.aging)),
        customerCredit: money(credit?.total),
      },
    };
  }

  async supplierDebts(): Promise<SupplierDebtsReport> {
    const today = await this.ledger.today(this.db);
    const balances = await this.rows<{ id: string; name: string; owed: string }>(sql`
      select s.id, s.name, (-sum(l.amount))::text as owed
        from journal_lines l join suppliers s on s.id = l.party_id
       where l.account = 'SUPPLIER_PAYABLES' and l.party_type = 'SUPPLIER'
       group by s.id
      having -sum(l.amount) > 0
       order by -sum(l.amount) desc`);
    const open = await this.rows<{
      supplierId: string;
      open: string;
      age: number;
      date: string;
    }>(sql`
      select r.supplier_id as "supplierId",
             (r.total - coalesce((select sum(a.amount) from supplier_allocations a where a.receipt_id = r.id), 0))::text as open,
             (${today}::date - (r.created_at at time zone 'UTC')::date)::int as age,
             (r.created_at at time zone 'UTC')::date::text as date
        from supplier_receipts r
       where r.total > coalesce((select sum(a.amount) from supplier_allocations a where a.receipt_id = r.id), 0)`);
    const suppliers = balances.map((s) => {
      const mine = open.filter((o) => o.supplierId === s.id);
      const aging = bucket(mine);
      const rest = addMoney(s.owed, neg(addMoney(ZERO, ...mine.map((o) => o.open))));
      if (toMinor(rest) > 0) aging.days90 = addMoney(aging.days90, rest);
      if (toMinor(rest) < 0) aging.current = addMoney(aging.current, rest);
      return {
        id: s.id,
        name: s.name,
        owed: money(s.owed),
        aging,
        oldest: mine.map((o) => o.date).sort()[0] ?? null,
      };
    });
    return {
      suppliers,
      totals: {
        owed: addMoney(ZERO, ...suppliers.map((s) => s.owed)),
        aging: sumBuckets(suppliers.map((s) => s.aging)),
      },
    };
  }

  // ------------------------------------------------------------------ inventory

  async inventory(): Promise<InventoryValuation> {
    const rows = await this.rows<{
      id: string | null;
      name: string | null;
      pieces: number;
      value: string;
      retail: string;
      unknown: number;
      damaged: number;
    }>(sql`
      select c.id, c.name::text as name,
             coalesce(sum(b.on_hand), 0)::int as pieces,
             coalesce(sum(round(b.on_hand * coalesce(b.avg_cost, 0), 2)), 0)::text as value,
             coalesce(sum(b.on_hand * coalesce(i.price, p.price)), 0)::text as retail,
             coalesce(sum(b.on_hand) filter (where b.avg_cost is null), 0)::int as unknown,
             coalesce(sum(b.damaged), 0)::int as damaged
        from item_balances b
        join items i on i.id = b.item_id
        join products p on p.id = i.product_id
        left join categories c on c.id = p.category_id
       where b.on_hand > 0 or b.damaged > 0
       group by c.id
       order by 4 desc`);
    const [ledger] = await this.rows<{ total: string }>(sql`
      select coalesce(sum(amount), 0)::text as total from journal_lines where account = 'INVENTORY'`);
    const categories = rows.map((r) => ({
      id: r.id,
      name: r.name ? (JSON.parse(r.name) as { ar?: string; en?: string; he?: string }) : '—',
      pieces: r.pieces,
      value: money(r.value),
      retail: money(r.retail),
    }));
    return {
      categories,
      totals: {
        pieces: rows.reduce((s, r) => s + r.pieces, 0),
        value: addMoney(ZERO, ...categories.map((c) => c.value)),
        retail: addMoney(ZERO, ...categories.map((c) => c.retail)),
        unknownCost: rows.reduce((s, r) => s + r.unknown, 0),
        damaged: rows.reduce((s, r) => s + r.damaged, 0),
        ledger: money(ledger?.total),
      },
    };
  }

  // ------------------------------------------------------------------ daily summary

  async daily(actor: Actor, date: string): Promise<DailySummary> {
    const range = { from: date, to: date };
    const [sales] = await this.rows<{ count: number; total: string; pieces: number }>(sql`
      select count(*)::int as count, coalesce(sum(s.total), 0)::text as total,
             coalesce((select sum(l.quantity) from sale_lines l join sales x on x.id = l.sale_id
                        where x.business_date = ${date} and x.status = 'COMPLETED' and not x.imported), 0)::int as pieces
        from sales s where s.business_date = ${date} and s.status = 'COMPLETED' and not s.imported`);
    const [returns] = await this.rows<{ count: number; total: string }>(sql`
      select count(*)::int as count, coalesce(sum(value), 0)::text as total
        from sale_returns where business_date = ${date}`);
    const shifts = await this.rows<{
      id: string;
      number: string;
      register: string;
      openedBy: string;
      status: string;
      difference: string | null;
    }>(sql`
      select s.id, s.number, r.name as register, u.name as "openedBy", s.status::text as status,
             (select sum(c.amount - c.expected)::text from shift_counts c
               where c.shift_id = s.id and c.kind = (case when exists (
                       select 1 from shift_counts z where z.shift_id = s.id and z.kind = 'RECOUNT')
                     then 'RECOUNT' else 'CLOSING' end)::shift_count_kind) as difference
        from shifts s join registers r on r.id = s.register_id join users u on u.id = s.opened_by
       where s.business_date = ${date} and not s.imported
       order by s.opened_at`);
    const pl = roleCan(actor.role, 'reports.cost') ? await this.profitAndLoss(actor, range) : null;
    return {
      date,
      sales: { count: sales?.count ?? 0, total: money(sales?.total), pieces: sales?.pieces ?? 0 },
      returns: { count: returns?.count ?? 0, total: money(returns?.total) },
      payments: await this.paymentMethods(range),
      expenses: await this.expenses(range),
      shifts: shifts.map((s) => ({
        ...s,
        difference: s.status === 'OPEN' || s.difference === null ? null : money(s.difference),
      })),
      grossProfit: pl?.grossProfit ?? null,
    };
  }

  // ------------------------------------------------------------------ today

  async today(actor: Actor): Promise<TodayView> {
    const date = await this.ledger.today(this.db);
    const shop = roleCan(actor.role, 'reports.view');
    const own = shop ? sql`true` : sql`s.created_by = ${actor.id}`;
    const salesOn = async (from: string, to = from) =>
      (
        await this.rows<{ count: number; total: string; pieces: number }>(sql`
          select count(*)::int as count, coalesce(sum(s.total - s.returned_total), 0)::text as total,
                 coalesce(sum((select sum(l.quantity - l.returned) from sale_lines l where l.sale_id = s.id)), 0)::int as pieces
            from sales s
           where s.business_date between ${from} and ${to} and s.status = 'COMPLETED'
             and not s.imported and ${own}`)
      )[0]!;
    const todaySales = await salesOn(date);
    const lastWeek = await salesOn(shift(date, -7));
    const byMethod = await this.rows<{ method: string; amount: string }>(sql`
      select p.method::text as method,
             sum(case when p.direction = 'IN' then p.amount_default else -p.amount_default end)::text as amount
        from payments p
       where p.business_date = ${date} and not p.imported and p.supplier_id is null
         and p.purpose <> 'CHANGE' ${shop ? sql`` : sql`and p.taken_by = ${actor.id}`}
       group by 1 order by 2 desc`);
    const last7 = await this.rows<{ date: string; total: string }>(sql`
      select d::date::text as date,
             coalesce((select sum(s.total - s.returned_total) from sales s
                        where s.business_date = d::date and s.status = 'COMPLETED' and not s.imported and ${own}), 0)::text as total
        from generate_series(${shift(date, -6)}::date, ${date}::date, interval '1 day') d
       order by 1`);
    const orders = await this.rows<{ status: string; count: number }>(sql`
      select status::text, count(*)::int as count from orders
       where status in ('NEW','CONFIRMED','PREPARING','READY','OUT') group by 1`);
    const threshold = (await this.settings.get()).lowStockThreshold;
    const [counts] = await this.rows<{
      held: number;
      approvals: number;
      shifts: number;
      low: number;
    }>(sql`
      select (select count(*) from sales where fulfilment_status in ('HELD','PARTLY_HANDED') and status = 'COMPLETED')::int as held,
             (select count(*) from approval_requests where status = 'PENDING')::int as approvals,
             (select count(*) from shifts where status = 'OPEN')::int as shifts,
             (select count(*) from item_balances b join items i on i.id = b.item_id join products p on p.id = i.product_id
               where p.status = 'ACTIVE' and i.is_active and i.archived_at is null
                 and b.on_hand - b.reserved <= coalesce(p.low_stock_threshold, ${threshold}))::int as low`);
    const [debts] = shop
      ? await this.rows<{ total: string }>(sql`
          select coalesce(sum(amount), 0)::text as total from journal_lines
           where account = 'CUSTOMER_RECEIVABLES'`)
      : [];
    const cost = roleCan(actor.role, 'reports.cost')
      ? (await this.profitAndLoss(actor, { from: date, to: date })).grossProfit
      : null;
    return {
      date,
      scope: shop ? 'SHOP' : 'OWN',
      sales: { count: todaySales.count, total: money(todaySales.total), pieces: todaySales.pieces },
      byMethod: byMethod.map((m) => ({ method: m.method, amount: money(m.amount) })),
      grossProfit: cost,
      lastWeek: { count: lastWeek.count, total: money(lastWeek.total) },
      orders,
      heldSales: counts?.held ?? 0,
      approvalsWaiting: shop ? (counts?.approvals ?? 0) : 0,
      openShifts: counts?.shifts ?? 0,
      lowStock: counts?.low ?? 0,
      debtsOwed: debts ? money(debts.total) : null,
      last7: last7.map((d) => ({ date: d.date, total: money(d.total) })),
    };
  }

  // ------------------------------------------------------------------ activity

  /**
   * What happened lately, from the audit log. Employees see their own actions; managers see
   * everyone's. Costs and logins are left out.
   */
  async activity(actor: Actor, limit: number): Promise<ActivityItem[]> {
    const shop = roleCan(actor.role, 'reports.view');
    const rows = await this.rows<{
      id: string;
      at: Date;
      action: string;
      entity: string;
      entityId: string | null;
      by: string | null;
      summary: Record<string, unknown> | null;
    }>(sql`
      select a.id, a.occurred_at as at, a.action, a.entity, a.entity_id as "entityId",
             u.name as by, a.new_value as summary
        from audit_log a left join users u on u.id = a.user_id
       where a.action not like 'AUTH%' and a.action not like 'LOGIN%'
         ${shop ? sql`` : sql`and a.user_id = ${actor.id}`}
       order by a.occurred_at desc
       limit ${limit}`);
    return rows.map((r) => ({
      ...r,
      at: new Date(r.at).toISOString(),
      summary: pick(r.summary),
    }));
  }
}

/** Keeps the few fields a feed line needs; never costs. */
function pick(v: Record<string, unknown> | null) {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const k of ['number', 'total', 'amount', 'name', 'reason', 'status', 'kind', 'method'])
    if (k in v && (typeof v[k] === 'string' || typeof v[k] === 'number')) out[k] = v[k];
  return Object.keys(out).length ? out : null;
}
