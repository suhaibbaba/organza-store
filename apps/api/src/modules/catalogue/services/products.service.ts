import { Injectable } from '@nestjs/common';
import {
  buildSearchText,
  type createProductSchema,
  type ImageView,
  type ItemView,
  normalizeBarcode,
  normalizeSearch,
  type productListQuerySchema,
  type ProductSummary,
  type ProductView,
  skuFor,
  toMinor,
  type updateProductSchema,
} from '@organza/shared';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, forbidden, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  barcodes,
  categories,
  itemBalances,
  itemOptionValues,
  items,
  optionTypes,
  optionValues,
  productImages,
  productOptionNotes,
  productOptionTypes,
  products,
} from '../../../database/schema/index.js';
import {
  type Database,
  type Executor,
  inTransaction,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { type StockLine, StockService } from '../../stock/services/stock.service.js';
import { CATALOGUE_ERRORS, SEARCH_SIMILARITY } from '../constants.js';
import { imageView } from '../lib/image-urls.js';
import { cleanTranslatable } from '../lib/translatable.js';
import { BarcodesService } from './barcodes.service.js';

type CreateInput = z.output<typeof createProductSchema>;
type ListQuery = z.output<typeof productListQuerySchema>;
type UpdateInput = z.output<typeof updateProductSchema>;

interface NewItem {
  number: number;
  price: string | null;
  cost: string | null;
  stock: number;
  valueIds: string[];
  photoX: number | null;
  photoY: number | null;
  barcode: string | null;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly barcodes: BarcodesService,
    private readonly stock: StockService,
    private readonly settings: SettingsService,
  ) {}

  // ---------------------------------------------------------------- create

  /** Proposal C1: one request, one transaction; only ticked combinations become items. */
  async create(actor: Actor, input: CreateInput): Promise<ProductView> {
    const { result } = await this.idempotency.run(
      'products.create',
      input.idempotencyKey,
      actor.id,
      input,
      (tx) => this.createWithin(tx, actor, input),
    );
    return this.get(result.id, actor);
  }

  async createWithin(
    tx: Transaction,
    actor: Actor,
    input: CreateInput,
    extra: { quickSell?: boolean; categoryOptional?: boolean } = {},
  ): Promise<{ id: string }> {
    const seeCost = actor.role === 'ADMIN';
    if (!extra.categoryOptional || input.categoryId)
      await this.requireCategory(tx, input.categoryId);
    const newItems = await this.planItems(tx, input);
    const shared = input.type === 'VARIANT' && input.sharedBarcode ? input.sharedBarcode : null;
    await this.barcodes.assertFree(tx, [
      ...newItems.map((i) => i.barcode).filter((c): c is string => Boolean(c)),
      ...(shared ? [shared] : []),
    ]);

    const name = cleanTranslatable(input.name);
    const description = cleanTranslatable(input.description);
    const [product] = await tx
      .insert(products)
      .values({
        type: input.type,
        name,
        description,
        slug: `tmp-${crypto.randomUUID()}`,
        categoryId: input.categoryId ?? null,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
        pointTextColor: input.type === 'NUMBERED' ? (input.pointTextColor ?? null) : null,
        pointBackgroundColor:
          input.type === 'NUMBERED' ? (input.pointBackgroundColor ?? null) : null,
        quickSoldAt: extra.quickSell ? new Date() : null,
        createdBy: actor.id,
      })
      .returning();
    if (!product) throw new Error('product not inserted');

    if (input.type === 'VARIANT') {
      await tx
        .insert(productOptionTypes)
        .values(
          input.optionTypeIds.map((typeId, i) => ({ productId: product.id, typeId, sortOrder: i })),
        );
      const notes = input.optionNotes.map((n) => ({
        productId: product.id,
        valueId: n.valueId,
        note: cleanTranslatable(n.note),
      }));
      if (notes.length) await tx.insert(productOptionNotes).values(notes);
    }

    const created = await this.insertItems(
      tx,
      actor,
      product.id,
      product.number,
      input.type,
      newItems,
      seeCost ? (input.cost ?? null) : null,
    );
    if (shared) {
      await tx.insert(barcodes).values({
        code: shared,
        productId: product.id,
        itemId: null,
        source: 'SUPPLIER',
        createdBy: actor.id,
      });
    }
    await this.attachImages(tx, product.id, input.imageIds);
    await tx
      .update(products)
      .set({ slug: `p${product.number}`, searchText: await this.searchTextFor(tx, product.id) })
      .where(eq(products.id, product.id));

    await this.audit.record(tx, {
      userId: actor.id,
      action: extra.quickSell ? 'QUICK_SELL_CREATE' : 'CREATE',
      entity: 'product',
      entityId: product.id,
      newValue: { ...product, items: created },
    });
    return { id: product.id };
  }

  /** Validates the ticked combinations or numbers and turns them into items to create. */
  private async planItems(tx: Transaction, input: CreateInput): Promise<NewItem[]> {
    if (input.type === 'REGULAR') {
      return [
        {
          number: 1,
          price: null,
          cost: input.cost ?? null,
          stock: input.stock,
          valueIds: [],
          photoX: null,
          photoY: null,
          barcode: input.barcode ?? null,
        },
      ];
    }
    if (input.type === 'NUMBERED') {
      const seen = new Set<number>();
      for (const item of input.items) {
        if (seen.has(item.number))
          throw conflict(CATALOGUE_ERRORS.DUPLICATE_NUMBER, `Number ${item.number} entered twice`);
        seen.add(item.number);
      }
      return input.items.map((i) => ({
        number: i.number,
        price: i.price ?? null,
        cost: i.cost ?? input.cost ?? null,
        stock: i.stock,
        valueIds: [],
        photoX: i.photoX ?? null,
        photoY: i.photoY ?? null,
        barcode: i.barcode ?? null,
      }));
    }
    const types = await tx
      .select()
      .from(optionTypes)
      .where(inArray(optionTypes.id, input.optionTypeIds));
    if (types.length !== new Set(input.optionTypeIds).size) throw notFound('Option type');
    if (types.some((t) => t.key === 'number')) {
      throw badRequest(
        CATALOGUE_ERRORS.NUMBER_TYPE_RESERVED,
        'Numbers belong to numbered products',
      );
    }
    const allValueIds = [...new Set(input.items.flatMap((i) => i.valueIds))];
    const values = await tx
      .select()
      .from(optionValues)
      .where(inArray(optionValues.id, allValueIds));
    const typeOf = new Map(values.map((v) => [v.id, v.typeId]));
    const combos = new Set<string>();
    return input.items.map((item, index) => {
      const typesUsed = item.valueIds.map((v) => typeOf.get(v));
      const valid =
        item.valueIds.length === input.optionTypeIds.length &&
        typesUsed.every((t) => t && input.optionTypeIds.includes(t)) &&
        new Set(typesUsed).size === typesUsed.length;
      if (!valid)
        throw badRequest(
          CATALOGUE_ERRORS.INVALID_COMBINATION,
          'Each variant needs one value per option',
          { index },
        );
      const key = [...item.valueIds].sort().join('+');
      if (combos.has(key))
        throw conflict(CATALOGUE_ERRORS.DUPLICATE_COMBINATION, 'Combination entered twice', {
          index,
        });
      combos.add(key);
      return {
        number: index + 1,
        price: item.price ?? null,
        cost: item.cost ?? input.cost ?? null,
        stock: item.stock,
        valueIds: item.valueIds,
        photoX: null,
        photoY: null,
        barcode: item.barcode ?? null,
      };
    });
  }

  private async insertItems(
    tx: Transaction,
    actor: Actor,
    productId: string,
    productNumber: number,
    type: CreateInput['type'],
    planned: NewItem[],
    productCost: string | null,
  ) {
    const seeCost = actor.role === 'ADMIN';
    const rows = await tx
      .insert(items)
      .values(
        planned.map((p) => ({
          productId,
          number: p.number,
          sku: type === 'REGULAR' ? skuFor(productNumber) : skuFor(productNumber, p.number),
          price: p.price,
          photoX: p.photoX === null ? null : String(p.photoX),
          photoY: p.photoY === null ? null : String(p.photoY),
        })),
      )
      .returning();
    const byNumber = new Map(rows.map((r) => [r.number, r]));
    const links = planned.flatMap((p) =>
      p.valueIds.map((valueId) => ({ itemId: byNumber.get(p.number)!.id, valueId })),
    );
    if (links.length) await tx.insert(itemOptionValues).values(links);

    const reserved = new Set<string>();
    const codes: (typeof barcodes.$inferInsert)[] = [];
    for (const p of planned) {
      const item = byNumber.get(p.number)!;
      const code = p.barcode ?? (await this.barcodes.generate(tx, reserved));
      codes.push({
        code,
        productId,
        itemId: item.id,
        source: p.barcode ? ('SUPPLIER' as const) : ('GENERATED' as const),
        createdBy: actor.id,
      });
    }
    await tx.insert(barcodes).values(codes);
    await tx
      .insert(itemBalances)
      .values(rows.map((r) => ({ itemId: r.id })))
      .onConflictDoNothing();

    const stockLines: StockLine[] = planned
      .filter((p) => p.stock > 0)
      .map((p) => {
        const cost = seeCost ? (p.cost ?? productCost) : null;
        return {
          itemId: byNumber.get(p.number)!.id,
          quantity: p.stock,
          reason: 'INITIAL',
          counterAccount: 'OPENING_BALANCES',
          ...(cost !== null && { unitCost: cost }),
        };
      });
    if (stockLines.length) {
      await this.stock.apply(tx, {
        sourceType: 'product',
        sourceId: productId,
        event: 'INITIAL_STOCK',
        actorId: actor.id,
        lines: stockLines,
      });
    }
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      sku: r.sku,
      barcode: codes.find((c) => c.itemId === r.id)?.code,
    }));
  }

  private async attachImages(
    tx: Transaction,
    productId: string,
    imageIds: string[],
  ): Promise<void> {
    if (imageIds.length === 0) return;
    const attached = await tx
      .update(productImages)
      .set({ productId })
      .where(
        and(
          inArray(productImages.id, imageIds),
          isNull(productImages.productId),
          isNull(productImages.removedAt),
        ),
      )
      .returning({ id: productImages.id });
    if (attached.length !== new Set(imageIds).size)
      throw notFound('Image', CATALOGUE_ERRORS.IMAGE_NOT_FOUND);
    for (const [index, id] of imageIds.entries()) {
      await tx
        .update(productImages)
        .set({ sortOrder: index, isPrimary: index === 0 })
        .where(eq(productImages.id, id));
    }
  }

  async requireCategory(executor: Executor, id: string | undefined | null): Promise<void> {
    if (!id) throw notFound('Category', CATALOGUE_ERRORS.CATEGORY_NOT_FOUND);
    const [row] = await executor
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.archivedAt)));
    if (!row) throw notFound('Category', CATALOGUE_ERRORS.CATEGORY_NOT_FOUND);
  }

  /** Every language of the name and description, the SKUs and the option value names. */
  async searchTextFor(executor: Executor, productId: string): Promise<string> {
    const [product] = await executor.select().from(products).where(eq(products.id, productId));
    if (!product) return '';
    const itemRows = await executor
      .select({ sku: items.sku })
      .from(items)
      .where(eq(items.productId, productId));
    const valueRows = await executor
      .selectDistinct({ value: optionValues.value })
      .from(itemOptionValues)
      .innerJoin(items, eq(items.id, itemOptionValues.itemId))
      .innerJoin(optionValues, eq(optionValues.id, itemOptionValues.valueId))
      .where(eq(items.productId, productId));
    return buildSearchText(
      product.name,
      product.description,
      ...itemRows.map((r) => r.sku),
      ...valueRows.map((v) => v.value),
    );
  }

  // ---------------------------------------------------------------- read

  async get(id: string, actor: Actor, executor: Executor = this.db): Promise<ProductView> {
    const [product] = await executor.select().from(products).where(eq(products.id, id));
    if (!product) throw notFound('Product');
    const itemRows = await executor
      .select()
      .from(items)
      .where(eq(items.productId, id))
      .orderBy(asc(items.number));
    const itemIds = itemRows.map((i) => i.id);
    const [types, notes, images, codes, options, balances] = await Promise.all([
      executor
        .select({ id: optionTypes.id, key: optionTypes.key, name: optionTypes.name })
        .from(productOptionTypes)
        .innerJoin(optionTypes, eq(optionTypes.id, productOptionTypes.typeId))
        .where(eq(productOptionTypes.productId, id))
        .orderBy(asc(productOptionTypes.sortOrder)),
      executor.select().from(productOptionNotes).where(eq(productOptionNotes.productId, id)),
      executor
        .select()
        .from(productImages)
        .where(and(eq(productImages.productId, id), isNull(productImages.removedAt)))
        .orderBy(asc(productImages.sortOrder)),
      executor
        .select()
        .from(barcodes)
        .where(eq(barcodes.productId, id))
        .orderBy(asc(barcodes.createdAt)),
      itemIds.length
        ? executor
            .select({
              itemId: itemOptionValues.itemId,
              typeId: optionValues.typeId,
              valueId: optionValues.id,
              key: optionValues.key,
              value: optionValues.value,
            })
            .from(itemOptionValues)
            .innerJoin(optionValues, eq(optionValues.id, itemOptionValues.valueId))
            .where(inArray(itemOptionValues.itemId, itemIds))
        : Promise.resolve([]),
      this.stock.balances(executor, itemIds),
    ]);
    const typeOrder = new Map(types.map((t, i) => [t.id, i]));
    const itemViews: ItemView[] = itemRows.map((item) => {
      const balance = balances.get(item.id)!;
      return {
        id: item.id,
        number: item.number,
        sku: item.sku,
        price: item.price,
        effectivePrice: item.price ?? product.price,
        ...(actor.role === 'ADMIN' && { avgCost: balance.avgCost }),
        photoX: item.photoX,
        photoY: item.photoY,
        location: item.location,
        isActive: item.isActive,
        archivedAt: item.archivedAt?.toISOString() ?? null,
        options: options
          .filter((o) => o.itemId === item.id)
          .sort((a, b) => (typeOrder.get(a.typeId) ?? 0) - (typeOrder.get(b.typeId) ?? 0))
          .map(({ itemId: _i, ...o }) => o),
        barcodes: codes
          .filter((c) => c.itemId === item.id)
          .map((c) => ({ code: c.code, source: c.source })),
        stock: {
          onHand: balance.onHand,
          reserved: balance.reserved,
          damaged: balance.damaged,
          available: balance.onHand - balance.reserved,
        },
      };
    });
    return {
      id: product.id,
      number: product.number,
      type: product.type,
      name: product.name,
      description: product.description,
      slug: product.slug,
      categoryId: product.categoryId,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      status: product.status,
      lowStockThreshold: product.lowStockThreshold,
      pointTextColor: product.pointTextColor,
      pointBackgroundColor: product.pointBackgroundColor,
      quickSoldAt: product.quickSoldAt?.toISOString() ?? null,
      completedAt: product.completedAt?.toISOString() ?? null,
      oneOffAt: product.oneOffAt?.toISOString() ?? null,
      labelsPrintedAt: product.labelsPrintedAt?.toISOString() ?? null,
      version: product.version,
      createdAt: product.createdAt.toISOString(),
      optionTypes: types,
      optionNotes: notes.map((n) => ({ valueId: n.valueId, note: n.note })),
      images: images.map(imageView),
      items: itemViews,
      sharedBarcodes: codes.filter((c) => c.itemId === null).map((c) => c.code),
    };
  }

  async list(query: ListQuery) {
    const threshold = (await this.settings.get()).lowStockThreshold;
    const conditions: (SQL | undefined)[] = [];
    if (query.status !== 'ALL') conditions.push(eq(products.status, query.status));
    if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
    if (query.type) conditions.push(eq(products.type, query.type));
    if (query.needsCompletion)
      conditions.push(
        and(
          isNotNull(products.quickSoldAt),
          isNull(products.completedAt),
          isNull(products.oneOffAt),
        ),
      );
    if (query.labelsPending) conditions.push(isNull(products.labelsPrintedAt));

    const totals = sql`(select coalesce(sum(b.on_hand), 0)::int as on_hand, coalesce(sum(b.on_hand - b.reserved), 0)::int as available
      from items i join item_balances b on b.item_id = i.id where i.product_id = ${sql.raw('products.id')} and i.archived_at is null)`;
    const lowStockExpr = sql<boolean>`(select coalesce(sum(b.on_hand - b.reserved), 0) from items i join item_balances b on b.item_id = i.id
      where i.product_id = ${sql.raw('products.id')} and i.archived_at is null) <= coalesce(${sql.raw('products.low_stock_threshold')}, ${threshold})`;
    if (query.lowStock) conditions.push(lowStockExpr);

    let rank: SQL = sql`0`;
    if (query.q) {
      const raw = query.q.trim();
      const q = normalizeSearch(raw);
      const code = normalizeBarcode(raw);
      rank = sql`word_similarity(${q}, ${sql.raw('products.search_text')})`;
      conditions.push(
        or(
          sql`word_similarity(${q}, ${sql.raw('products.search_text')}) > ${SEARCH_SIMILARITY}`,
          ilike(products.searchText, `%${q}%`),
          sql`exists (select 1 from barcodes bc where bc.product_id = ${sql.raw('products.id')} and bc.code = ${code})`,
          sql`${sql.raw('products.number')}::text = ${code}`,
        ),
      );
    }
    const where = and(...conditions);
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(where);
    const rows = await this.db
      .select({
        product: products,
        thumb: sql<
          string | null
        >`(select pi.filename from product_images pi where pi.product_id = ${sql.raw('products.id')} and pi.removed_at is null order by pi.sort_order limit 1)`,
        itemCount: sql<number>`(select count(*)::int from items i where i.product_id = ${sql.raw('products.id')} and i.archived_at is null)`,
        minPrice: sql<string>`(select coalesce(min(coalesce(i.price, ${sql.raw('products.price')})), ${sql.raw('products.price')})::text from items i where i.product_id = ${sql.raw('products.id')} and i.archived_at is null)`,
        maxPrice: sql<string>`(select coalesce(max(coalesce(i.price, ${sql.raw('products.price')})), ${sql.raw('products.price')})::text from items i where i.product_id = ${sql.raw('products.id')} and i.archived_at is null)`,
        onHand: sql<number>`(select on_hand from ${totals} t)`,
        available: sql<number>`(select available from ${totals} t)`,
        lowStock: lowStockExpr,
      })
      .from(products)
      .where(where)
      .orderBy(...(query.q ? [desc(rank)] : []), desc(products.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const items: ProductSummary[] = rows.map((r) => ({
      id: r.product.id,
      number: r.product.number,
      type: r.product.type,
      name: r.product.name,
      categoryId: r.product.categoryId,
      price: r.product.price,
      minPrice: Number(r.minPrice).toFixed(2),
      maxPrice: Number(r.maxPrice).toFixed(2),
      status: r.product.status,
      thumbnailUrl: r.thumb ? `/uploads/${r.thumb}-thumbnail.webp` : null,
      itemCount: Number(r.itemCount),
      onHand: Number(r.onHand),
      available: Number(r.available),
      lowStock: Boolean(r.lowStock),
      needsCompletion: Boolean(
        r.product.quickSoldAt && !r.product.completedAt && !r.product.oneOffAt,
      ),
      labelsPrintedAt: r.product.labelsPrintedAt?.toISOString() ?? null,
    }));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** What a scanned code points to: one item, or a product whose items must be picked. */
  async lookup(rawCode: string) {
    const code = normalizeBarcode(rawCode);
    const [hit] = await this.db.select().from(barcodes).where(eq(barcodes.code, code));
    if (hit) return { code, productId: hit.productId, itemId: hit.itemId };
    const [bySku] = await this.db
      .select({ id: items.id, productId: items.productId })
      .from(items)
      .where(eq(items.sku, rawCode.trim().toUpperCase()));
    if (bySku) return { code, productId: bySku.productId, itemId: bySku.id };
    throw notFound('Barcode');
  }

  // ---------------------------------------------------------------- update

  async update(
    actor: Actor,
    id: string,
    input: UpdateInput,
    can: (c: 'products.editPrice' | 'products.hide') => boolean,
  ): Promise<ProductView> {
    if (input.price !== undefined && !can('products.editPrice'))
      throw forbidden(undefined, 'Price changes need a manager');
    if (input.status !== undefined && !can('products.hide'))
      throw forbidden(undefined, 'Hiding needs a manager');
    await inTransaction(this.db, async (tx) => {
      const [before] = await tx.select().from(products).where(eq(products.id, id)).for('update');
      if (!before) throw notFound('Product');
      if (before.status === 'ARCHIVED')
        throw conflict(CATALOGUE_ERRORS.ARCHIVED, 'Archived products cannot change');
      if (before.version !== input.version)
        throw conflict(CATALOGUE_ERRORS.STALE_VERSION, 'Someone else changed this product', {
          version: before.version,
        });
      if (input.categoryId) await this.requireCategory(tx, input.categoryId);
      if (input.pointTextColor !== undefined && before.type !== 'NUMBERED') {
        throw badRequest(
          CATALOGUE_ERRORS.WRONG_PRODUCT_TYPE,
          'Marker colours belong to numbered products',
        );
      }
      const [after] = await tx
        .update(products)
        .set({
          ...(input.name && { name: cleanTranslatable(input.name) }),
          ...(input.description && { description: cleanTranslatable(input.description) }),
          ...(input.categoryId && { categoryId: input.categoryId }),
          ...(input.price !== undefined && { price: input.price }),
          ...(input.compareAtPrice !== undefined && { compareAtPrice: input.compareAtPrice }),
          ...(input.lowStockThreshold !== undefined && {
            lowStockThreshold: input.lowStockThreshold,
          }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.pointTextColor !== undefined && { pointTextColor: input.pointTextColor }),
          ...(input.pointBackgroundColor !== undefined && {
            pointBackgroundColor: input.pointBackgroundColor,
          }),
          version: before.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();
      if (input.optionNotes) {
        for (const note of input.optionNotes) {
          await tx
            .delete(productOptionNotes)
            .where(
              and(
                eq(productOptionNotes.productId, id),
                eq(productOptionNotes.valueId, note.valueId),
              ),
            );
          const cleaned = cleanTranslatable(note.note);
          if (note.note && Object.keys(cleaned).length) {
            await tx
              .insert(productOptionNotes)
              .values({ productId: id, valueId: note.valueId, note: cleaned });
          }
        }
      }
      await tx
        .update(products)
        .set({ searchText: await this.searchTextFor(tx, id) })
        .where(eq(products.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action:
          input.price !== undefined && input.price !== before.price ? 'UPDATE_PRICE' : 'UPDATE',
        entity: 'product',
        entityId: id,
        oldValue: before,
        newValue: after,
      });
    });
    return this.get(id, actor);
  }

  /** Effective price of an item right now (server price always wins at checkout). */
  async priceOf(
    executor: Executor,
    itemId: string,
  ): Promise<{ price: string; productId: string; active: boolean }> {
    const [row] = await executor
      .select({
        itemPrice: items.price,
        productPrice: products.price,
        productId: products.id,
        status: products.status,
        archived: items.archivedAt,
        isActive: items.isActive,
      })
      .from(items)
      .innerJoin(products, eq(products.id, items.productId))
      .where(eq(items.id, itemId));
    if (!row) throw notFound('Item');
    return {
      price: row.itemPrice ?? row.productPrice,
      productId: row.productId,
      active: row.status === 'ACTIVE' && row.isActive && !row.archived,
    };
  }

  /** Items whose stock entered without a known cost (cost list for the admin). */
  async unknownCostItems() {
    return this.db
      .select({
        itemId: items.id,
        sku: items.sku,
        productId: products.id,
        name: products.name,
        onHand: itemBalances.onHand,
      })
      .from(itemBalances)
      .innerJoin(items, eq(items.id, itemBalances.itemId))
      .innerJoin(products, eq(products.id, items.productId))
      .where(and(isNull(itemBalances.avgCost), ne(products.status, 'ARCHIVED')))
      .orderBy(asc(items.sku));
  }

  isMoneyChange(a: string | null, b: string | null): boolean {
    if (a === null || b === null) return a !== b;
    return toMinor(a) !== toMinor(b);
  }
}

export type { ImageView };
