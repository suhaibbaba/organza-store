import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { asc, eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp, createFastifyAdapter } from '../src/bootstrap.js';
import { resetEnvCache } from '../src/config/env.js';
import { DATABASE } from '../src/database/database.module.js';
import { runMigrations } from '../src/database/migrate.js';
import {
  couriers,
  customers,
  journalLines,
  orderLines,
  orders,
  payments,
  saleLines,
  sales,
  shiftCounts,
  shifts,
  users,
} from '../src/database/schema/index.js';
import type { Database } from '../src/database/unit-of-work.js';
import { CatalogueImporter } from '../src/migration/catalogue-import.js';
import { HistoryImporter } from '../src/migration/history-import.js';
import { MigrationModule } from '../src/migration/migration.module.js';
import { adminDatabaseUrl } from './helpers/test-database.js';

async function freshDatabase(name: string): Promise<string> {
  if (!name.endsWith('_test')) throw new Error('test databases only');
  const admin = postgres(adminDatabaseUrl(), { max: 1, onnotice: () => undefined });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end();
  const url = new URL(process.env['DATABASE_URL']!);
  url.pathname = `/${name}`;
  return url.toString();
}

describe('history import from the old system', () => {
  let source: postgres.Sql;
  let app: NestFastifyApplication;
  let db: Database;
  let importer: HistoryImporter;
  const originalUrl = process.env['DATABASE_URL'];

  beforeAll(async () => {
    const legacyUrl = await freshDatabase('organza_legacy_history_test');
    source = postgres(legacyUrl, { max: 2, onnotice: () => undefined });
    for (const file of ['legacy-catalogue.sql', 'legacy-history.sql'])
      await source.unsafe(readFileSync(join(__dirname, 'fixtures', file), 'utf8'));
    const targetUrl = await freshDatabase('organza_history_import_test');
    await runMigrations(targetUrl, join(process.cwd(), 'drizzle'));
    process.env['DATABASE_URL'] = targetUrl;
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, MigrationModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
      logger: false,
    });
    await configureApp(app);
    await app.init();
    db = app.get<Database>(DATABASE);
    importer = app.get(HistoryImporter);
    await app.get(CatalogueImporter).run(source, { commit: true });
  });

  afterAll(async () => {
    await source?.end();
    await app?.close();
    process.env['DATABASE_URL'] = originalUrl;
    resetEnvCache();
  });

  it('a rehearsal reports everything and writes nothing', async () => {
    const report = await importer.run(source, { commit: false });
    expect(report.dryRun).toBe(true);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(sales);
    expect(n!.n).toBe(0);
  });

  it('imports staff, customers, sales, payments and cash sessions, and checks itself', async () => {
    const report = await importer.run(source, { commit: true });
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.counts).toMatchObject({
      'staff.imported': 2,
      shifts: 1,
      customers: 4,
      sales: 6,
      'sales.gifts': 1,
      'sales.cancelled': 1,
      payments: 4,
      'payments.courier': 2,
      'orders.skipped.deleted': 1,
      'orders.out': 1,
      'orders.out.notYetSent': 1,
      'orders.new': 1,
    });
    expect(report.months).toEqual([
      { month: '2026-01', old: '510.00', imported: '510.00' },
      { month: '2026-02', old: '355.00', imported: '355.00' },
    ]);
    expect(report.money).toEqual({
      collected: '525.00',
      outstanding: '340.00',
      withCouriers: '340.00',
    });
    expect(report.reviewCustomers).toEqual([
      { name: 'sara a', phones: ['+970599000002', '+972599000001'] },
    ]);
    const warnings = report.warnings.join('\n');
    expect(warnings).toMatch(/not a phone number/);
    expect(warnings).toMatch(/Old system/);
    expect(warnings).toMatch(/staff@old.test has no password/);

    // The order discount is spread so the lines add up to the old total exactly.
    const [first] = await db.select().from(sales).where(eq(sales.number, 'OLD-1'));
    expect(first).toMatchObject({
      imported: true,
      source: 'COUNTER',
      subtotal: '320.00',
      discountTotal: '30.00',
      total: '290.00',
    });
    const lines = await db
      .select()
      .from(saleLines)
      .where(eq(saleLines.saleId, first!.id))
      .orderBy(asc(saleLines.position));
    expect(lines.map((l) => [l.discount, l.lineTotal, l.costUnknown])).toEqual([
      ['4.00', '116.00', false],
      ['26.00', '174.00', true],
    ]);
    expect(lines.every((l) => l.itemId !== null)).toBe(true);

    // One customer for both of Sara's numbers; the newest order gave her name and number.
    const sara = await db.select().from(customers).where(eq(customers.phone, '+972599000001'));
    expect(sara).toHaveLength(1);
    expect(sara[0]).toMatchObject({ name: 'Sara A', address: 'Ramallah' });
    const [courier] = await db.select().from(sales).where(eq(sales.number, 'OLD-2'));
    expect(courier).toMatchObject({ customerId: sara[0]!.id, source: 'WHATSAPP' });
    // Out with the old system's courier, which owes the order as its opening balance.
    const [out] = await db.select().from(orders).where(eq(orders.number, 'OLD-2'));
    expect(out).toMatchObject({ status: 'OUT', saleId: courier!.id, cod: '220.00' });
    const [company] = await db.select().from(couriers).where(eq(couriers.id, out!.courierId!));
    expect(company!.name).toMatch(/\S/);
    const cod = await db.select().from(payments).where(eq(payments.saleId, courier!.id));
    expect(cod).toMatchObject([{ method: 'COURIER', amount: '220.00', imported: true }]);
    const [owed] = await db
      .select({ total: sql<string>`sum(${journalLines.amount})::text` })
      .from(journalLines)
      .where(eq(journalLines.account, 'COURIER_RECEIVABLES'));
    expect(owed!.total).toBe('340.00');
    const gift = await db
      .select()
      .from(saleLines)
      .innerJoin(sales, eq(sales.id, saleLines.saleId))
      .where(eq(sales.number, 'OLD-4'));
    expect(gift.map((g) => [g.sale_lines.giveaway, g.sale_lines.lineTotal])).toEqual([
      [true, '0.00'],
    ]);
    // A new order whose pieces are still on the shelf is an order, not a sale.
    const [fresh] = await db.select().from(orders).where(eq(orders.number, 'OLD-10'));
    expect(fresh).toMatchObject({ status: 'NEW', saleId: null, cod: '0.00' });
    expect(
      await db.select().from(orderLines).where(eq(orderLines.orderId, fresh!.id)),
    ).toHaveLength(1);
    expect(await db.select().from(sales).where(eq(sales.number, 'OLD-10'))).toHaveLength(0);

    // The counter sale's payment sits in that day's imported shift with the old figures.
    const [shift] = await db.select().from(shifts).where(eq(shifts.imported, true));
    expect(shift).toMatchObject({ status: 'CLOSED', hasDifference: true, closeNote: 'short by 5' });
    expect(first!.shiftId).toBe(shift!.id);
    const [pay] = await db.select().from(payments).where(eq(payments.saleId, first!.id));
    expect(pay).toMatchObject({ shiftId: shift!.id, imported: true, amount: '290.00' });
    const counts = await db.select().from(shiftCounts).where(eq(shiftCounts.shiftId, shift!.id));
    expect(counts.map((c) => [c.kind, c.amount, c.expected]).sort()).toEqual([
      ['CLOSING', '365.00', '370.00'],
      ['OPENING', '100.00', '100.00'],
    ]);

    // Imported history is read-only.
    await expect(
      db.update(sales).set({ note: 'changed' }).where(eq(sales.id, first!.id)),
    ).rejects.toThrow();
    await expect(
      db.update(shifts).set({ closeNote: 'changed' }).where(eq(shifts.id, shift!.id)),
    ).rejects.toThrow();
  });

  it('an imported person signs in with the old password once, then with argon2', async () => {
    const login = (password: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'owner@old.test', password },
      });
    expect((await login('wrong')).statusCode).toBe(401);
    expect((await login('old-password-1')).statusCode).toBe(200);
    const [owner] = await db.select().from(users).where(eq(users.email, 'owner@old.test'));
    expect(owner!.legacyPasswordHash).toBeNull();
    expect(owner!.passwordHash).toMatch(/^\$argon2/);
    expect((await login('old-password-1')).statusCode).toBe(200);
  });

  it('refuses a second import', async () => {
    await expect(importer.run(source, { commit: true })).rejects.toThrow(/once/);
  });
});
