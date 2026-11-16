import { Injectable } from '@nestjs/common';
import type { Currency } from '@organza/shared';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { conflict, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import { currencies, exchangeRates } from '../../../database/schema/index.js';
import { type Database, type Executor, inTransaction } from '../../../database/unit-of-work.js';

export const CURRENCY_ERRORS = {
  EXISTS: 'CURRENCY_EXISTS',
  DEFAULT_RATE: 'CURRENCY_DEFAULT_RATE',
  DEFAULT_INACTIVE: 'CURRENCY_DEFAULT_INACTIVE',
  INACTIVE: 'CURRENCY_INACTIVE',
  NO_RATE: 'CURRENCY_NO_RATE',
} as const;

@Injectable()
export class CurrenciesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(executor: Executor = this.db): Promise<Currency[]> {
    const rows = await executor
      .select({
        code: currencies.code,
        isDefault: currencies.isDefault,
        isActive: currencies.isActive,
        rate: sql<
          string | null
        >`(select r.rate::text from exchange_rates r where r.currency = ${currencies.code} order by r.set_at desc, r.id desc limit 1)`,
        rateSetAt: sql<
          string | null
        >`(select r.set_at from exchange_rates r where r.currency = ${currencies.code} order by r.set_at desc, r.id desc limit 1)`,
      })
      .from(currencies)
      .orderBy(desc(currencies.isDefault), asc(currencies.code));
    return rows.map((r) => ({
      code: r.code,
      isDefault: r.isDefault,
      isActive: r.isActive,
      rate: r.isDefault ? '1' : trimRate(r.rate ?? '0'),
      rateSetAt: r.rateSetAt ? new Date(r.rateSetAt).toISOString() : null,
    }));
  }

  async defaultCode(executor: Executor = this.db): Promise<string> {
    const [row] = await executor
      .select({ code: currencies.code })
      .from(currencies)
      .where(eq(currencies.isDefault, true));
    if (!row) throw new Error('No default currency configured');
    return row.code;
  }

  /**
   * The rate to use for a payment in `code`, as a decimal string. The default currency is 1.
   * Throws if the currency is unknown, inactive or has no rate yet.
   */
  async currentRate(executor: Executor, code: string): Promise<string> {
    const list = await this.list(executor);
    const found = list.find((c) => c.code === code);
    if (!found) throw notFound('Currency');
    if (!found.isActive) throw conflict(CURRENCY_ERRORS.INACTIVE, `${code} is not accepted`);
    if (!found.isDefault && found.rateSetAt === null)
      throw conflict(CURRENCY_ERRORS.NO_RATE, `${code} has no rate`);
    return found.rate;
  }

  async create(actor: Actor, code: string, rate: string): Promise<Currency> {
    await inTransaction(this.db, async (tx) => {
      const [existing] = await tx.select().from(currencies).where(eq(currencies.code, code));
      if (existing) throw conflict(CURRENCY_ERRORS.EXISTS, `${code} already exists`);
      await tx.insert(currencies).values({ code, isDefault: false });
      await tx.insert(exchangeRates).values({ currency: code, rate, setBy: actor.id });
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CREATE',
        entity: 'currency',
        entityId: code,
        newValue: { code, rate },
      });
    });
    return this.get(code);
  }

  async setRate(actor: Actor, code: string, rate: string): Promise<Currency> {
    await inTransaction(this.db, async (tx) => {
      const [row] = await tx
        .select()
        .from(currencies)
        .where(eq(currencies.code, code))
        .for('update');
      if (!row) throw notFound('Currency');
      if (row.isDefault)
        throw conflict(CURRENCY_ERRORS.DEFAULT_RATE, 'The default currency is always 1');
      const before = (await this.list(tx)).find((c) => c.code === code)?.rate;
      await tx.insert(exchangeRates).values({ currency: code, rate, setBy: actor.id });
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SET_RATE',
        entity: 'currency',
        entityId: code,
        oldValue: { rate: before },
        newValue: { rate },
      });
    });
    return this.get(code);
  }

  async setActive(actor: Actor, code: string, isActive: boolean): Promise<Currency> {
    await inTransaction(this.db, async (tx) => {
      const [row] = await tx
        .select()
        .from(currencies)
        .where(eq(currencies.code, code))
        .for('update');
      if (!row) throw notFound('Currency');
      if (row.isDefault && !isActive)
        throw conflict(CURRENCY_ERRORS.DEFAULT_INACTIVE, 'The default currency stays active');
      await tx.update(currencies).set({ isActive }).where(eq(currencies.code, code));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'UPDATE',
        entity: 'currency',
        entityId: code,
        oldValue: { isActive: row.isActive },
        newValue: { isActive },
      });
    });
    return this.get(code);
  }

  private async get(code: string): Promise<Currency> {
    const found = (await this.list()).find((c) => c.code === code);
    if (!found) throw notFound('Currency');
    return found;
  }
}

function trimRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
}
