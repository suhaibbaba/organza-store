import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import { isOrderCollectable } from "@organza/shared/lib/orders";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  collectOrdersSchema,
  createOrderSchema,
  customerSuggestionsQuerySchema,
  listOrdersQuerySchema,
  returnOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  type CollectOrdersInput,
  type CreateOrderInput,
  type CustomerSuggestionsQuery,
  type ListOrdersQuery,
  type ReturnOrderInput,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
} from "@/validation/order";
import {
  asGiftLines,
  computeOrderTotals,
  priceLine,
  priceRequestedItems,
  toStockMovements,
} from "@/lib/orderPricing";
import { deductStock, restoreStock } from "@/lib/orderStock";
import { createQuickSoldProduct } from "@/lib/quickSell";
import {
  announceFiledChangeRequest,
  fileChangeRequestInTransaction,
  quickSellValue,
} from "@/lib/changeRequests";
import { serializeOrder, serializeOrderSummary } from "@/lib/orderSerialize";
import { queryCollectionSummary, toCollectionSummary } from "@/lib/orderCollection";
import { findCustomerSuggestions } from "@/lib/orderCustomers";
import { scheduleSaleNotification } from "@/lib/saleNotifications";
import { writeAudit } from "@/lib/audit";
import {
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_FIELDS,
  COLLECTABLE_ORDER_STATUSES,
  ERROR_CODES,
  GIFT_ORDER_TYPE,
  MAX_INT32,
  ONLINE_ORDER_CHANNELS,
  ONLINE_ORDER_INITIAL_PAYMENT_STATUS,
  ONLINE_ORDER_INITIAL_STATUS,
  ONLINE_STOCK_DEDUCTION_STATUS,
  ORDER_STATUS_TRANSITIONS,
  RETURNABLE_ORDER_STATUSES,
  STORE_ORDER_INITIAL_PAYMENT_STATUS,
  STORE_ORDER_INITIAL_STATUS,
  UNEDITABLE_ORDER_STATUSES,
} from "@/constants";
import type {
  AnyRecord,
  CollectResult,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PricedOrderItem,
} from "@/types";

// Orders (Phase 2). Two shapes of sale share one model:
//   STORE    — rung up at the POS counter; opens COMPLETED with stock
//              already deducted and the cash already in the till, because the
//              customer walks out with it.
//   WHATSAPP / WEBSITE — taken remotely; opens NEW and travels
//              NEW -> PREPARING -> HANDED_TO_COURIER, committing stock when
//              preparation starts. The shop's part ends at the handover: it
//              does not track the parcel to the customer's door.
// Being paid is tracked separately from all of that (paymentStatus): the
// delivery company settles up later, so a sold order and a collected one are
// two different facts.
// Money is computed here from the catalogue and the caller's discounts; no
// total is ever accepted from a client.
const router = Router();
router.use(requireAuth);

const orderInclude = {
  items: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
  // Just the author's name, so the admin can say who took the order without
  // reading the staff list (which is Admin-only). Nothing sensitive is
  // selected — no email, phone or idNumber (CLAUDE.md rule 19).
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Soft-deleted orders are invisible to every route, so a deleted sale can
// neither be read, edited, advanced nor returned — only the audit log and a
// direct DB look still hold it.
async function loadOrder(id: string): Promise<OrderWithItems> {
  const order = await prisma.order.findFirst({ where: { id, deletedAt: null }, include: orderInclude });
  if (!order) throw new AppError(404, ERROR_CODES.ORDER_NOT_FOUND);
  return order;
}

// What is still on the customer's side of the counter for each line — what a
// cancellation has to put back, and what a return can still take back.
function outstandingMovements(order: OrderWithItems) {
  return toStockMovements(
    order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity - item.returnedQuantity,
    }))
  );
}

function isOnlineChannel(channel: string): boolean {
  return (ONLINE_ORDER_CHANNELS as readonly string[]).includes(channel);
}

