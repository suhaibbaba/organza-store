import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp, createFastifyAdapter } from '../src/bootstrap.js';
import { resetEnvCache } from '../src/config/env.js';
import { DATABASE } from '../src/database/database.module.js';
import { runMigrations } from '../src/database/migrate.js';
import { barcodes, items, legacyIds, products } from '../src/database/schema/index.js';
import type { Database } from '../src/database/unit-of-work.js';
import { CatalogueImporter } from '../src/migration/catalogue-import.js';
import { MigrationModule } from '../src/migration/migration.module.js';
import { StockService } from '../src/modules/stock/services/stock.service.js';
import { adminDatabaseUrl } from './helpers/test-database.js';

/** Fresh databases of their own: the old-schema fixture and an empty new catalogue. */
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

describe('catalogue import from the old system', () => {
  let source: postgres.Sql;
  let app: NestFastifyApplication;
  let db: Database;
  let importer: CatalogueImporter;
  const originalUrl = process.env['DATABASE_URL'];

  beforeAll(async () => {
    const legacyUrl = await freshDatabase('organza_legacy_test');
    source = postgres(legacyUrl, { max: 2, onnotice: () => undefined });
    await source.unsafe(readFileSync(join(__dirname, 'fixtures', 'legacy-catalogue.sql'), 'utf8'));
    const targetUrl = await freshDatabase('organza_import_test');
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
    importer = app.get(CatalogueImporter);
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
    expect(report.checks.every((c) => c.ok)).toBe(true);
    const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(products);
    expect(n!.n).toBe(0);
  });

  it('imports products, items, codes, photos and opening stock, and checks itself', async () => {
    const report = await importer.run(source, { commit: true });
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.counts).toMatchObject({
      categories: 2,
      'products.REGULAR': 3,
      'products.VARIANT': 1,
      'products.NUMBERED': 1,
      items: 7,
      images: 2,
    });
    expect(report.stock).toEqual({ items: 7, units: 8, unitsWithUnknownCost: 3, value: '300.00' });
    expect(report.warnings.join('\n')).toMatch(/below zero/);
    expect(report.warnings.join('\n')).toMatch(/deleted product/);
    expect(report.warnings.join('\n')).toMatch(/DUP-1 appears twice/);
    expect(report.warnings.join('\n')).toMatch(/no category/);

    const [shawl] = await db.select().from(products).where(eq(products.number, 1));
    expect(shawl).toMatchObject({ type: 'REGULAR', price: '120.00', lowStockThreshold: null });
    const shawlCodes = await db.select().from(barcodes).where(eq(barcodes.productId, shawl!.id));
    expect(shawlCodes.map((c) => [c.code, c.source]).sort()).toEqual([
      ['2001234567897', 'GENERATED'],
      ['SUPPLIER-111', 'SUPPLIER'],
    ]);

    const [dress] = await db.select().from(products).where(eq(products.number, 2));
    const dressCodes = await db.select().from(barcodes).where(eq(barcodes.productId, dress!.id));
    expect(dressCodes.find((c) => c.itemId === null)?.code).toBe('SHARED-222');

    const [numbered] = await db.select().from(products).where(eq(products.number, 5));
    expect(numbered).toMatchObject({ type: 'NUMBERED', status: 'HIDDEN' });
    const numberedItems = await db
      .select()
      .from(items)
      .where(eq(items.productId, numbered!.id))
      .orderBy(items.number);
    expect(numberedItems.map((i) => [i.number, i.photoX])).toEqual([
      [3, '25.00'],
      [8, '75.00'],
    ]);

    const [old] = await db.select().from(products).where(eq(products.number, 7));
    expect(old!.status).toBe('ARCHIVED');
    expect(await app.get(StockService).verify()).toEqual([]);
    const mapped = await db.select().from(legacyIds).where(eq(legacyIds.entity, 'variant'));
    expect(mapped).toHaveLength(4);
  });

  it('new products continue numbering after the imported ones and refuses a second import', async () => {
    const [{ next } = { next: 0 }] = await db.execute<{ next: number }>(
      sql`select nextval(pg_get_serial_sequence('products', 'number'))::int as next`,
    );
    expect(Number(next)).toBe(9);
    await expect(importer.run(source, { commit: true })).rejects.toThrow(/empty/);
  });
});
