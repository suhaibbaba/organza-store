import { Injectable } from '@nestjs/common';
import {
  addMoney,
  allocateMoney,
  buildSearchText,
  compareMoney,
  fromMinor,
  multiplyMoney,
  nationalPhoneDigits,
  phoneIdentityKey,
  toE164,
  toMinor,
  type Translatable,
} from '@organza/shared';
import { and, eq, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { businessDate } from '../common/lib/dates.js';
import { AuditService } from '../common/services/audit.service.js';
import { InjectDb } from '../database/database.module.js';
import {
  couriers,
  customers,
  journalEntries,
  journalLines,
  legacyIds,
  orderEvents,
  orderLines,
  orders,
  paymentAllocations,
  payments,
  registers,
  saleLines,
  sales,
  shiftCounts,
  shifts,
  users,
} from '../database/schema/index.js';
import { type Database, inTransaction, type Transaction } from '../database/unit-of-work.js';
import { credit, debit, LedgerService } from '../modules/ledger/services/ledger.service.js';
import { CurrenciesService } from '../modules/settings/services/currencies.service.js';
import type { LegacyCashSession } from '../modules/sales/services/shifts.service.js';
import { SettingsService } from '../modules/settings/services/settings.service.js';

/* Rows as the old Prisma schema stores them. */
interface OldUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  phone: string | null;
  isActive: boolean;
  password: string | null;
}
interface OldOrder {
  id: string;
  orderNumber: number;
  channel: 'STORE' | 'WHATSAPP' | 'WEBSITE';
  type: 'SALE' | 'GIFT';
  status: 'NEW' | 'PREPARING' | 'HANDED_TO_COURIER' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';
  paymentStatus: 'PENDING_COLLECTION' | 'COLLECTED';
  collectedAt: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerAddress: string | null;
  note: string | null;
  subtotal: string;
  discountAmount: string;
  total: string;
  deletedAt: Date | null;
  /** Set once the old system took the pieces off the shelf (counter sales at once, online
   *  orders when they started being prepared). */
  stockDeductedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}
interface OldOrderItem {
  orderId: string;
  productId: string | null;
  variantId: string | null;
  name: Translatable;
  variantName: Translatable | null;
  sku: string | null;
  unitPrice: string;
  unitCost: string | null;
  quantity: number;
  discountAmount: string;
  lineTotal: string;
  returnedQuantity: number;
}
interface OldCashSession {
  id: string;
  date: Date;
  status: 'OPEN' | 'CLOSED';
  openingFloat: string;
  cashSales: string | null;
  cashExpenses: string | null;
  expectedAmount: string | null;
  countedAmount: string | null;
  withdrawnAmount: string;
  difference: string | null;
  note: string | null;
  followUpResolvedAt: Date | null;
  followUpResolvedById: string | null;
  openedById: string;
  closedById: string | null;
  openedAt: Date;
  closedAt: Date | null;
}

export interface HistoryReport {
  dryRun: boolean;
  counts: Record<string, number>;
  months: { month: string; old: string; imported: string }[];
  money: { collected: string; outstanding: string; withCouriers: string };
  /** Customers whose names match but phones differ: to look at before cut-over. */
  reviewCustomers: { name: string; phones: string[] }[];
  warnings: string[];
  checks: { name: string; ok: boolean; detail?: string }[];
}

class DryRunRollback extends Error {
  constructor(readonly report: HistoryReport) {
    super('dry run');
  }
}

const SOURCE = { STORE: 'COUNTER', WHATSAPP: 'WHATSAPP', WEBSITE: 'ONLINE' } as const;
const OLD_TILL = 'الصندوق القديم';
/** The old system did not record which delivery company took a parcel. */
const OLD_COURIER = 'شركة التوصيل (النظام القديم)';
const OPEN_ONLINE = ['NEW', 'PREPARING', 'HANDED_TO_COURIER'];
const UNUSABLE_PASSWORD = '!legacy';
const neg = (v: string) => fromMinor(-toMinor(v));
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const normalName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * One-way import of the old system's people and history: staff accounts (their old password
 * hashes are checked once at first sign-in), customers built from the snapshots on orders and
 * de-duplicated by phone, orders as imported sales with their cash payment, and cash sessions as
 * imported closed shifts on an old till, gifts as giveaway sales.
 *
 * Online orders still in progress become orders:
 * - The ones whose pieces already left the shelf keep their imported sale and are out with one
 *   "old system" delivery company. What it still owes is its opening balance, so it is settled
 *   on the Couriers screen like any other parcel.
 * - New orders whose pieces are still on the shelf become new orders with no sale yet.
 *
 * Those courier balances are the only thing posted to the ledger (it starts at cut-over).
 * Runs in one transaction; a rehearsal (the default) rolls back and only reports.
 */
