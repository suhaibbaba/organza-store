import { Injectable } from '@nestjs/common';
import {
  type addItemsSchema,
  type archiveProductSchema,
  skuFor,
  type updateItemSchema,
} from '@organza/shared';
import { and, asc, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  barcodes,
  itemBalances,
  itemOptionValues,
  items,
  optionValues,
  productOptionTypes,
  products,
  stockMovements,
} from '../../../database/schema/index.js';
import { type Database, inTransaction, type Transaction } from '../../../database/unit-of-work.js';
import { LedgerService, credit, debit } from '../../ledger/services/ledger.service.js';
import { StockService } from '../../stock/services/stock.service.js';
import { valueOf } from '../../stock/lib/costing.js';
import { CATALOGUE_ERRORS } from '../constants.js';
import { BarcodesService } from './barcodes.service.js';
import { ProductsService } from './products.service.js';

/** Where the value of goods that left with an unknown cost should have gone, by reason. */
const COST_ACCOUNT_BY_REASON: Record<string, 'COGS' | 'DAMAGE_AND_LOSS' | 'PROMOTIONS'> = {
  SALE: 'COGS',
  GIFT: 'PROMOTIONS',
};

@Injectable()
export class ItemsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly barcodes: BarcodesService,
    private readonly stock: StockService,
    private readonly ledger: LedgerService,
    private readonly products: ProductsService,
  ) {}

  async updateItem(
    actor: Actor,
    itemId: string,
    input: z.output<typeof updateItemSchema>,
    canEditPrice: boolean,
  ) {
    if (input.price !== undefined && !canEditPrice)
      throw badRequest('FORBIDDEN', 'Price changes need a manager');
    return inTransaction(this.db, async (tx) => {
      const [before] = await tx.select().from(items).where(eq(items.id, itemId)).for('update');
      if (!before) throw notFound('Item');
      if (input.isActive === false) await this.assertNotLastActive(tx, before.productId, itemId);
      const [after] = await tx
        .update(items)
        .set({
          ...(input.price !== undefined && { price: input.price }),
          ...(input.location !== undefined && { location: input.location }),
          ...(input.photoX !== undefined && {
            photoX: input.photoX === null ? null : String(input.photoX),
          }),
          ...(input.photoY !== undefined && {
            photoY: input.photoY === null ? null : String(input.photoY),
          }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          updatedAt: new Date(),
        })
        .where(eq(items.id, itemId))
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: input.price !== undefined ? 'UPDATE_PRICE' : 'UPDATE',
        entity: 'item',
        entityId: itemId,
        oldValue: before,
        newValue: after,
      });
      return after!;
    });
  }

  /** New combinations on a variant product or new numbers on a numbered one. */
  async addItems(actor: Actor, productId: string, input: z.output<typeof addItemsSchema>) {
    await this.idempotency.run(
      'items.add',
      input.idempotencyKey,
      actor.id,
      { productId, ...input },
      async (tx) => {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .for('update');
        if (!product) throw notFound('Product');
        if (product.status === 'ARCHIVED') throw conflict(CATALOGUE_ERRORS.ARCHIVED, 'Archived');
        const [{ last } = { last: 0 }] = await tx
          .select({ last: max(items.number) })
          .from(items)
          .where(eq(items.productId, productId));
        const existing = await tx.select().from(items).where(eq(items.productId, productId));
        let next = (last ?? 0) + 1;
        const planned: {
          number: number;
          valueIds: string[];
          stock: number;
          price?: string;
          cost?: string;
          barcode?: string;
          photoX?: number;
          photoY?: number;
        }[] = [];
        if (product.type === 'VARIANT') {
          if (input.numbers.length)
            throw badRequest(
              CATALOGUE_ERRORS.WRONG_PRODUCT_TYPE,
              'Numbers belong to numbered products',
            );
          const typeIds = (
            await tx
              .select()
              .from(productOptionTypes)
              .where(eq(productOptionTypes.productId, productId))
          ).map((t) => t.typeId);
          const links = existing.length
            ? await tx
                .select()
                .from(itemOptionValues)
                .where(
                  inArray(
                    itemOptionValues.itemId,
                    existing.map((e) => e.id),
                  ),
                )
            : [];
          const combos = new Set(
            existing.map((e) =>
              links
                .filter((l) => l.itemId === e.id)
                .map((l) => l.valueId)
                .sort()
                .join('+'),
            ),
          );
          const values = await tx
            .select()
            .from(optionValues)
            .where(
              inArray(optionValues.id, [
                ...new Set(input.variants.flatMap((v) => v.valueIds)),
                '00000000-0000-0000-0000-000000000000',
              ]),
            );
          const typeOf = new Map(values.map((v) => [v.id, v.typeId]));
          for (const v of input.variants) {
            const used = v.valueIds.map((id) => typeOf.get(id));
            if (
              v.valueIds.length !== typeIds.length ||
              used.some((t) => !t || !typeIds.includes(t)) ||
              new Set(used).size !== used.length
            ) {
              throw badRequest(
                CATALOGUE_ERRORS.INVALID_COMBINATION,
                'Each variant needs one value per option',
              );
            }
            const key = [...v.valueIds].sort().join('+');
            if (combos.has(key))
              throw conflict(CATALOGUE_ERRORS.DUPLICATE_COMBINATION, 'Combination already exists');
            combos.add(key);
            planned.push({
              number: next++,
              valueIds: v.valueIds,
              stock: v.stock,
              ...(v.price && { price: v.price }),
              ...(v.cost && { cost: v.cost }),
              ...(v.barcode && { barcode: v.barcode }),
            });
          }
        } else if (product.type === 'NUMBERED') {
          if (input.variants.length)
            throw badRequest(
              CATALOGUE_ERRORS.WRONG_PRODUCT_TYPE,
              'Variants belong to variant products',
            );
          const taken = new Set(existing.map((e) => e.number));
          for (const n of input.numbers) {
            if (taken.has(n.number))
              throw conflict(CATALOGUE_ERRORS.DUPLICATE_NUMBER, `Number ${n.number} exists`);
            taken.add(n.number);
            planned.push({
              number: n.number,
              valueIds: [],
              stock: n.stock,
              ...(n.price && { price: n.price }),
              ...(n.cost && { cost: n.cost }),
              ...(n.barcode && { barcode: n.barcode }),
              ...(n.photoX !== undefined && { photoX: n.photoX }),
              ...(n.photoY !== undefined && { photoY: n.photoY }),
            });
          }
        } else {
          throw badRequest(
            CATALOGUE_ERRORS.WRONG_PRODUCT_TYPE,
            'A regular product has exactly one item',
          );
        }
        await this.barcodes.assertFree(
          tx,
          planned.map((p) => p.barcode).filter((c): c is string => Boolean(c)),
        );
        const rows = await tx
          .insert(items)
          .values(
            planned.map((p) => ({
              productId,
              number: p.number,
              sku: skuFor(product.number, p.number),
              price: p.price ?? null,
              photoX: p.photoX === undefined ? null : String(p.photoX),
              photoY: p.photoY === undefined ? null : String(p.photoY),
            })),
          )
          .returning();
        const byNumber = new Map(rows.map((r) => [r.number, r.id]));
        const links = planned.flatMap((p) =>
          p.valueIds.map((valueId) => ({ itemId: byNumber.get(p.number)!, valueId })),
        );
        if (links.length) await tx.insert(itemOptionValues).values(links);
        const reserved = new Set<string>();
        for (const p of planned) {
          await tx.insert(barcodes).values({
            code: p.barcode ?? (await this.barcodes.generate(tx, reserved)),
            productId,
            itemId: byNumber.get(p.number)!,
            source: p.barcode ? 'SUPPLIER' : 'GENERATED',
            createdBy: actor.id,
          });
        }
        await tx
          .insert(itemBalances)
          .values(rows.map((r) => ({ itemId: r.id })))
          .onConflictDoNothing();
        const withStock = planned.filter((p) => p.stock > 0);
        if (withStock.length) {
          await this.stock.apply(tx, {
            sourceType: 'product',
            sourceId: productId,
            event: 'INITIAL_STOCK',
            actorId: actor.id,
            lines: withStock.map((p) => ({
              itemId: byNumber.get(p.number)!,
              quantity: p.stock,
              reason: 'INITIAL',
              counterAccount: 'OPENING_BALANCES',
              ...(actor.role === 'ADMIN' && p.cost && { unitCost: p.cost }),
            })),
          });
        }
        await tx
          .update(products)
          .set({
            searchText: await this.products.searchTextFor(tx, productId),
            version: sql`${products.version} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'ADD_ITEMS',
          entity: 'product',
          entityId: productId,
          newValue: rows,
        });
        return { productId };
      },
    );
    return this.products.get(productId, actor);
  }

  async addBarcode(actor: Actor, productId: string, code: string, itemId: string | undefined) {
    await inTransaction(this.db, async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .for('update');
      if (!product) throw notFound('Product');
      if (itemId) {
        const [item] = await tx
          .select()
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.productId, productId)));
        if (!item) throw notFound('Item');
      }
      await this.barcodes.assertFree(tx, [code]);
      await tx.insert(barcodes).values({
        code,
        productId,
        itemId: itemId ?? null,
        source: 'SUPPLIER',
        createdBy: actor.id,
      });
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'ADD_BARCODE',
        entity: 'product',
        entityId: productId,
        newValue: { code, itemId },
      });
    });
    return this.products.get(productId, actor);
  }

  /**
   * Fills in a cost that was unknown. Stock still on hand is brought onto the books at that
   * cost; units that already left at zero cost get a correcting entry (proposal C9).
   */
  async setCost(actor: Actor, itemId: string, cost: string) {
    await inTransaction(this.db, async (tx) => {
      const balances = await this.stock.lock(tx, [itemId]);
      const balance = balances.get(itemId)!;
      if (balance.avgCost !== null)
        throw conflict(
          CATALOGUE_ERRORS.COST_ALREADY_KNOWN,
          'Cost already known; it changes through purchasing',
        );
      const unitCost = Number(cost).toFixed(4);
      const unknownOut = await tx
        .select({
          reason: stockMovements.reason,
          quantity: sql<number>`sum(${stockMovements.quantity})::int`,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.itemId, itemId),
            eq(stockMovements.costUnknown, true),
            eq(stockMovements.bucket, 'ON_HAND'),
            sql`${stockMovements.quantity} < 0`,
          ),
        )
        .groupBy(stockMovements.reason);
      const lines = [];
      if (balance.onHand > 0) {
        const value = valueOf(balance.onHand, unitCost);
        lines.push(debit('INVENTORY', value), credit('OPENING_BALANCES', value));
      }
      for (const row of unknownOut) {
        const value = valueOf(row.quantity, unitCost);
        lines.push(
          debit(COST_ACCOUNT_BY_REASON[row.reason] ?? 'DAMAGE_AND_LOSS', value),
          credit('OPENING_BALANCES', value),
        );
      }
      await this.ledger.post(tx, {
        sourceType: 'item_cost',
        sourceId: itemId,
        event: 'COST_FILLED_IN',
        createdBy: actor.id,
        lines,
      });
      await tx
        .update(itemBalances)
        .set({ avgCost: unitCost, updatedAt: new Date() })
        .where(eq(itemBalances.itemId, itemId));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SET_COST',
        entity: 'item',
        entityId: itemId,
        oldValue: { avgCost: null },
        newValue: { avgCost: unitCost },
      });
    });
    const [item] = await this.db
      .select({ productId: items.productId })
      .from(items)
      .where(eq(items.id, itemId));
    return this.products.get(item!.productId, actor);
  }

  /** Archive, never delete. Stock on hand is written off as loss or kept counted (asked). */
  async archiveProduct(
    actor: Actor,
    productId: string,
    input: z.output<typeof archiveProductSchema>,
  ) {
    await inTransaction(this.db, async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .for('update');
      if (!product) throw notFound('Product');
      if (product.status === 'ARCHIVED') return;
      const productItems = await tx
        .select()
        .from(items)
        .where(and(eq(items.productId, productId), isNull(items.archivedAt)))
        .orderBy(asc(items.id));
      const balances = await this.stock.lock(
        tx,
        productItems.map((i) => i.id),
      );
      if ([...balances.values()].some((b) => b.reserved > 0)) {
        throw conflict('PRODUCT_HAS_RESERVATIONS', 'Some pieces are held for customers or orders');
      }
      if (input.stock === 'WRITE_OFF') {
        const lines = [...balances.values()].flatMap((b) => [
          ...(b.onHand > 0
            ? [
                {
                  itemId: b.itemId,
                  quantity: -b.onHand,
                  reason: 'LOSS' as const,
                  counterAccount: 'DAMAGE_AND_LOSS' as const,
                  note: input.reason,
                },
              ]
            : []),
          ...(b.damaged > 0
            ? [
                {
                  itemId: b.itemId,
                  bucket: 'DAMAGED' as const,
                  quantity: -b.damaged,
                  reason: 'WRITE_OFF_DAMAGED' as const,
                  counterAccount: 'DAMAGE_AND_LOSS' as const,
                },
              ]
            : []),
        ]);
        if (lines.length) {
          await this.stock.apply(tx, {
            sourceType: 'product_archive',
            sourceId: productId,
            event: 'ARCHIVE_WRITE_OFF',
            actorId: actor.id,
            lines,
          });
        }
      }
      const now = new Date();
      await tx
        .update(items)
        .set({ archivedAt: now, isActive: false, updatedAt: now })
        .where(and(eq(items.productId, productId), isNull(items.archivedAt)));
      await tx
        .update(products)
        .set({ status: 'ARCHIVED', archivedAt: now, version: product.version + 1, updatedAt: now })
        .where(eq(products.id, productId));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'ARCHIVE',
        entity: 'product',
        entityId: productId,
        oldValue: { status: product.status },
        newValue: { status: 'ARCHIVED', stock: input.stock },
        reason: input.reason ?? null,
      });
    });
    return this.products.get(productId, actor);
  }

  async markLabelsPrinted(actor: Actor, productIds: string[]) {
    if (productIds.length === 0) return;
    await inTransaction(this.db, async (tx) => {
      await tx
        .update(products)
        .set({ labelsPrintedAt: new Date() })
        .where(inArray(products.id, productIds));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'LABELS_PRINTED',
        entity: 'product',
        newValue: { productIds },
      });
    });
  }

  private async assertNotLastActive(tx: Transaction, productId: string, itemId: string) {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(items)
      .where(
        and(
          eq(items.productId, productId),
          eq(items.isActive, true),
          isNull(items.archivedAt),
          sql`${items.id} <> ${itemId}`,
        ),
      );
    if (!row?.n)
      throw conflict(CATALOGUE_ERRORS.LAST_ITEM, 'A product needs at least one sellable item');
  }
}
