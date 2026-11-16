import { Injectable } from '@nestjs/common';
import { buildSearchText, normalizeBarcode, skuFor } from '@organza/shared';
import { eq, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { AuditService } from '../common/services/audit.service.js';
import { InjectDb } from '../database/database.module.js';
import {
  barcodes,
  categories,
  itemBalances,
  itemOptionValues,
  items,
  legacyIds,
  optionTypes,
  optionValues,
  productImages,
  productOptionNotes,
  productOptionTypes,
  products,
  type Translatable,
} from '../database/schema/index.js';
import { type Database, inTransaction, type Transaction } from '../database/unit-of-work.js';
import { type StockLine, StockService } from '../modules/stock/services/stock.service.js';

/* Rows as the old Prisma schema stores them (quoted camelCase columns). */
interface OldCategory {
  id: string;
  name: Translatable;
  slug: string;
  parentId: string | null;
  isFavorite: boolean;
}
interface OldProduct {
  id: string;
  productNumber: number;
  name: Translatable;
  slug: string;
  description: Translatable | null;
  categoryId: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  cost: string | null;
  sku: string | null;
  stock: number;
  barcode: string | null;
  barcodeSource: 'GENERATED' | 'SUPPLIER';
  generatedBarcode: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  trackLowStock: boolean;
  isNumbered: boolean;
  pointTextColor: string | null;
  pointBackgroundColor: string | null;
  quickSoldAt: Date | null;
  completedAt: Date | null;
  oneOffAt: Date | null;
  labelsPrintedAt: Date | null;
  createdAt: Date;
}
interface OldVariant {
  id: string;
  productId: string;
  variantNumber: number;
  sku: string;
  barcode: string | null;
  barcodeSource: 'GENERATED' | 'SUPPLIER';
  generatedBarcode: string | null;
  priceOverride: string | null;
  cost: string | null;
  stock: number;
  imageX: number | null;
  imageY: number | null;
  isActive: boolean;
}
interface OldType {
  id: string;
  name: Translatable;
  slug: string;
}
interface OldValue {
  id: string;
  variantTypeId: string;
  value: Translatable;
  key: string;
  sortOrder: number;
}
interface OldImage {
  id: string;
  filename: string;
  originalFilename: string | null;
  edit: unknown;
  sortOrder: number;
  isPrimary: boolean;
  brightness: number | null;
  productId: string | null;
  variantId: string | null;
  createdAt: Date;
}

export interface ImportReport {
  dryRun: boolean;
  counts: Record<string, number>;
  stock: { items: number; units: number; unitsWithUnknownCost: number; value: string };
  warnings: string[];
  checks: { name: string; ok: boolean; detail?: string }[];
}

class DryRunRollback extends Error {
  constructor(readonly report: ImportReport) {
    super('dry run');
  }
}

const NUMBER_TYPE = 'number';
const PERCENT = (v: number | null) =>
  v === null ? null : String(Math.round((v <= 1 ? v * 100 : v) * 100) / 100);

/**
 * One-way import of the old catalogue (categories, options, products, variants, barcodes, photos
 * and opening stock). Runs in one transaction: a rehearsal (the default) rolls everything back
 * and only reports. Stock enters as OPENING movements against Opening balances; sales history
 * is not re-posted (proposal: the ledger starts at cut-over).
 */
@Injectable()
export class CatalogueImporter {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly stock: StockService,
    private readonly audit: AuditService,
  ) {}

  async run(source: postgres.Sql, options: { commit: boolean }): Promise<ImportReport> {
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
    const [cats, types, values, prods, variants, ptypes, notes, vvalues, images] =
      await Promise.all([
        source<OldCategory[]>`select * from "Category"`,
        source<OldType[]>`select * from "VariantType"`,
        source<OldValue[]>`select * from "VariantOptionValue" order by "sortOrder", "createdAt"`,
        source<OldProduct[]>`select * from "Product" order by "productNumber"`,
        source<OldVariant[]>`select * from "Variant" order by "productId", "variantNumber"`,
        source<{ productId: string; variantTypeId: string }[]>`select * from "ProductVariantType"`,
        source<
          { productId: string; optionValueId: string; note: Translatable }[]
        >`select * from "ProductOptionValueNote"`,
        source<{ variantId: string; optionValueId: string }[]>`select * from "VariantValue"`,
        source<OldImage[]>`select * from "ProductImage" order by "sortOrder", "createdAt"`,
      ]);
    return { cats, types, values, prods, variants, ptypes, notes, vvalues, images };
  }

  private async write(
    tx: Transaction,
    old: Awaited<ReturnType<CatalogueImporter['read']>>,
    dryRun: boolean,
  ): Promise<ImportReport> {
    const warnings: string[] = [];
    const counts: Record<string, number> = {};
    const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
    const [existing] = await tx.select({ n: sql<number>`count(*)::int` }).from(products);
    if (existing?.n)
      throw new Error(
        `The new catalogue already has ${existing.n} products; the import only runs into an empty one`,
      );
    const remember = async (entity: string, legacyId: string, newId: string) => {
      await tx.insert(legacyIds).values({ entity, legacyId, newId });
    };

    // Categories: insert flat, then link parents.
    const categoryId = new Map<string, string>();
    for (const c of old.cats) {
      const [row] = await tx
        .insert(categories)
        .values({ name: c.name, slug: c.slug, isFavorite: c.isFavorite })
        .returning({ id: categories.id });
      categoryId.set(c.id, row!.id);
      await remember('category', c.id, row!.id);
      bump('categories');
    }
    for (const c of old.cats) {
      if (c.parentId && categoryId.has(c.parentId)) {
        await tx
          .update(categories)
          .set({ parentId: categoryId.get(c.parentId)! })
          .where(eq(categories.id, categoryId.get(c.id)!));
      }
    }

    // Option types by stable key (size/color/number are seeded), then values.
    const seeded = await tx.select().from(optionTypes);
    const typeId = new Map<string, string>();
    const typeKey = new Map<string, string>();
    for (const t of old.types) {
      const match = seeded.find((s) => s.key === t.slug);
      const id = match
        ? match.id
        : (
            await tx
              .insert(optionTypes)
              .values({ key: t.slug, name: t.name })
              .returning({ id: optionTypes.id })
          )[0]!.id;
      typeId.set(t.id, id);
      typeKey.set(t.id, t.slug);
      await remember('option_type', t.id, id);
    }
    const valueId = new Map<string, string>();
    const valueInfo = new Map(old.values.map((v) => [v.id, v]));
    for (const v of old.values) {
      const tId = typeId.get(v.variantTypeId);
      if (!tId) continue;
      const [row] = await tx
        .insert(optionValues)
        .values({ typeId: tId, key: v.key, value: v.value, sortOrder: v.sortOrder })
        .onConflictDoUpdate({
          target: [optionValues.typeId, optionValues.key],
          set: { value: v.value },
        })
        .returning({ id: optionValues.id });
      valueId.set(v.id, row!.id);
      await remember('option_value', v.id, row!.id);
      bump('optionValues');
    }

    const variantsOf = groupBy(old.variants, (v) => v.productId);
    const valuesOf = groupBy(old.vvalues, (v) => v.variantId);
    const typesOf = groupBy(old.ptypes, (t) => t.productId);
    const notesOf = groupBy(old.notes, (n) => n.productId);
    const usedCodes = new Set<string>();
    const usedSkus = new Set<string>();
    const itemOf = new Map<string, string>();
    const expected = new Map<string, number>();
    let units = 0;
    let unknownUnits = 0;
    let valueCents = 0;
    let maxNumber = 0;

    const claimCode = (raw: string | null, where: string): string | null => {
      if (!raw) return null;
      const code = normalizeBarcode(raw);
      if (usedCodes.has(code)) {
        warnings.push(
          `Barcode ${code} appears twice; kept on the first holder, dropped from ${where}`,
        );
        return null;
      }
      usedCodes.add(code);
      return code;
    };
    const claimSku = (wanted: string, fallback: string, where: string): string => {
      const sku = wanted.trim().toUpperCase();
      if (!usedSkus.has(sku)) {
        usedSkus.add(sku);
        return sku;
      }
      warnings.push(`SKU ${sku} appears twice; ${where} gets ${fallback}`);
      usedSkus.add(fallback);
      return fallback;
    };

    for (const p of old.prods) {
      maxNumber = Math.max(maxNumber, p.productNumber);
      const variants = variantsOf.get(p.id) ?? [];
      const type = p.isNumbered ? 'NUMBERED' : variants.length > 0 ? 'VARIANT' : 'REGULAR';
      const status = p.deletedAt ? 'ARCHIVED' : p.isActive ? 'ACTIVE' : 'HIDDEN';
      const catId = p.categoryId ? (categoryId.get(p.categoryId) ?? null) : null;
      if (!catId && !p.deletedAt) warnings.push(`Product ${p.productNumber} has no category`);
      const [row] = await tx
        .insert(products)
        .values({
          number: p.productNumber,
          type,
          name: p.name,
          description: p.description ?? {},
          slug: p.slug,
          categoryId: catId,
          price: p.basePrice,
          compareAtPrice: p.compareAtPrice,
          status,
          // Old "track low stock" off: only warn at zero.
          lowStockThreshold: p.trackLowStock ? null : 0,
          pointTextColor: p.pointTextColor,
          pointBackgroundColor: p.pointBackgroundColor,
          quickSoldAt: p.quickSoldAt,
          completedAt: p.completedAt,
          oneOffAt: p.oneOffAt,
          labelsPrintedAt: p.labelsPrintedAt,
          archivedAt: p.deletedAt,
          createdAt: p.createdAt,
        })
        .returning({ id: products.id });
      const productId = row!.id;
      await remember('product', p.id, productId);
      bump(`products.${type}`);

      if (type === 'VARIANT') {
        const ptypes = (typesOf.get(p.id) ?? []).filter(
          (t) => typeKey.get(t.variantTypeId) !== NUMBER_TYPE,
        );
        if (ptypes.length) {
          await tx.insert(productOptionTypes).values(
            ptypes.map((t, i) => ({
              productId,
              typeId: typeId.get(t.variantTypeId)!,
              sortOrder: i,
            })),
          );
        }
        const noteRows = (notesOf.get(p.id) ?? [])
          .filter((n) => valueId.has(n.optionValueId))
          .map((n) => ({ productId, valueId: valueId.get(n.optionValueId)!, note: n.note }));
        if (noteRows.length) await tx.insert(productOptionNotes).values(noteRows);
      }

      // Items: one for a regular product, one per old variant otherwise.
      type Planned = {
        legacyId: string | null;
        number: number;
        sku: string;
        price: string | null;
        cost: string | null;
        stock: number;
        active: boolean;
        x: string | null;
        y: string | null;
        values: string[];
        code: string | null;
        codeSource: 'GENERATED' | 'SUPPLIER';
        extra: string | null;
      };
      const planned: Planned[] = [];
      if (type === 'REGULAR') {
        planned.push({
          legacyId: null,
          number: 1,
          sku: claimSku(
            p.sku ?? skuFor(p.productNumber),
            skuFor(p.productNumber),
            `product ${p.productNumber}`,
          ),
          price: null,
          cost: p.cost,
          stock: p.stock,
          active: true,
          x: null,
          y: null,
          values: [],
          code: claimCode(p.barcode, `product ${p.productNumber}`),
          codeSource: p.barcodeSource,
          extra:
            p.generatedBarcode && p.generatedBarcode !== p.barcode
              ? claimCode(p.generatedBarcode, `product ${p.productNumber}`)
              : null,
        });
      } else {
        const numbers = new Set<number>();
        for (const v of variants) {
          const vals = (valuesOf.get(v.id) ?? []).map((x) => x.optionValueId);
          let number = v.variantNumber;
          if (type === 'NUMBERED') {
            const numberValue = vals
              .map((id) => valueInfo.get(id))
              .find((info) => info && typeKey.get(info.variantTypeId) === NUMBER_TYPE);
            const parsed = numberValue ? Number.parseInt(numberValue.key, 10) : Number.NaN;
            if (Number.isInteger(parsed) && parsed > 0) number = parsed;
          }
          if (numbers.has(number)) {
            const free = Math.max(...numbers) + 1;
            warnings.push(
              `Product ${p.productNumber}: number ${number} repeats; the second becomes ${free}`,
            );
            number = free;
          }
          numbers.add(number);
          planned.push({
            legacyId: v.id,
            number,
            sku: claimSku(v.sku, skuFor(p.productNumber, number), `variant ${v.sku}`),
            price: v.priceOverride,
            cost: v.cost ?? p.cost,
            stock: v.stock,
            active: v.isActive,
            x: type === 'NUMBERED' ? PERCENT(v.imageX) : null,
            y: type === 'NUMBERED' ? PERCENT(v.imageY) : null,
            values:
              type === 'VARIANT'
                ? vals
                    .filter(
                      (id) =>
                        valueId.has(id) &&
                        typeKey.get(valueInfo.get(id)!.variantTypeId) !== NUMBER_TYPE,
                    )
                    .map((id) => valueId.get(id)!)
                : [],
            code: claimCode(v.barcode, `variant ${v.sku}`),
            codeSource: v.barcodeSource,
            extra:
              v.generatedBarcode && v.generatedBarcode !== v.barcode
                ? claimCode(v.generatedBarcode, `variant ${v.sku}`)
                : null,
          });
        }
        const shared = claimCode(p.barcode, `product ${p.productNumber}`);
        if (shared) {
          await tx
            .insert(barcodes)
            .values({ code: shared, productId, itemId: null, source: p.barcodeSource });
          bump('barcodes');
        }
      }

      const stockLines: StockLine[] = [];
      for (const it of planned) {
        const [item] = await tx
          .insert(items)
          .values({
            productId,
            number: it.number,
            sku: it.sku,
            price: it.price,
            isActive: it.active && !p.deletedAt,
            photoX: it.x,
            photoY: it.y,
            archivedAt: p.deletedAt,
          })
          .returning({ id: items.id });
        const itemId = item!.id;
        if (it.legacyId) {
          itemOf.set(it.legacyId, itemId);
          await remember('variant', it.legacyId, itemId);
        } else {
          await remember('product_item', p.id, itemId);
        }
        bump('items');
        if (it.values.length)
          await tx.insert(itemOptionValues).values(it.values.map((v) => ({ itemId, valueId: v })));
        for (const code of [it.code, it.extra]) {
          if (!code) continue;
          await tx.insert(barcodes).values({
            code,
            productId,
            itemId,
            source: code === it.code ? it.codeSource : 'GENERATED',
          });
          bump('barcodes');
        }
        await tx.insert(itemBalances).values({ itemId }).onConflictDoNothing();
        let qty = it.stock;
        if (qty < 0) {
          warnings.push(`${it.sku}: stock ${qty} below zero, imported as 0`);
          qty = 0;
        }
        if (p.deletedAt && qty > 0) {
          warnings.push(`${it.sku}: ${qty} piece(s) on a deleted product were not imported`);
          qty = 0;
        }
        expected.set(itemId, qty);
        if (qty > 0) {
          stockLines.push({
            itemId,
            quantity: qty,
            reason: 'OPENING',
            counterAccount: 'OPENING_BALANCES',
            ...(it.cost !== null && { unitCost: it.cost }),
          });
          units += qty;
          if (it.cost === null) unknownUnits += qty;
          else valueCents += Math.round(Number(it.cost) * 100) * qty;
        }
      }
      if (stockLines.length) {
        await this.stock.apply(tx, {
          sourceType: 'opening_import',
          sourceId: productId,
          event: 'OPENING_STOCK',
          actorId: null,
          lines: stockLines,
        });
      }

      // Photos keep their file names: the files are copied as they are.
      const productImagesOld = old.images.filter((i) => i.productId === p.id);
      for (const img of productImagesOld) {
        const [imageRow] = await tx
          .insert(productImages)
          .values({
            productId,
            itemId: img.variantId ? (itemOf.get(img.variantId) ?? null) : null,
            filename: img.filename,
            originalFilename: img.originalFilename,
            edit: img.edit ?? null,
            brightness: img.brightness === null ? null : String(img.brightness),
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
            createdAt: img.createdAt,
          })
          .returning({ id: productImages.id });
        await remember('image', img.id, imageRow!.id);
        bump('images');
      }

      const valueNames = old.vvalues
        .filter((vv) => variants.some((v) => v.id === vv.variantId))
        .map((vv) => valueInfo.get(vv.optionValueId)?.value)
        .filter((v): v is Translatable => Boolean(v));
      await tx
        .update(products)
        .set({
          searchText: buildSearchText(
            p.name,
            p.description ?? {},
            ...planned.map((x) => x.sku),
            ...valueNames,
          ),
        })
        .where(eq(products.id, productId));
    }

    const orphans = old.images.filter((i) => !i.productId).length;
    if (orphans) warnings.push(`${orphans} photo(s) not attached to any product were skipped`);
    await tx.execute(
      sql`select setval(pg_get_serial_sequence('products', 'number'), ${Math.max(maxNumber, 1)}, ${maxNumber > 0})`,
    );

    // Checks, inside the same transaction.
    const checks: ImportReport['checks'] = [];
    const balances = await tx.select().from(itemBalances);
    const wrong = balances.filter((b) => (expected.get(b.itemId) ?? 0) !== b.onHand);
    checks.push({
      name: 'every item holds the stock it had',
      ok: wrong.length === 0,
      ...(wrong.length && { detail: `${wrong.length} differ` }),
    });
    const mismatches = await this.stock.verify(tx);
    checks.push({ name: 'balances equal the sum of movements', ok: mismatches.length === 0 });
    const [inv] = await tx.execute<{ v: string }>(
      sql`select coalesce(sum(amount), 0)::text as v from journal_lines where account = 'INVENTORY'`,
    );
    checks.push({
      name: 'inventory on the books equals stock at cost',
      ok: Math.round(Number(inv?.v ?? 0) * 100) === valueCents,
      detail: `${inv?.v ?? '0'} vs ${(valueCents / 100).toFixed(2)}`,
    });
    const [prodCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(products);
    checks.push({
      name: 'every product imported',
      ok: prodCount?.n === old.prods.length,
      detail: `${prodCount?.n} of ${old.prods.length}`,
    });

    const report: ImportReport = {
      dryRun,
      counts,
      stock: {
        items: expected.size,
        units,
        unitsWithUnknownCost: unknownUnits,
        value: (valueCents / 100).toFixed(2),
      },
      warnings,
      checks,
    };
    await this.audit.record(tx, {
      userId: null,
      action: 'IMPORT',
      entity: 'catalogue',
      newValue: report,
    });
    return report;
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
}