@Injectable()
export class HistoryImporter {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly currencies: CurrenciesService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  async run(source: postgres.Sql, options: { commit: boolean }): Promise<HistoryReport> {
    const old = await this.read(source);
    try {
      return await inTransaction(this.db, async (tx) => {
        const report = await this.write(tx, old, !options.commit);
        if (!options.commit) throw new DryRunRollback(report);
        return report;
      });
    } catch (error) {
      if (error instanceof DryRunRollback) return error.report;
      throw error;
    }
  }

  private async read(source: postgres.Sql) {
    const [people, orders, lines, sessions] = await Promise.all([
      source<OldUser[]>`
        select u.id, u.name, u.email, u.role, u.phone, u."isActive", a.password
          from "user" u
          left join "account" a on a."userId" = u.id and a."providerId" = 'credential'
         order by u."createdAt"`,
      source<OldOrder[]>`select * from "Order" order by "orderNumber"`,
      source<OldOrderItem[]>`select * from "OrderItem" order by "orderId", "createdAt", id`,
      source<OldCashSession[]>`select * from "CashSession" order by date`,
    ]);
    return { people, orders, lines, sessions };
  }

  private async write(
    tx: Transaction,
    old: Awaited<ReturnType<HistoryImporter['read']>>,
    dryRun: boolean,
  ): Promise<HistoryReport> {
    const warnings: string[] = [];
    const counts: Record<string, number> = {};
    const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

    const [already] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.imported, true));
    if (already?.n) throw new Error('History was already imported; the import runs once');
    const legacy = await tx.select().from(legacyIds);
    const legacyMap = (entity: string) =>
      new Map(legacy.filter((l) => l.entity === entity).map((l) => [l.legacyId, l.newId]));
    const productIds = legacyMap('product');
    if (productIds.size === 0 && old.lines.some((l) => l.productId))
      throw new Error('Import the catalogue first: orders refer to products');
    const variantItems = legacyMap('variant');
    const productItems = legacyMap('product_item');
    const remember = (entity: string, legacyId: string, newId: string) =>
      tx.insert(legacyIds).values({ entity, legacyId, newId });

    const { timezone, defaultCountryCode } = await this.settings.get(tx);
    const currency = await this.currencies.defaultCode(tx);
    const [entriesBefore] = await tx.select({ n: sql<number>`count(*)::int` }).from(journalEntries);

    // ---------------------------------------------------------------- staff
    const userIds = new Map<string, string>();
    for (const u of old.people) {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(sql`lower(${users.email})`, u.email.toLowerCase()));
      if (existing) {
        userIds.set(u.id, existing.id);
        bump('staff.matched');
      } else {
        const [row] = await tx
          .insert(users)
          .values({
            email: u.email,
            name: u.name,
            phone: u.phone,
            role: u.role,
            passwordHash: UNUSABLE_PASSWORD,
            legacyPasswordHash: u.password,
            isActive: u.isActive,
          })
          .returning({ id: users.id });
        userIds.set(u.id, row!.id);
        bump('staff.imported');
        if (!u.password) warnings.push(`${u.email} has no password in the old system`);
      }
      await remember('user', u.id, userIds.get(u.id)!);
    }
    let fallback: string | undefined;
    const staff = async (oldId: string | null) => {
      if (oldId && userIds.has(oldId)) return userIds.get(oldId)!;
      if (!fallback) {
        const [row] = await tx
          .insert(users)
          .values({
            email: 'old-system@organza.invalid',
            name: 'Old system',
            role: 'EMPLOYEE',
            passwordHash: UNUSABLE_PASSWORD,
            isActive: false,
          })
          .returning({ id: users.id });
        fallback = row!.id;
        warnings.push('Some history had no known staff member; it is attributed to "Old system"');
      }
      return fallback;
    };

    // ---------------------------------------------------------------- cash sessions
    const [till] = await tx
      .insert(registers)
      .values({ name: OLD_TILL, isActive: false })
      .returning({ id: registers.id });
    const shiftByDate = new Map<string, string>();
    for (const s of old.sessions) {
      const day = dateOnly(s.date);
      const openedBy = await staff(s.openedById);
      const closedBy = s.closedById ? await staff(s.closedById) : null;
      if (s.status === 'OPEN') warnings.push(`The cash session of ${day} was never closed`);
      const figures: LegacyCashSession = {
        currency,
        openingFloat: addMoney(s.openingFloat),
        cashSales: s.cashSales === null ? null : addMoney(s.cashSales),
        cashExpenses: s.cashExpenses === null ? null : addMoney(s.cashExpenses),
        expected: s.expectedAmount === null ? null : addMoney(s.expectedAmount),
        counted: s.countedAmount === null ? null : addMoney(s.countedAmount),
        withdrawn: addMoney(s.withdrawnAmount),
        difference: s.difference === null ? null : addMoney(s.difference),
      };
      const [row] = await tx
        .insert(shifts)
        .values({
          number: `OLD-SHF-${day}`,
          registerId: till!.id,
          status: 'CLOSED',
          businessDate: day,
          openedBy,
          openedAt: s.openedAt,
          countedBy: closedBy,
          countedAt: s.closedAt,
          closedBy,
          closedAt: s.closedAt ?? s.openedAt,
          closeNote: s.note,
          hasDifference: s.difference !== null && Number(s.difference) !== 0,
          signedOffAt: s.followUpResolvedAt,
          signedOffBy: s.followUpResolvedById ? await staff(s.followUpResolvedById) : null,
          imported: true,
          legacy: figures,
        })
        .returning({ id: shifts.id });
      shiftByDate.set(day, row!.id);
      await tx.insert(shiftCounts).values({
        shiftId: row!.id,
        kind: 'OPENING',
        currency,
        amount: figures.openingFloat,
        expected: figures.openingFloat,
        countedBy: openedBy,
        countedAt: s.openedAt,
      });
      if (figures.counted !== null)
        await tx.insert(shiftCounts).values({
          shiftId: row!.id,
          kind: 'CLOSING',
          currency,
          amount: figures.counted,
          expected: figures.expected ?? figures.counted,
          countedBy: closedBy ?? openedBy,
          countedAt: s.closedAt ?? s.openedAt,
          note: s.note,
        });
      await remember('cash_session', s.id, row!.id);
      bump('shifts');
    }

    // ---------------------------------------------------------------- customers
    const live = old.orders.filter((o) => !o.deletedAt);
    const customerByKey = new Map<
      string,
      { phone: string; whatsapp: string | null; name: string; address: string | null; at: Date }
    >();
    let unusablePhones = 0;
    for (const o of live) {
      const raw = o.customerPhone ?? o.customerWhatsapp;
      if (!raw) continue;
      const phone = toE164(raw, defaultCountryCode);
      if (!phone) {
        unusablePhones++;
        continue;
      }
      const whatsapp = o.customerWhatsapp ? toE164(o.customerWhatsapp, defaultCountryCode) : null;
      const key = phoneIdentityKey(phone);
      const seen = customerByKey.get(key);
      // The newest order wins for name and address; older ones fill what is missing.
      if (!seen || seen.at <= o.createdAt)
        customerByKey.set(key, {
          phone,
          whatsapp: whatsapp ?? seen?.whatsapp ?? null,
          name: o.customerName?.trim() || seen?.name || phone,
          address: o.customerAddress?.trim() || seen?.address || null,
          at: o.createdAt,
        });
      else {
        seen.whatsapp ??= whatsapp;
        seen.address ??= o.customerAddress?.trim() || null;
      }
    }
    if (unusablePhones)
      warnings.push(`${unusablePhones} orders have a phone that is not a phone number`);
    const customerIds = new Map<string, string>();
    for (const [key, c] of customerByKey) {
      const [existing] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.phoneKey, key), sql`${customers.mergedIntoId} is null`));
      if (existing) {
        customerIds.set(key, existing.id);
        bump('customers.matched');
        continue;
      }
      const [row] = await tx
        .insert(customers)
        .values({
          name: c.name,
          phone: c.phone,
          phoneKey: key,
          whatsapp: c.whatsapp,
          address: c.address,
          searchText: buildSearchText(
            c.name,
            nationalPhoneDigits(c.phone),
            c.whatsapp ? nationalPhoneDigits(c.whatsapp) : '',
          ),
        })
        .returning({ id: customers.id });
      customerIds.set(key, row!.id);
      bump('customers');
    }
    const byName = new Map<string, Set<string>>();
    for (const c of customerByKey.values()) {
      const set = byName.get(normalName(c.name)) ?? new Set<string>();
      set.add(c.phone);
      byName.set(normalName(c.name), set);
    }
    const reviewCustomers = [...byName]
      .filter(([, phones]) => phones.size > 1)
      .map(([name, phones]) => ({ name, phones: [...phones].sort() }));

    // ---------------------------------------------------------------- orders
    const linesByOrder = new Map<string, OldOrderItem[]>();
    for (const l of old.lines)
      linesByOrder.set(l.orderId, [...(linesByOrder.get(l.orderId) ?? []), l]);
    const oldMonths = new Map<string, string>();
    const newMonths = new Map<string, string>();
    let collected = '0.00';
    let outstanding = '0.00';
    let unresolved = 0;
    let oldCollected = '0.00';
    let oldOutstanding = '0.00';
    let eligible = 0;
    const waiting: OldOrder[] = [];
    const out: { o: OldOrder; saleId: string; customerId: string | null; createdBy: string }[] = [];

    for (const o of old.orders) {
      if (o.deletedAt) {
        bump('orders.skipped.deleted');
        continue;
      }
      const gift = o.type === 'GIFT' && compareMoney(o.total, 0) === 0;
      if (o.type === 'GIFT' && !gift)
        warnings.push(`Gift #${o.orderNumber} has a price (${o.total}); imported as a sale`);
      // Still waiting and nothing taken off the shelf: an order, not yet a sale.
      if (OPEN_ONLINE.includes(o.status) && !o.stockDeductedAt) {
        waiting.push(o);
        continue;
      }
      eligible++;
      const day = businessDate(timezone, o.createdAt);
      const cancelled = o.status === 'CANCELLED';
      if (!cancelled) {
        const month = day.slice(0, 7);
        oldMonths.set(month, addMoney(oldMonths.get(month) ?? '0', o.total));
        if (o.paymentStatus === 'COLLECTED') oldCollected = addMoney(oldCollected, o.total);
        else oldOutstanding = addMoney(oldOutstanding, o.total);
      }

      // Lines: gross price, the line's own discount, then the order discount spread by value so
      // that the imported total equals the old one exactly.
      const oldLines = (linesByOrder.get(o.id) ?? []).filter((l) => l.quantity > 0);
      const gross = oldLines.map((l) => multiplyMoney(l.unitPrice, l.quantity));
      const nets = oldLines.map((l, i) => addMoney(gross[i]!, neg(l.discountAmount)));
      const netSum = addMoney('0', ...nets);
      const orderDiscount = addMoney(netSum, neg(o.total));
      if (compareMoney(orderDiscount, 0) < 0 || oldLines.length === 0) {
        warnings.push(
          `Order #${o.orderNumber}: lines (${netSum}) do not add up to its total (${o.total}); not imported`,
        );
        bump('orders.skipped.inconsistent');
        continue;
      }
      const shares =
        compareMoney(orderDiscount, 0) > 0
          ? allocateMoney(
              orderDiscount,
              nets.map((n) => toMinor(n)),
            )
          : nets.map(() => '0.00');
      const subtotal = addMoney('0', ...gross);
      const discountTotal = addMoney(subtotal, neg(o.total));

      const raw = o.customerPhone ?? o.customerWhatsapp;
      const phone = raw ? toE164(raw, defaultCountryCode) : null;
      const customerId = phone ? (customerIds.get(phoneIdentityKey(phone)) ?? null) : null;
      const createdBy = await staff(o.createdById);
      const notes = [
        o.note,
        !customerId && o.customerName ? `${o.customerName}${raw ? ` ${raw}` : ''}` : null,
        o.status === 'RETURNED' ? `[${o.status}]` : null,
      ].filter(Boolean);
      const [sale] = await tx
        .insert(sales)
        .values({
          number: `OLD-${o.orderNumber}`,
          source: SOURCE[o.channel],
          status: cancelled ? 'CANCELLED' : 'COMPLETED',
          customerId,
          shiftId: o.channel === 'STORE' ? (shiftByDate.get(day) ?? null) : null,
          businessDate: day,
          subtotal,
          discountTotal,
          total: addMoney(o.total),
          note: notes.join(' · ') || null,
          imported: true,
          createdBy,
          createdAt: o.createdAt,
          cancelledAt: cancelled ? o.updatedAt : null,
          cancelReason: cancelled ? 'Cancelled in the old system' : null,
        })
        .returning({ id: sales.id });
      await remember('order', o.id, sale!.id);
      bump(cancelled ? 'sales.cancelled' : gift ? 'sales.gifts' : 'sales');
      if (o.status === 'RETURNED' || oldLines.some((l) => l.returnedQuantity > 0))
        bump('orders.withReturns');
      if (OPEN_ONLINE.includes(o.status)) out.push({ o, saleId: sale!.id, customerId, createdBy });

      await tx.insert(saleLines).values(
        oldLines.map((l, i) => {
          const discount = addMoney(l.discountAmount, shares[i]!);
          const itemId = l.variantId
            ? variantItems.get(l.variantId)
            : l.productId
              ? productItems.get(l.productId)
              : undefined;
          if ((l.variantId || l.productId) && !itemId) unresolved++;
          return {
            saleId: sale!.id,
            position: i + 1,
            itemId: itemId ?? null,
            productId: l.productId ? (productIds.get(l.productId) ?? null) : null,
            name: l.name,
            variantLabel: l.variantName,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: gift ? '0.00' : addMoney(l.unitPrice),
            discount: gift ? '0.00' : discount,
            lineTotal: gift ? '0.00' : addMoney(gross[i]!, neg(discount)),
            unitCost: l.unitCost,
            costUnknown: l.unitCost === null,
            handedOver: l.quantity,
            giveaway: gift,
          };
        }),
      );
      bump('saleLines', oldLines.length);

      if (cancelled) continue;
      const month = day.slice(0, 7);
      newMonths.set(month, addMoney(newMonths.get(month) ?? '0', o.total));
      // Store orders and collected online orders were paid in cash; pending ones are still with
      // the courier (their balance is the courier's opening balance, below).
      if (o.paymentStatus !== 'COLLECTED') {
        outstanding = addMoney(outstanding, o.total);
        continue;
      }
      if (compareMoney(o.total, 0) === 0) continue;
      const at = o.collectedAt ?? o.createdAt;
      const payDay = businessDate(timezone, at);
      const [payment] = await tx
        .insert(payments)
        .values({
          number: `OLD-PAY-${o.orderNumber}`,
          direction: 'IN',
          method: 'CASH',
          currency,
          amount: addMoney(o.total),
          rate: '1',
          amountDefault: addMoney(o.total),
          customerId,
          shiftId: shiftByDate.get(payDay) ?? null,
          saleId: sale!.id,
          purpose: 'SALE',
          businessDate: payDay,
          takenBy: createdBy,
          takenAt: at,
          imported: true,
        })
        .returning({ id: payments.id });
      await tx.insert(paymentAllocations).values({
        paymentId: payment!.id,
        saleId: sale!.id,
        amount: addMoney(o.total),
        createdBy,
        createdAt: at,
      });
      collected = addMoney(collected, o.total);
      bump('payments');
    }
    if (counts['orders.withReturns'])
      warnings.push(
        `${counts['orders.withReturns']} orders had returns: imported as sales at their old total, without the return`,
      );

    // ---------------------------------------------------------------- open online orders
    const cutover = await this.ledger.today(tx);
    let courierId: string | undefined;
    let cod = '0.00';
    const oldCourier = async () => {
      if (!courierId) {
        const [row] = await tx
          .insert(couriers)
          .values({ name: OLD_COURIER, note: 'Imported from the old system' })
          .returning({ id: couriers.id });
        courierId = row!.id;
      }
      return courierId;
    };
    const openOrder = async (
      o: OldOrder,
      customerId: string,
      createdBy: string,
    ): Promise<string | null> => {
      const oldLines = (linesByOrder.get(o.id) ?? []).filter((l) => l.quantity > 0);
      const resolved = oldLines.map((l) =>
        l.variantId
          ? variantItems.get(l.variantId)
          : l.productId
            ? productItems.get(l.productId)
            : undefined,
      );
      if (oldLines.length === 0 || resolved.some((id) => !id)) {
        warnings.push(`Order #${o.orderNumber}: a piece is not in the catalogue; not an order`);
        return null;
      }
      const [row] = await tx
        .insert(orders)
        .values({
          number: `OLD-${o.orderNumber}`,
          source: SOURCE[o.channel],
          status: o.status === 'NEW' ? 'NEW' : 'PREPARING',
          customerId,
          delivery: 'COURIER',
          address: o.customerAddress?.trim() || null,
          note: o.note,
          createdBy,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })
        .returning({ id: orders.id });
      await tx.insert(orderLines).values(
        oldLines.map((l, i) => ({
          orderId: row!.id,
          position: i + 1,
          itemId: resolved[i]!,
          quantity: l.quantity,
          unitPrice: addMoney(l.unitPrice),
          discount: addMoney(l.discountAmount),
        })),
      );
      await remember('online_order', o.id, row!.id);
      return row!.id;
    };
    const event = (orderId: string, to: 'NEW' | 'OUT', o: OldOrder, createdBy: string) =>
      tx.insert(orderEvents).values({
        orderId,
        toStatus: to,
        note: `Imported from the old system (${o.status})`,
        createdBy,
        createdAt: o.updatedAt,
      });

    for (const o of waiting) {
      const raw = o.customerPhone ?? o.customerWhatsapp;
      const phone = raw ? toE164(raw, defaultCountryCode) : null;
      const customerId = phone ? customerIds.get(phoneIdentityKey(phone)) : undefined;
      if (!customerId) {
        warnings.push(`Order #${o.orderNumber} is new and has no phone; enter it again by hand`);
        bump('orders.skipped.noCustomer');
        continue;
      }
      const createdBy = await staff(o.createdById);
      const id = await openOrder(o, customerId, createdBy);
      if (!id) continue;
      await event(id, 'NEW', o, createdBy);
      bump('orders.new');
    }

    for (const { o, saleId, customerId, createdBy } of out) {
      if (!customerId) {
        warnings.push(
          `Order #${o.orderNumber} (${o.status}) has no phone: kept as a sale, not on the Orders screen`,
        );
        bump('orders.skipped.noCustomer');
        continue;
      }
      const id = await openOrder(o, customerId, createdBy);
      if (!id) continue;
      const owed = o.paymentStatus === 'COLLECTED' ? '0.00' : addMoney(o.total);
      const courier = await oldCourier();
      // The guards allow only the real steps: prepared, ready, then out with its sale.
      await tx.update(orders).set({ status: 'READY' }).where(eq(orders.id, id));
      await tx
        .update(orders)
        .set({ status: 'OUT', saleId, courierId: courier, cod: owed, updatedAt: o.updatedAt })
        .where(eq(orders.id, id));
      await event(id, 'OUT', o, createdBy);
      bump(o.status === 'HANDED_TO_COURIER' ? 'orders.out' : 'orders.out.notYetSent');
      if (compareMoney(owed, 0) === 0) continue;
      const [payment] = await tx
        .insert(payments)
        .values({
          number: `OLD-COD-${o.orderNumber}`,
          direction: 'IN',
          method: 'COURIER',
          currency,
          amount: owed,
          rate: '1',
          amountDefault: owed,
          customerId,
          courierId: courier,
          saleId,
          orderId: id,
          purpose: 'SALE',
          businessDate: cutover,
          takenBy: createdBy,
          takenAt: o.updatedAt,
          imported: true,
        })
        .returning({ id: payments.id });
      await tx.insert(paymentAllocations).values({
        paymentId: payment!.id,
        saleId,
        amount: owed,
        createdBy,
        createdAt: o.updatedAt,
      });
      await this.ledger.post(tx, {
        sourceType: 'payment',
        sourceId: payment!.id,
        event: 'OPENING_BALANCE',
        createdBy,
        entryDate: cutover,
        lines: [
          debit('COURIER_RECEIVABLES', owed, { partyType: 'COURIER', partyId: courier }),
          credit('OPENING_BALANCES', owed),
        ],
      });
      cod = addMoney(cod, owed);
      bump('payments.courier');
    }
    if (counts['orders.out.notYetSent'])
      warnings.push(
        `${counts['orders.out.notYetSent']} orders were still being prepared but their pieces had left the shelf: they are out with "${OLD_COURIER}"; hand them over as usual`,
      );
    const pendingDone = old.orders.filter(
      (o) =>
        !o.deletedAt &&
        o.paymentStatus === 'PENDING_COLLECTION' &&
        !OPEN_ONLINE.includes(o.status) &&
        o.status !== 'CANCELLED',
    );
    if (pendingDone.length)
      warnings.push(
        `${pendingDone.length} finished orders were never marked collected (${pendingDone.map((o) => `#${o.orderNumber}`).join(', ')}): not owed by any courier`,
      );

    // ---------------------------------------------------------------- checks
    const checks: HistoryReport['checks'] = [];
    const [imported] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.imported, true));
    const skipped = counts['orders.skipped.inconsistent'] ?? 0;
    checks.push({
      name: 'every order became a sale',
      ok: imported?.n === eligible - skipped && skipped === 0,
      detail: `${imported?.n} of ${eligible}`,
    });
    const months = [...new Set([...oldMonths.keys(), ...newMonths.keys()])].sort().map((m) => ({
      month: m,
      old: oldMonths.get(m) ?? '0.00',
      imported: newMonths.get(m) ?? '0.00',
    }));
    const monthsOff = months.filter((m) => compareMoney(m.old, m.imported) !== 0);
    checks.push({
      name: 'sales totals per month match the old system',
      ok: monthsOff.length === 0,
      ...(monthsOff.length && { detail: monthsOff.map((m) => m.month).join(', ') }),
    });
    checks.push({
      name: 'collected money matches',
      ok: compareMoney(collected, oldCollected) === 0,
      detail: `${collected} vs ${oldCollected}`,
    });
    checks.push({
      name: 'money still with couriers matches',
      ok: compareMoney(outstanding, oldOutstanding) === 0,
      detail: `${outstanding} vs ${oldOutstanding}`,
    });
    checks.push({
      name: 'every sold item resolves to an imported item',
      ok: unresolved === 0,
      ...(unresolved && { detail: `${unresolved} lines` }),
    });
    const [lineTotals] = await tx.execute<{ bad: number }>(
      sql`select count(*)::int as bad from sales s
           where s.imported and s.total <> s.subtotal - s.discount_total
              or s.imported and s.total <> (select coalesce(sum(l.line_total), 0) from sale_lines l where l.sale_id = s.id)`,
    );
    checks.push({
      name: 'every sale equals the sum of its lines',
      ok: Number(lineTotals?.bad) === 0,
    });
    checks.push({
      name: 'every cash session became a shift',
      ok: (counts['shifts'] ?? 0) === old.sessions.length,
    });
    const [entriesAfter] = await tx.select({ n: sql<number>`count(*)::int` }).from(journalEntries);
    const [onCouriers] = await tx
      .select({ total: sql<string>`coalesce(sum(${journalLines.amount}), 0)::text` })
      .from(journalLines)
      .where(eq(journalLines.account, 'COURIER_RECEIVABLES'));
    const codPayments = counts['payments.courier'] ?? 0;
    checks.push({
      name: 'the ledger holds only what couriers owe',
      ok:
        entriesAfter!.n - entriesBefore!.n === codPayments &&
        compareMoney(onCouriers?.total ?? '0', cod) === 0,
      detail: `${cod} on ${codPayments} orders`,
    });

    const report: HistoryReport = {
      dryRun,
      counts,
      months,
      money: { collected, outstanding, withCouriers: cod },
      reviewCustomers,
      warnings,
      checks,
    };
    await this.audit.record(tx, {
      userId: null,
      action: 'IMPORT',
      entity: 'history',
      newValue: { counts, money: report.money, checks },
    });
    return report;
  }
}