// ---------------------------------------------------------------------------
// GET /api/orders — list (pagination + filtering + sorting)
// ---------------------------------------------------------------------------
router.get(
  "/",
  requirePermission("order.view"),
  validateQuery(listOrdersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListOrdersQuery;
    const where: Prisma.OrderWhereInput = { deletedAt: null };

    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
    // Unset means both: the orders list is the record of everything that left
    // the shop, sold or given away.
    if (query.type) where.type = query.type;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    // "Which sales still need reviewing" (spec.md "Quick sell"). Unset lists
    // everything: a quick sale is an ordinary sale in every other respect,
    // and hiding it would be worse than marking it.
    if (query.hasQuickSale) where.hasQuickSale = true;

    // The outstanding-money view asks for PENDING_COLLECTION + this: a
    // cancelled or fully returned sale is still technically "not collected",
    // but nobody owes anything on it, so it must not pad the list the shop
    // chases the delivery company with.
    if (query.collectableOnly) {
      const collectable = [...COLLECTABLE_ORDER_STATUSES] as OrderStatus[];
      // Combined with an explicit status filter the two intersect, so asking
      // for a non-collectable status alongside the flag matches nothing
      // rather than quietly having one of the two dropped.
      where.status = { in: query.status ? collectable.filter((s) => s === query.status) : collectable };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      };
    }

    // Staff look an order up by whatever they have in front of them: the
    // number on the receipt, or the customer's name/phone from the chat.
    // orderNumber is a 32-bit column, so a longer run of digits (a phone
    // number, say) is matched as text only rather than being handed to
    // Postgres as an out-of-range integer.
    if (query.q) {
      const asNumber = Number(query.q);
      const isOrderNumber = Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= MAX_INT32;
      where.OR = [
        { customerName: { contains: query.q, mode: "insensitive" } },
        { customerPhone: { contains: query.q, mode: "insensitive" } },
        ...(isOrderNumber ? [{ orderNumber: asNumber }] : []),
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    sendOk(res, orders.map(serializeOrderSummary), {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/orders/collection-summary — what the delivery company still owes,
// across every sale regardless of date. Declared before /:id so the literal
// path isn't swallowed as an order id.
//
// Gated on order.markCollected, NOT on order.view: this is a shop-wide money
// total, the same class of figure as a report, and order.view is held by an
// Employee so they can follow the orders they took. It also matches who the
// answer is for — the people who settle up with the delivery company are the
// people who chase it — and it is what the two screens reading it (the
// collection page, the dashboard's "needs attention") already require.
// ---------------------------------------------------------------------------
router.get(
  "/collection-summary",
  requirePermission("order.markCollected"),
  asyncHandler(async (_req, res) => {
    sendOk(res, toCollectionSummary(await queryCollectionSummary()));
  })
);

// ---------------------------------------------------------------------------
// GET /api/orders/customer-suggestions — repeat customers matching the phone
// digits typed so far, for the POS's WhatsApp order form. Declared before
// /:id so the literal path isn't swallowed as an order id.
//
// Gated on order.view like every other read of order data, which is exactly
// the right level: an Employee takes these orders at the counter, and this
// returns nothing they wouldn't see on the order list anyway (no cost, no
// staff details — CLAUDE.md rule 19).
// ---------------------------------------------------------------------------
router.get(
  "/customer-suggestions",
  requirePermission("order.view"),
  validateQuery(customerSuggestionsQuerySchema),
  asyncHandler(async (req, res) => {
    const { q } = req.validatedQuery as CustomerSuggestionsQuery;
    sendOk(res, await findCustomerSuggestions(q));
  })
);

// ---------------------------------------------------------------------------
// POST /api/orders/collect — record that the delivery company has paid for
// one or more orders. Admin/Manager only (order.markCollected): an Employee
// may take a sale but must never be able to declare its money received.
//
// Marking an already-collected order is a no-op rather than an error, so two
// people settling the same batch at once can't produce a failure.
// ---------------------------------------------------------------------------
router.post(
  "/collect",
  requirePermission("order.markCollected"),
  validateBody(collectOrdersSchema),
  asyncHandler(async (req, res) => {
    const { orderIds } = req.body as CollectOrdersInput;
    // Same id twice in one batch is the caller repeating themselves, not two
    // collections.
    const ids = [...new Set(orderIds)];

    const orders = await prisma.order.findMany({ where: { id: { in: ids }, deletedAt: null } });
    const found = new Set(orders.map((order) => order.id));
    if (ids.some((id) => !found.has(id))) throw new AppError(404, ERROR_CODES.ORDER_NOT_FOUND);

    // A cancelled or fully returned sale owes the shop nothing, so there is
    // no money on it to collect.
    if (orders.some((order) => !isOrderCollectable(order.status))) {
      throw new AppError(409, ERROR_CODES.ORDER_NOT_COLLECTABLE);
    }

    const pending = orders.filter((order) => order.paymentStatus === "PENDING_COLLECTION");
    const collectedAt = new Date();

    if (pending.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: pending.map((order) => order.id) } },
        data: { paymentStatus: "COLLECTED" as PaymentStatus, collectedAt },
      });
    }

    // One audit entry per order, not per batch: "who said the money for order
    // 412 arrived" has to be answerable on its own (CLAUDE.md rule 6).
    for (const order of pending) {
      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.PAYMENT_COLLECTED,
        entityType: AUDIT_ENTITY.ORDER,
        entityId: order.id,
        oldValue: { paymentStatus: order.paymentStatus, collectedAt: order.collectedAt },
        newValue: { paymentStatus: "COLLECTED", collectedAt },
      });
    }

    const result: CollectResult = {
      collectedIds: pending.map((order) => order.id),
      alreadyCollectedIds: orders
        .filter((order) => order.paymentStatus === "COLLECTED")
        .map((order) => order.id),
      collectedAt: collectedAt.toISOString(),
    };

    sendOk(res, result);
  })
);

