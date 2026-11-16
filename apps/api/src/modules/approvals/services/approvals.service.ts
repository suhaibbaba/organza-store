import { Injectable } from '@nestjs/common';
import {
  type approvalListQuerySchema,
  type approvalRequestSchema,
  type ApprovalView,
  type Page,
  roleCan,
} from '@organza/shared';
import { and, desc, eq, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, forbidden, notFound } from '../../../common/lib/app-error.js';
import { PG, violatedConstraint } from '../../../common/lib/postgres-errors.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  approvalRequests,
  items,
  productImages,
  products,
  sales,
  users,
} from '../../../database/schema/index.js';
import { type Database, inTransaction, type Transaction } from '../../../database/unit-of-work.js';
import { ImagesService } from '../../catalogue/services/images.service.js';
import { ItemsService } from '../../catalogue/services/items.service.js';
import { ProductsService } from '../../catalogue/services/products.service.js';
import { ReturnsService } from '../../sales/services/returns.service.js';
import { StockService } from '../../stock/services/stock.service.js';
import { StockDocumentsService } from '../../stock/services/stock-documents.service.js';

export const APPROVAL_ERRORS = {
  NOT_PENDING: 'APPROVAL_NOT_PENDING',
  OWN_REQUEST: 'APPROVAL_OWN_REQUEST',
  NOT_YOURS: 'APPROVAL_NOT_YOURS',
  ALREADY_PENDING: 'APPROVAL_ALREADY_PENDING',
  STALE: 'APPROVAL_STALE',
  NOTHING_TO_ASK: 'APPROVAL_NOTHING_TO_ASK',
} as const;

type RequestInput = z.output<typeof approvalRequestSchema>;
type Row = typeof approvalRequests.$inferSelect;

/**
 * The approvals inbox (proposal C12). A request stores the action exactly as the employee
 * entered it; approving runs that action as the employee, in the same transaction as the
 * decision and its audit row, so an approval either happened completely or not at all.
 * Managers never decide their own requests (also a CHECK in the database).
 */
