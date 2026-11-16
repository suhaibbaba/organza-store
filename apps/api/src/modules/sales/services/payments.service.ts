import { Injectable } from '@nestjs/common';
import {
  type AccountCode,
  compareMoney,
  multiplyMoney,
  type PaymentInput,
  type PaymentMethod,
  type PaymentView,
} from '@organza/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { conflict } from '../../../common/lib/app-error.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { paymentAllocations, payments, users } from '../../../database/schema/index.js';
import type { Executor, Transaction } from '../../../database/unit-of-work.js';
import {
  credit,
  debit,
  LedgerService,
  type PostingLine,
} from '../../ledger/services/ledger.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';
import { METHOD_ACCOUNT, type PaymentPurpose, SALES_ERRORS } from '../constants.js';

export interface PricedPayment {
  method: PaymentMethod;
  currency: string;
  amount: string;
  rate: string;
  amountDefault: string;
  reference?: string;
}

export interface RecordPayment extends PricedPayment {
  direction: 'IN' | 'OUT';
  purpose: PaymentPurpose;
  customerId: string | null;
  shiftId: string | null;
  saleId?: string | null;
  takenBy: string;
  businessDate: string;
  note?: string;
  /**
   * The other side of the posting, in the default currency. For money in these are credits
   * (summing to amountDefault); for money out, debits. Built by the caller, which knows which
   * sale or deposit the money belongs to.
   */
  counter: PostingLine[];
}

/** Records payments: the row, its journal entry and nothing else (allocations are separate). */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly currencies: CurrenciesService,
    private readonly documents: DocumentsService,
  ) {}

  /** Prices a payment in the default currency at the current rate, refusing a stale rate. */
  async price(
    executor: Executor,
    input: PaymentInput,
    defaultCurrency: string,
  ): Promise<PricedPayment> {
    const rate = await this.currencies.currentRate(executor, input.currency);
    if (input.rate !== undefined && Number(input.rate) !== Number(rate)) {
      throw conflict(SALES_ERRORS.RATE_CHANGED, 'The exchange rate changed', {
        currency: input.currency,
        rate,
      });
    }
    if (input.method === 'STORE_CREDIT' && input.currency !== defaultCurrency) {
      throw conflict(
        SALES_ERRORS.CREDIT_NOT_DEFAULT_CURRENCY,
        'Store credit is in the default currency',
      );
    }
    const amount = String(input.amount);
    return {
      method: input.method,
      currency: input.currency,
      amount,
      rate,
      amountDefault: input.currency === defaultCurrency ? amount : multiplyMoney(amount, rate),
      reference: input.reference,
    };
  }

  async record(tx: Transaction, input: RecordPayment): Promise<typeof payments.$inferSelect> {
    const number = await this.documents.next(tx, 'PAY');
    const [row] = await tx
      .insert(payments)
      .values({
        number,
        direction: input.direction,
        method: input.method,
        currency: input.currency,
        amount: input.amount,
        rate: input.rate,
        amountDefault: input.amountDefault,
        reference: input.reference ?? null,
        customerId: input.customerId,
        shiftId: input.shiftId,
        saleId: input.saleId ?? null,
        purpose: input.purpose,
        note: input.note ?? null,
        businessDate: input.businessDate,
        takenBy: input.takenBy,
      })
      .returning();
    const party = input.customerId
      ? { partyType: 'CUSTOMER' as const, partyId: input.customerId }
      : {};
    const account: AccountCode = METHOD_ACCOUNT[input.method];
    const own =
      input.direction === 'IN'
        ? debit(account, input.amountDefault, input.method === 'STORE_CREDIT' ? party : {})
        : credit(account, input.amountDefault, input.method === 'STORE_CREDIT' ? party : {});
    await this.ledger.post(tx, {
      sourceType: 'payment',
      sourceId: row!.id,
      event: input.direction === 'IN' ? 'PAYMENT_IN' : 'PAYMENT_OUT',
      createdBy: input.takenBy,
      entryDate: input.businessDate,
      lines: [own, ...input.counter],
    });
    return row!;
  }

  async allocate(
    tx: Transaction,
    rows: {
      paymentId: string;
      saleId: string;
      amount: string;
      createdBy: string;
      reversesId?: string;
    }[],
  ) {
    const kept = rows.filter((r) => compareMoney(r.amount, 0) !== 0);
    if (kept.length) await tx.insert(paymentAllocations).values(kept);
  }

  /** Payments that paid a sale, with the part allocated to it. */
  async forSale(executor: Executor, saleId: string): Promise<PaymentView[]> {
    const rows = await executor
      .select({
        payment: payments,
        takenBy: users.name,
        allocated: sql<string>`coalesce((select sum(a.amount) from payment_allocations a where a.payment_id = ${sql.raw('payments.id')} and a.sale_id = ${saleId}), 0)::text`,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.takenBy))
      .where(
        sql`${sql.raw('payments.id')} in (select a.payment_id from payment_allocations a where a.sale_id = ${saleId})
          or ${payments.saleId} = ${saleId}`,
      )
      .orderBy(payments.takenAt, payments.number);
    return rows.map((r) => paymentView(r.payment, r.takenBy, r.allocated));
  }

  async byIds(executor: Executor, ids: string[]): Promise<PaymentView[]> {
    if (!ids.length) return [];
    const rows = await executor
      .select({ payment: payments, takenBy: users.name })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.takenBy))
      .where(and(inArray(payments.id, ids)))
      .orderBy(payments.number);
    return rows.map((r) => paymentView(r.payment, r.takenBy));
  }
}

export function paymentView(
  p: typeof payments.$inferSelect,
  takenBy: string,
  allocated?: string,
): PaymentView {
  return {
    id: p.id,
    number: p.number,
    direction: p.direction,
    method: p.method,
    currency: p.currency,
    amount: p.amount,
    rate: p.rate,
    amountDefault: p.amountDefault,
    reference: p.reference,
    purpose: p.purpose,
    ...(allocated !== undefined ? { allocated } : {}),
    takenAt: p.takenAt.toISOString(),
    takenBy,
    reversed: p.reversedAt !== null,
  };
}