// ---------------------------------------------------------------------------
// GET /api/orders/:id — detail
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  requirePermission("order.view"),
  asyncHandler(async (req, res) => {
    const order = await loadOrder(req.params.id);
    sendOk(res, serializeOrder(order, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// POST /api/orders — create (Admin/Manager/Employee: spec.md lets an
// Employee ring up a sale, just not undo one)
// ---------------------------------------------------------------------------
router.post(
  "/",
  requirePermission("order.create"),
  validateBody(createOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateOrderInput;

    // Giving stock away is not something an Employee may do: someone who
    // could file a sale as a gift could walk out with the piece. Checked here
    // rather than on the route because order.create is the gate for the
    // ordinary case and this is the narrower one on top of it. (The schema
    // has already refused a gift on any channel but STORE.)
    const isGift = body.type === GIFT_ORDER_TYPE;
    if (isGift && !can(req.user!, "order.createGift")) throw new AppError(403, ERROR_CODES.FORBIDDEN);

    // Quick sell (spec.md "Quick sell"): lines naming a piece that is not in
    // the catalogue at all. Refused up front for anybody without the
    // permission — the sale would otherwise create a product they may not
    // create (CLAUDE.md rule 5) — and refused on a gift, because giving away
    // something the shop has no record of buying is not a gift, it is a piece
    // walking out with nothing to show it ever existed.
    const quickSellCount = body.items.filter((item) => item.quickSell).length;
    if (quickSellCount > 0) {
      if (!can(req.user!, "product.quickSell")) throw new AppError(403, ERROR_CODES.FORBIDDEN);
      if (isGift) throw new AppError(400, ERROR_CODES.ORDER_ITEM_SOURCE_INVALID);
    }

    // Prices, names and costs are read from the catalogue here and frozen
    // onto the lines — the caller only named products and quantities. Quick
    // sold lines have no catalogue entry to read, so they are priced inside
    // the transaction below, where their product is created.
    const catalogue = await priceRequestedItems(
      body.items
        .filter((item) => item.productId)
        .map((item) => ({ ...item, productId: item.productId! }))
    );

    // A counter sale differs from a remote one in three ways at once: it
    // opens finished, it takes its stock off the shelf immediately, and its
    // money is already in the till. A gift takes the same path — it is handed
    // over at the counter — with nothing to collect.
    const isCounterSale = body.channel === "STORE";
    const now = new Date();

    const { created, quickSellRequests } = await prisma.$transaction(async (tx) => {
      // The lines, back in the order they were sent. Catalogue lines were
      // priced above; a quick-sold line creates its product here, inside this
      // transaction, so an abandoned or failed sale can never leave a
      // half-made product behind (see lib/quickSell.ts).
      const quickSold: { line: PricedOrderItem; input: NonNullable<CreateOrderInput["items"][number]["quickSell"]> }[] = [];
      const lines: PricedOrderItem[] = [];
      let nextCatalogueLine = 0;

      for (const item of body.items) {
        if (!item.quickSell) {
          lines.push(catalogue[nextCatalogueLine]);
          nextCatalogueLine += 1;
          continue;
        }
        const product = await createQuickSoldProduct(
          tx,
          { quickSell: item.quickSell, quantity: item.quantity, discountType: item.discountType, discountValue: item.discountValue },
          req.user!,
          now
        );
        lines.push(product.line);
        quickSold.push({ line: product.line, input: item.quickSell });
      }

      // A gift charges nothing: every line is re-priced at zero, and only
      // unitCost survives — that is what the shop actually lost. (A gift can
      // hold no quick-sold line; that was refused above.)
      const priced = isGift ? asGiftLines(lines) : lines;
      const totals = computeOrderTotals(
        priced.map((line) => line.lineTotal),
        // A discount off nothing is nothing; a gift's order-level discount is
        // dropped rather than applied to a zero subtotal.
        isGift ? {} : body
      );

      const order = await tx.order.create({
        data: {
          channel: body.channel,
          type: body.type as OrderType,
          status: (isCounterSale ? STORE_ORDER_INITIAL_STATUS : ONLINE_ORDER_INITIAL_STATUS) as OrderStatus,
          paymentMethod: body.paymentMethod,
          // An order going out with the courier is not paid for until the
          // delivery company settles up (spec.md "Payment collection").
          paymentStatus: (isCounterSale
            ? STORE_ORDER_INITIAL_PAYMENT_STATUS
            : ONLINE_ORDER_INITIAL_PAYMENT_STATUS) as PaymentStatus,
          collectedAt: isCounterSale ? now : null,
          customerName: body.customerName ?? null,
          customerPhone: body.customerPhone ?? null,
          customerWhatsapp: body.customerWhatsapp ?? null,
          customerAddress: body.customerAddress ?? null,
          customerLatitude: body.customerLatitude ?? null,
          customerLongitude: body.customerLongitude ?? null,
          note: body.note ?? null,
          subtotal: totals.subtotal,
          discountType: isGift ? null : body.discountType ?? null,
          discountValue: isGift ? null : body.discountValue ?? null,
          discountAmount: totals.discountAmount,
          total: totals.total,
          stockDeductedAt: isCounterSale ? now : null,
          // A fact about the sale, kept on the sale: it stays true after the
          // product has been completed, ruled a one-off or removed, and the
          // orders list filters on it without reading every line.
          hasQuickSale: quickSold.length > 0,
          createdById: req.user!.id,
          items: {
            create: priced.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              name: line.name as Prisma.InputJsonValue,
              variantName: (line.variantName ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              sku: line.sku,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              quantity: line.quantity,
              quickSold: line.quickSold ?? false,
              discountType: line.discountType,
              discountValue: line.discountValue,
              discountAmount: line.discountAmount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: orderInclude,
      });

      // A counter sale hands the goods over immediately, so stock moves with
      // the order. Online orders wait for PREPARING — see the status route.
      // A quick-sold product was created holding exactly what is leaving, so
      // this same deduction lands it at zero — quick sell adds no second path
      // through stock.
      if (isCounterSale) await deductStock(tx, toStockMovements(priced));

      // ...and the review that the sale owes: "this was sold, complete its
      // details" (spec.md "Quick sell"). Filed in this transaction alongside
      // the product and the order, so the three can never disagree about
      // whether the sale happened. Nothing waits on it — the sale is already
      // complete, which is exactly what makes this request read the opposite
      // way round from every other one.
      const quickSellRequests = [];
      for (const { line, input } of quickSold) {
        quickSellRequests.push(
          await fileChangeRequestInTransaction(tx, req.user!, {
            entityType: CHANGE_REQUEST_ENTITIES.PRODUCT,
            entityId: line.productId!,
            field: CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION,
            // Nothing was there before. An empty old value is what makes the
            // admin card read "sold for X" rather than "from A to B" — there
            // is no previous state to move away from.
            oldValue: quickSellValue(0, {}),
            newValue: quickSellValue(line.unitPrice, {
              sale: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                quantity: line.quantity,
                detail: input.detail?.trim() || null,
              },
            }),
            entityLabel: line.name,
            productLabel: line.name,
            entityDetail: line.sku,
            productId: line.productId,
          })
        );
      }

      return { created: order, quickSellRequests };
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: created.id,
      newValue: serializeOrder(created, Role.ADMIN),
    });

    // The request's own audit entry and push, once the sale has committed —
    // the same pair fileChangeRequest() writes for itself. Deliberately after
    // the transaction: a rolled-back sale must leave neither behind. The audit
    // of WHO quick-sold WHAT at WHAT PRICE is the order's own CREATE entry
    // above, which carries every line's name, price and quickSold flag.
    for (const request of quickSellRequests) {
      await announceFiledChangeRequest(request, req.user!);
    }

    // The shop owner isn't at the counter all day, so a sale made by someone
    // else is pushed to whichever Admin devices have opted in. Deliberately
    // NOT awaited and after the order is committed: a push service being
    // slow or down must never delay a queue at the till, and must never turn
    // a completed sale into an error (failures go to the error-tracking
    // layer instead — see lib/saleNotifications.ts).
    //
    // Gifts are left out: the notification says "new sale — <amount>", and a
    // gift is neither. Only an Admin or a Manager can give stock away, and
    // the audit log holds who did (spec.md "Cash drawer & expenses").
    if (!isGift) scheduleSaleNotification(created, req.user!);

    sendOk(res, serializeOrder(created, req.user!.role), null, 201);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/orders/:id — edit contact details, note, payment method and
// discounts (Admin/Manager only — an Employee must not be able to reprice a
// sale after the fact). Lines themselves are fixed at creation.
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  requirePermission("order.edit"),
  validateBody(updateOrderSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadOrder(req.params.id);
    const body = req.body as UpdateOrderInput;

    if ((UNEDITABLE_ORDER_STATUSES as readonly string[]).includes(existing.status)) {
      throw new AppError(409, ERROR_CODES.ORDER_NOT_EDITABLE);
    }

    // An online order still has to be deliverable to someone once the edit
    // lands — the same invariant the create schema enforces.
    if (isOnlineChannel(existing.channel)) {
      const name = body.customerName === undefined ? existing.customerName : body.customerName;
      const phone = body.customerPhone === undefined ? existing.customerPhone : body.customerPhone;
      if (!name || !phone) throw new AppError(400, ERROR_CODES.ORDER_CUSTOMER_REQUIRED);
    }

    const itemPatches = new Map((body.items ?? []).map((item) => [item.id, item]));
    for (const id of itemPatches.keys()) {
      if (!existing.items.some((item) => item.id === id)) {
        throw new AppError(400, ERROR_CODES.ORDER_ITEM_NOT_FOUND);
      }
    }

    // Lines are re-priced from their own snapshots, never from today's
    // catalogue: a past sale keeps the price it was sold at.
    const repriced = existing.items.map((item) => {
      const patch = itemPatches.get(item.id);
      const discount = patch
        ? { discountType: patch.discountType ?? null, discountValue: patch.discountValue ?? null }
        : { discountType: item.discountType, discountValue: item.discountValue?.toString() ?? null };
      const line = priceLine(item.unitPrice.toString(), item.quantity, discount);
      return { id: item.id, ...discount, ...line };
    });

    const orderDiscount =
      body.discountType === undefined && body.discountValue === undefined
        ? { discountType: existing.discountType, discountValue: existing.discountValue?.toString() ?? null }
        : { discountType: body.discountType ?? null, discountValue: body.discountValue ?? null };

    const totals = computeOrderTotals(
      repriced.map((line) => line.lineTotal),
      orderDiscount
    );

    const updated = await prisma.$transaction(async (tx) => {
      for (const line of repriced) {
        await tx.orderItem.update({
          where: { id: line.id },
          data: {
            discountType: line.discountType,
            discountValue: line.discountValue,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
          },
        });
      }

      return tx.order.update({
        where: { id: existing.id },
        data: {
          paymentMethod: body.paymentMethod,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerWhatsapp: body.customerWhatsapp,
          customerAddress: body.customerAddress,
          customerLatitude: body.customerLatitude,
          customerLongitude: body.customerLongitude,
          note: body.note,
          discountType: orderDiscount.discountType,
          discountValue: orderDiscount.discountValue,
          discountAmount: totals.discountAmount,
          subtotal: totals.subtotal,
          total: totals.total,
        },
        include: orderInclude,
      });
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: updated.id,
      oldValue: serializeOrder(existing, Role.ADMIN),
      newValue: serializeOrder(updated, Role.ADMIN),
    });

    sendOk(res, serializeOrder(updated, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/orders/:id/status — move an order along the flow.
// Employees may advance it (spec.md: they "create + hand over" orders);
// cancelling needs order.cancel, which they don't have, and marking the money
// collected needs order.markCollected, which they don't have either.
// ---------------------------------------------------------------------------
router.patch(
  "/:id/status",
  requirePermission("order.updateStatus"),
  validateBody(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadOrder(req.params.id);
    const target = (req.body as UpdateOrderStatusInput).status;

    // RETURNED is a legal destination (see ORDER_STATUS_TRANSITIONS) but not
    // a settable one: it has to come from POST /:id/return so stock and
    // returnedQuantity move with it.
    if (target === "RETURNED") throw new AppError(400, ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);

    const cancelling = target === "CANCELLED";
    if (cancelling && !can(req.user!, "order.cancel")) throw new AppError(403, ERROR_CODES.FORBIDDEN);

    const allowed = ORDER_STATUS_TRANSITIONS[existing.status as OrderStatus] ?? [];
    if (!allowed.includes(target)) throw new AppError(400, ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);

    // stockDeductedAt is the single source of truth for "has this order taken
    // stock off the shelf" — both branches below key off it, so re-entering a
    // state can never double-deduct or double-restore.
    const deductNow = target === ONLINE_STOCK_DEDUCTION_STATUS && existing.stockDeductedAt === null;
    const restoreNow = cancelling && existing.stockDeductedAt !== null;

    const updated = await prisma.$transaction(async (tx) => {
      if (deductNow) await deductStock(tx, outstandingMovements(existing));
      if (restoreNow) await restoreStock(tx, outstandingMovements(existing));

      return tx.order.update({
        where: { id: existing.id },
        data: {
          status: target,
          ...(deductNow ? { stockDeductedAt: new Date() } : {}),
          ...(restoreNow ? { stockDeductedAt: null } : {}),
        },
        include: orderInclude,
      });
    });

    await writeAudit({
      userId: req.user!.id,
      action: cancelling ? AuditAction.CANCEL : AuditAction.STATUS_CHANGE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: updated.id,
      oldValue: { status: existing.status, stockDeductedAt: existing.stockDeductedAt },
      newValue: { status: updated.status, stockDeductedAt: updated.stockDeductedAt },
    });

    sendOk(res, serializeOrder(updated, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// POST /api/orders/:id/return — return the whole order, or specific lines in
// specific quantities. Admin/Manager only: reversing a sale is exactly what
// spec.md keeps out of an Employee's hands.
// ---------------------------------------------------------------------------
router.post(
  "/:id/return",
  requirePermission("order.return"),
  validateBody(returnOrderSchema),
  asyncHandler(async (req, res) => {
    const existing = await loadOrder(req.params.id);
    const body = req.body as ReturnOrderInput;

    if (!(RETURNABLE_ORDER_STATUSES as readonly string[]).includes(existing.status)) {
      throw new AppError(409, ERROR_CODES.ORDER_NOT_RETURNABLE);
    }

    const itemsById = new Map(existing.items.map((item) => [item.id, item]));

    // No `items` means "all of it" — every line, in whatever quantity is
    // still outstanding.
    const requested = body.items
      ? body.items.map((entry) => {
          const item = itemsById.get(entry.orderItemId);
          if (!item) throw new AppError(400, ERROR_CODES.ORDER_ITEM_NOT_FOUND);
          if (entry.quantity > item.quantity - item.returnedQuantity) {
            throw new AppError(400, ERROR_CODES.ORDER_RETURN_QUANTITY_EXCEEDED);
          }
          return { item, quantity: entry.quantity };
        })
      : existing.items
          .map((item) => ({ item, quantity: item.quantity - item.returnedQuantity }))
          .filter((line) => line.quantity > 0);

    // Nothing left to take back.
    if (requested.length === 0) throw new AppError(409, ERROR_CODES.ORDER_NOT_RETURNABLE);

    const returnedById = new Map<string, number>();
    for (const line of requested) {
      returnedById.set(line.item.id, (returnedById.get(line.item.id) ?? 0) + line.quantity);
    }
    // Two entries for the same line must not add up past what was sold.
    for (const [itemId, quantity] of returnedById) {
      const item = itemsById.get(itemId)!;
      if (quantity > item.quantity - item.returnedQuantity) {
        throw new AppError(400, ERROR_CODES.ORDER_RETURN_QUANTITY_EXCEEDED);
      }
    }

    // Goods only go back on the shelf if they ever left it — an order whose
    // stock was never deducted has nothing to restore.
    const movements = existing.stockDeductedAt
      ? toStockMovements(
          [...returnedById].map(([itemId, quantity]) => ({
            productId: itemsById.get(itemId)!.productId,
            variantId: itemsById.get(itemId)!.variantId,
            quantity,
          }))
        )
      : [];

    // Once every line has come back in full the order itself is RETURNED;
    // a partial return leaves the status alone and just records quantities.
    const fullyReturned = existing.items.every(
      (item) => item.returnedQuantity + (returnedById.get(item.id) ?? 0) >= item.quantity
    );

    const updated = await prisma.$transaction(async (tx) => {
      for (const [itemId, quantity] of returnedById) {
        await tx.orderItem.update({
          where: { id: itemId },
          data: { returnedQuantity: { increment: quantity } },
        });
      }

      if (movements.length) await restoreStock(tx, movements);

      return tx.order.update({
        where: { id: existing.id },
        data: fullyReturned ? { status: "RETURNED", stockDeductedAt: null } : {},
        include: orderInclude,
      });
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.RETURN,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: updated.id,
      oldValue: serializeOrder(existing, Role.ADMIN),
      newValue: {
        ...serializeOrder(updated, Role.ADMIN),
        returned: [...returnedById].map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      },
    });

    sendOk(res, serializeOrder(updated, req.user!.role));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/orders/:id — soft delete, Admin/Manager only. A sale is a
// financial record, so it is hidden rather than destroyed (the same reasoning
// that makes products soft-delete-only, CLAUDE.md rule 4). Anything still
// committed goes back on the shelf as it does on a cancellation.
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("order.delete"),
  asyncHandler(async (req, res) => {
    const existing = await loadOrder(req.params.id);
    const restoreNow = existing.stockDeductedAt !== null;

    const deleted = await prisma.$transaction(async (tx) => {
      if (restoreNow) await restoreStock(tx, outstandingMovements(existing));

      return tx.order.update({
        where: { id: existing.id },
        // stockDeductedAt is cleared along with it: the goods are back on the
        // shelf, so this order no longer holds any.
        data: { deletedAt: new Date(), ...(restoreNow ? { stockDeductedAt: null } : {}) },
      });
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: existing.id,
      oldValue: serializeOrder(existing, Role.ADMIN) as AnyRecord,
      newValue: { deletedAt: deleted.deletedAt, stockDeductedAt: deleted.stockDeductedAt },
    });

    sendOk(res, { id: deleted.id, deletedAt: deleted.deletedAt });
  })
);

export default router;