@Injectable()
export class ApprovalsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly products: ProductsService,
    private readonly items: ItemsService,
    private readonly images: ImagesService,
    private readonly stockDocuments: StockDocumentsService,
    private readonly stock: StockService,
    private readonly returns: ReturnsService,
  ) {}

  async request(actor: Actor, input: RequestInput): Promise<ApprovalView> {
    const id = await inTransaction(this.db, async (tx) => {
      const { entityType, entityId, summary, payload } = await this.describe(tx, input);
      let row: Row | undefined;
      try {
        [row] = await tx
          .insert(approvalRequests)
          .values({
            kind: input.kind,
            entityType,
            entityId,
            payload,
            summary,
            reason: input.reason,
            requestedBy: actor.id,
          })
          .returning();
      } catch (error) {
        if (violatedConstraint(error, PG.UNIQUE_VIOLATION) === 'approval_requests_one_pending')
          throw conflict(APPROVAL_ERRORS.ALREADY_PENDING, 'A request for this is already waiting');
        throw error;
      }
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'APPROVAL_REQUEST',
        entity: 'approval_request',
        entityId: row!.id,
        newValue: { kind: input.kind, summary },
        reason: input.reason,
      });
      return row!.id;
    });
    return this.get(id);
  }

  async approve(actor: Actor, id: string, note?: string): Promise<ApprovalView> {
    await inTransaction(this.db, async (tx) => {
      const req = await this.lockPending(tx, id);
      if (req.requestedBy === actor.id)
        throw forbidden(APPROVAL_ERRORS.OWN_REQUEST, 'Someone else has to approve your request');
      const [requester] = await tx
        .select({ id: users.id, role: users.role, name: users.name })
        .from(users)
        .where(eq(users.id, req.requestedBy));
      const resultId = await this.execute(tx, req, requester!, actor);
      await tx
        .update(approvalRequests)
        .set({
          status: 'APPROVED',
          decidedBy: actor.id,
          decidedAt: new Date(),
          decisionNote: note ?? null,
          resultId,
        })
        .where(eq(approvalRequests.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'APPROVAL_APPROVE',
        entity: 'approval_request',
        entityId: id,
        newValue: { kind: req.kind, requestedBy: req.requestedBy, resultId },
        reason: note ?? null,
      });
    });
    return this.get(id);
  }

  async reject(actor: Actor, id: string, note: string): Promise<ApprovalView> {
    await inTransaction(this.db, async (tx) => {
      const req = await this.lockPending(tx, id);
      if (req.requestedBy === actor.id)
        throw forbidden(APPROVAL_ERRORS.OWN_REQUEST, 'Cancel your own request instead');
      await tx
        .update(approvalRequests)
        .set({ status: 'REJECTED', decidedBy: actor.id, decidedAt: new Date(), decisionNote: note })
        .where(eq(approvalRequests.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'APPROVAL_REJECT',
        entity: 'approval_request',
        entityId: id,
        newValue: { kind: req.kind, requestedBy: req.requestedBy },
        reason: note,
      });
    });
    return this.get(id);
  }

  async cancel(actor: Actor, id: string): Promise<ApprovalView> {
    await inTransaction(this.db, async (tx) => {
      const req = await this.lockPending(tx, id);
      if (req.requestedBy !== actor.id)
        throw forbidden(APPROVAL_ERRORS.NOT_YOURS, 'Only the person who asked can cancel');
      await tx
        .update(approvalRequests)
        .set({ status: 'CANCELLED', decidedAt: new Date() })
        .where(eq(approvalRequests.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'APPROVAL_CANCEL',
        entity: 'approval_request',
        entityId: id,
      });
    });
    return this.get(id);
  }

  // ------------------------------------------------------------------ the actions

  /** Checks the request makes sense now and writes down what the inbox shows. */
  private async describe(tx: Transaction, input: RequestInput) {
    switch (input.kind) {
      case 'PRICE_CHANGE': {
        const current = await this.currentPrice(tx, input.target, input.id);
        if (input.price === current.price)
          throw badRequest(APPROVAL_ERRORS.NOTHING_TO_ASK, 'That is already the price');
        if (input.target === 'product' && input.price === null)
          throw badRequest(APPROVAL_ERRORS.NOTHING_TO_ASK, 'A product always has a price');
        return {
          entityType: input.target,
          entityId: input.id,
          payload: { ...input, from: current.price },
          summary: {
            name: current.name,
            sku: current.sku,
            productId: current.productId,
            from: current.price,
            to: input.price,
          },
        };
      }
      case 'STOCK_ADJUSTMENT': {
        // A counted quantity becomes the delta it means today; the delta is what gets approved.
        const ids = input.adjustment.lines.map((l) => l.itemId);
        const balances = await this.stock.balances(tx, ids);
        const lines = input.adjustment.lines.map((l) => ({
          itemId: l.itemId,
          delta:
            l.counted !== undefined ? l.counted - (balances.get(l.itemId)?.onHand ?? 0) : l.delta!,
        }));
        if (lines.some((l) => l.delta === 0))
          throw badRequest(APPROVAL_ERRORS.NOTHING_TO_ASK, 'Nothing changes for an item');
        const names = await this.itemNames(tx, ids);
        return {
          entityType: null,
          entityId: null,
          payload: { ...input, adjustment: { ...input.adjustment, lines } },
          summary: {
            reason: input.adjustment.reason,
            lines: lines.map((l) => ({ ...l, ...names.get(l.itemId) })),
          },
        };
      }
      case 'PRODUCT_HIDE': {
        const [p] = await tx.select().from(products).where(eq(products.id, input.productId));
        if (!p) throw notFound('Product');
        if (p.status === input.status)
          throw badRequest(APPROVAL_ERRORS.NOTHING_TO_ASK, 'It is already so');
        return {
          entityType: 'product',
          entityId: p.id,
          payload: input,
          summary: { name: p.name, productId: p.id, status: input.status },
        };
      }
      case 'IMAGE_DELETE': {
        const [image] = await tx
          .select()
          .from(productImages)
          .where(eq(productImages.id, input.imageId));
        if (!image || image.removedAt) throw notFound('Image');
        const [p] = image.productId
          ? await tx.select().from(products).where(eq(products.id, image.productId))
          : [];
        return {
          entityType: 'product_image',
          entityId: image.id,
          payload: input,
          summary: {
            imageUrl: `/uploads/${image.filename}-thumbnail.webp`,
            productId: image.productId,
            name: p?.name ?? null,
          },
        };
      }
      case 'REFUND':
      case 'VOID': {
        const saleId = input.kind === 'REFUND' ? input.request.saleId : input.saleId;
        const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId));
        if (!sale) throw notFound('Sale');
        return {
          entityType: 'sale',
          entityId: sale.id,
          payload: input,
          summary: {
            saleNumber: sale.number,
            saleId: sale.id,
            total: sale.total,
            lines: input.kind === 'REFUND' ? input.request.lines.length : null,
            exchange: input.kind === 'REFUND' ? Boolean(input.request.exchange) : false,
          },
        };
      }
    }
  }

  /** Runs the approved action as the employee who asked; returns the document it made. */
  private async execute(
    tx: Transaction,
    req: Row,
    requester: Actor,
    approver: Actor,
  ): Promise<string | null> {
    const input = req.payload as RequestInput & { from?: string | null };
    switch (input.kind) {
      case 'PRICE_CHANGE': {
        const current = await this.currentPrice(tx, input.target, input.id, true);
        if (current.price !== (input.from ?? null))
          throw conflict(APPROVAL_ERRORS.STALE, 'The price changed since this was asked', {
            price: current.price,
          });
        if (input.target === 'product')
          await this.products.update(
            requester,
            input.id,
            { version: current.version!, price: input.price! },
            () => true,
          );
        else await this.items.updateItem(requester, input.id, { price: input.price }, true);
        return input.id;
      }
      case 'STOCK_ADJUSTMENT': {
        const doc = await this.stockDocuments.createAdjustment(requester, input.adjustment);
        return doc.id;
      }
      case 'PRODUCT_HIDE': {
        const [p] = await tx
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .for('update');
        if (!p) throw notFound('Product');
        if (p.status === 'ARCHIVED')
          throw conflict(APPROVAL_ERRORS.STALE, 'The product was archived meanwhile');
        await this.products.update(
          requester,
          p.id,
          { version: p.version, status: input.status },
          () => true,
        );
        return p.id;
      }
      case 'IMAGE_DELETE':
        await this.images.remove(requester, input.imageId);
        return input.imageId;
      case 'REFUND': {
        const r = await this.returns.create(requester, input.request, approver.id);
        return r.id;
      }
      case 'VOID': {
        const r = await this.returns.voidSale(requester, input.saleId, input.request, approver.id);
        return r.id;
      }
    }
  }

  private async currentPrice(
    tx: Transaction,
    target: 'product' | 'item',
    id: string,
    lock = false,
  ) {
    if (target === 'product') {
      const q = tx.select().from(products).where(eq(products.id, id));
      const [p] = lock ? await q.for('update') : await q;
      if (!p) throw notFound('Product');
      if (p.status === 'ARCHIVED')
        throw conflict(APPROVAL_ERRORS.STALE, 'Archived products cannot change');
      return { price: p.price, name: p.name, sku: null, productId: p.id, version: p.version };
    }
    const q = tx
      .select({ item: items, name: products.name })
      .from(items)
      .innerJoin(products, eq(products.id, items.productId))
      .where(eq(items.id, id));
    const [row] = lock ? await q.for('update', { of: items }) : await q;
    if (!row) throw notFound('Item');
    return {
      price: row.item.price,
      name: row.name,
      sku: row.item.sku,
      productId: row.item.productId,
      version: null,
    };
  }

  private async itemNames(tx: Transaction, ids: string[]) {
    const rows = await tx
      .select({ id: items.id, sku: items.sku, name: products.name })
      .from(items)
      .innerJoin(products, eq(products.id, items.productId))
      .where(sql`${items.id} in ${ids}`);
    if (rows.length !== new Set(ids).size) throw notFound('Item');
    return new Map(rows.map((r) => [r.id, { sku: r.sku, name: r.name }]));
  }

  private async lockPending(tx: Transaction, id: string): Promise<Row> {
    const [req] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .for('update');
    if (!req) throw notFound('Request');
    if (req.status !== 'PENDING')
      throw conflict(APPROVAL_ERRORS.NOT_PENDING, 'This request was already decided');
    return req;
  }

  // ------------------------------------------------------------------ reading

  async get(id: string): Promise<ApprovalView> {
    const [row] = await this.query(eq(approvalRequests.id, id), 1, 0);
    if (!row) throw notFound('Request');
    return row;
  }

  async list(
    actor: Actor,
    query: z.output<typeof approvalListQuerySchema>,
  ): Promise<Page<ApprovalView> & { pending: number }> {
    const mine = query.mine || !roleCan(actor.role, 'approvals.decide');
    const filter = and(
      query.status ? eq(approvalRequests.status, query.status) : undefined,
      mine ? eq(approvalRequests.requestedBy, actor.id) : undefined,
    );
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(approvalRequests)
      .where(filter);
    // What waits for this person: others' pending requests for a manager, their own otherwise.
    const [{ pending } = { pending: 0 }] = await this.db
      .select({ pending: sql<number>`count(*)::int` })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.status, 'PENDING'),
          mine
            ? eq(approvalRequests.requestedBy, actor.id)
            : sql`${approvalRequests.requestedBy} <> ${actor.id}`,
        ),
      );
    return {
      items: await this.query(filter, query.pageSize, (query.page - 1) * query.pageSize),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pending,
    };
  }

  private async query(filter: SQL | undefined, limit: number, offset: number) {
    const decider = alias(users, 'decider');
    const rows = await this.db
      .select({ r: approvalRequests, requesterName: users.name, deciderName: decider.name })
      .from(approvalRequests)
      .innerJoin(users, eq(users.id, approvalRequests.requestedBy))
      .leftJoin(decider, eq(decider.id, approvalRequests.decidedBy))
      .where(filter)
      .orderBy(
        sql`case when ${approvalRequests.status} = 'PENDING' then 0 else 1 end`,
        desc(approvalRequests.requestedAt),
      )
      .limit(limit)
      .offset(offset);
    return rows.map(({ r, requesterName, deciderName }): ApprovalView => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      reason: r.reason,
      summary: r.summary as Record<string, unknown>,
      entityType: r.entityType,
      entityId: r.entityId,
      requestedBy: { id: r.requestedBy, name: requesterName },
      requestedAt: r.requestedAt.toISOString(),
      decidedBy: r.decidedBy ? { id: r.decidedBy, name: deciderName ?? '' } : null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decisionNote: r.decisionNote,
      resultId: r.resultId,
    }));
  }
}
