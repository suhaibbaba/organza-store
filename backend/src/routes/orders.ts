import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { isOrderCollectable } from "@store/shared/lib/orders";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  collectOrdersSchema,
  resolveMapLinkSchema,
  createOrderSchema,
  customerSuggestionsQuerySchema,
  listOrdersQuerySchema,
  returnOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  type CollectOrdersInput,
  type CreateOrderInput,
  type CustomerSuggestionsQuery,
  type ResolveMapLinkInput,
  type ListOrdersQuery,
  type ReturnOrderInput,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
} from "@/validation/order";
import { asGiftLines, computeOrderTotals, priceLine, priceRequestedItems, toStockMovements } from "@/lib/orderPricing";
import { deductStock, restoreStock } from "@/lib/orderStock";
import { createQuickSoldProduct } from "@/lib/quickSell";
import { queueProductSync } from "@/lib/search";
import { queueMarkedImages } from "@/lib/markedImage";
import { announceFiledChangeRequest, fileChangeRequestInTransaction, quickSellValue } from "@/lib/changeRequests";
import { serializeOrder, serializeOrderSummary } from "@/lib/orderSerialize";
import { MAIN_IMAGE_ONLY } from "@/constants/images";
import { ORDER_SUMMARY_PREVIEW_LINES } from "@/constants/order";
import { queryCollectionSummary, toCollectionSummary, queryOutstandingByOrder } from "@/lib/orderCollection";
import { findCustomerSuggestions } from "@/lib/orderCustomers";
import { resolveMapLink } from "@/lib/mapLink";
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
import type { AnyRecord, CollectResult, OrderStatus, OrderType, PaymentStatus, PricedOrderItem } from "@/types";

// STORE opens COMPLETED with stock out; WHATSAPP/WEBSITE walk NEW → PREPARING → HANDED_TO_COURIER; payment is tracked apart.
const router = Router();
router.use(requireAuth);

const orderInclude = {
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      product: { select: { images: MAIN_IMAGE_ONLY } },
      variant: { select: { images: MAIN_IMAGE_ONLY } },
    },
  },
  // Author's name only — no email, phone or idNumber (rule 19).
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Soft-deleted orders are invisible to every route; only the audit log still holds them.
async function loadOrder(id: string): Promise<OrderWithItems> {
  const order = await prisma.order.findFirst({ where: { id, deletedAt: null }, include: orderInclude });
  if (!order) {
    throw new AppError(404, ERROR_CODES.ORDER_NOT_FOUND);
  }
  return order;
}

// Only what serializeOrderSummary sends: the list never needs the address, note or coordinates.
const ORDER_SUMMARY_COLUMNS = {
  id: true,
  orderNumber: true,
  channel: true,
  type: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  collectedAt: true,
  customerName: true,
  customerPhone: true,
  subtotal: true,
  discountAmount: true,
  total: true,
  hasQuickSale: true,
  stockDeductedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

// Row-locks the order for this transaction, so two staff acting at once can never move its stock twice.
async function lockOrder(tx: Prisma.TransactionClient, id: string): Promise<OrderWithItems> {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { id, deletedAt: null }, include: orderInclude });
  if (!order) {
    throw new AppError(404, ERROR_CODES.ORDER_NOT_FOUND);
  }
  return order;
}

// What is still with the customer per line: what a cancellation puts back and a return can still take.
function outstandingMovements(order: OrderWithItems) {
  return toStockMovements(
    order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity - item.returnedQuantity,
    })),
  );
}

function isOnlineChannel(channel: string): boolean {
  return (ONLINE_ORDER_CHANNELS as readonly string[]).includes(channel);
}

// GET /api/orders — list (pagination + filtering + sorting)
router.get(
  "/",
  requirePermission("order.view"),
  validateQuery(listOrdersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListOrdersQuery;
    const where: Prisma.OrderWhereInput = { deletedAt: null };

    if (query.status) {
      where.status = query.status;
    }
    if (query.channel) {
      where.channel = query.channel;
    }
    // Unset lists sales and gifts alike: everything that left the shop.
    if (query.type) {
      where.type = query.type;
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }
    // Quick sell's review list (spec.md "Quick sell"); unset lists everything.
    if (query.hasQuickSale) {
      where.hasQuickSale = true;
    }

    // A cancelled or fully returned sale owes nothing and must not pad the outstanding-money list.
    if (query.collectableOnly) {
      const collectable = [...COLLECTABLE_ORDER_STATUSES] as OrderStatus[];
      // With an explicit status the two intersect, so a non-collectable status matches nothing.
      where.status = { in: query.status ? collectable.filter((s) => s === query.status) : collectable };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      };
    }

    // orderNumber is 32-bit, so a longer run of digits (a phone) is matched as text only.
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
        select: {
          ...ORDER_SUMMARY_COLUMNS,
          _count: { select: { items: true } },
          items: {
            orderBy: [{ unitPrice: "desc" }, { createdAt: "asc" }],
            take: ORDER_SUMMARY_PREVIEW_LINES,
            select: {
              id: true,
              name: true,
              variantName: true,
              quantity: true,
              product: { select: { images: MAIN_IMAGE_ONLY } },
              variant: { select: { images: MAIN_IMAGE_ONLY } },
            },
          },
        },
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const outstanding = await queryOutstandingByOrder(
      orders.filter((order) => order.paymentStatus === "PENDING_COLLECTION").map((order) => order.id),
    );

    sendOk(
      res,
      orders.map((order) => serializeOrderSummary(order, outstanding)),
      {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    );
  }),
);

// GET /api/orders/collection-summary — a shop-wide money total, so gated on order.markCollected, never order.view (rule 19).
router.get(
  "/collection-summary",
  requirePermission("order.markCollected"),
  asyncHandler(async (_req, res) => {
    sendOk(res, toCollectionSummary(await queryCollectionSummary()));
  }),
);

// GET /api/orders/customer-suggestions — repeat customers by phone digits; declared before /:id so the path isn't read as an id.
router.get(
  "/customer-suggestions",
  requirePermission("order.view"),
  validateQuery(customerSuggestionsQuerySchema),
  asyncHandler(async (req, res) => {
    const { q } = req.validatedQuery as CustomerSuggestionsQuery;
    sendOk(res, await findCustomerSuggestions(q));
  }),
);

// POST /api/orders/map-link — reads the point out of a pasted Google Maps link; writes nothing.
router.post(
  "/map-link",
  requirePermission("order.create"),
  validateBody(resolveMapLinkSchema),
  asyncHandler(async (req, res) => {
    const { url } = req.body as ResolveMapLinkInput;
    const point = await resolveMapLink(url);
    if (!point) {
      throw new AppError(400, ERROR_CODES.ORDER_LOCATION_LINK_INVALID);
    }
    sendOk(res, point);
  }),
);

// POST /api/orders/collect — an Employee may take a sale but never declare its money received.
router.post(
  "/collect",
  requirePermission("order.markCollected"),
  validateBody(collectOrdersSchema),
  asyncHandler(async (req, res) => {
    const { orderIds } = req.body as CollectOrdersInput;
    const ids = [...new Set(orderIds)];

    const collectedAt = new Date();

    // Rows are locked first, so two people collecting the same orders at once record each payment only once.
    const { orders, pending } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const orders = await tx.order.findMany({ where: { id: { in: ids }, deletedAt: null } });
      const found = new Set(orders.map((order) => order.id));
      if (ids.some((id) => !found.has(id))) {
        throw new AppError(404, ERROR_CODES.ORDER_NOT_FOUND);
      }

      // A cancelled or fully returned sale has no money on it to collect.
      if (orders.some((order) => !isOrderCollectable(order.status))) {
        throw new AppError(409, ERROR_CODES.ORDER_NOT_COLLECTABLE);
      }

      const pending = orders.filter((order) => order.paymentStatus === "PENDING_COLLECTION");
      if (pending.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: pending.map((order) => order.id) }, paymentStatus: "PENDING_COLLECTION" },
          data: { paymentStatus: "COLLECTED" as PaymentStatus, collectedAt },
        });
      }
      return { orders, pending };
    });

    // One audit entry per order, so "who said order 412 was paid" is answerable on its own (rule 6).
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
      alreadyCollectedIds: orders.filter((order) => order.paymentStatus === "COLLECTED").map((order) => order.id),
      collectedAt: collectedAt.toISOString(),
    };

    sendOk(res, result);
  }),
);

// GET /api/orders/:id — detail
router.get(
  "/:id",
  requirePermission("order.view"),
  asyncHandler(async (req, res) => {
    const order = await loadOrder(req.params.id);
    sendOk(res, serializeOrder(order, req.user!.role));
  }),
);

// POST /api/orders — create (an Employee may ring up a sale, just not undo one)
router.post(
  "/",
  requirePermission("order.create"),
  validateBody(createOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateOrderInput;

    // An Employee may not give stock away: filing a sale as a gift would let a piece walk out.
    const isGift = body.type === GIFT_ORDER_TYPE;
    if (isGift && !can(req.user!, "order.createGift")) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }

    // Quick sell needs its permission and is refused on a gift: an unrecorded piece given away leaves no trace.
    const quickSellCount = body.items.filter((item) => item.quickSell).length;
    if (quickSellCount > 0) {
      if (!can(req.user!, "product.quickSell")) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN);
      }
      if (isGift) {
        throw new AppError(400, ERROR_CODES.ORDER_ITEM_SOURCE_INVALID);
      }
    }

    // Catalogue lines are priced here; quick-sold lines are priced in the transaction where their product is created.
    const catalogue = await priceRequestedItems(
      body.items.filter((item) => item.productId).map((item) => ({ ...item, productId: item.productId! })),
    );

    // A counter sale (and a gift) opens finished, takes stock at once and has its money in the till.
    const isCounterSale = body.channel === "STORE";
    // A gift owes the shop nothing on any channel, so it never waits in the collection queue.
    const isSettled = isCounterSale || isGift;
    const now = new Date();

    const { created, quickSellRequests } = await prisma.$transaction(async (tx) => {
      // A quick-sold product is created inside this transaction, so a failed sale never leaves a half-made product.
      const quickSold: { line: PricedOrderItem; input: NonNullable<CreateOrderInput["items"][number]["quickSell"]> }[] =
        [];
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
          {
            quickSell: item.quickSell,
            quantity: item.quantity,
            discountType: item.discountType,
            discountValue: item.discountValue,
          },
          req.user!,
          now,
        );
        lines.push(product.line);
        quickSold.push({ line: product.line, input: item.quickSell });
      }

      // A gift re-prices every line at zero; only unitCost survives, as what the shop lost.
      const priced = isGift ? asGiftLines(lines) : lines;
      const totals = computeOrderTotals(
        priced.map((line) => line.lineTotal),
        // A gift's order-level discount is dropped rather than applied to a zero subtotal.
        isGift ? {} : body,
      );

      const order = await tx.order.create({
        data: {
          channel: body.channel,
          type: body.type as OrderType,
          status: (isCounterSale ? STORE_ORDER_INITIAL_STATUS : ONLINE_ORDER_INITIAL_STATUS) as OrderStatus,
          paymentMethod: body.paymentMethod,
          // A courier order is not paid until the delivery company settles up (spec.md "Payment collection").
          paymentStatus: (isSettled
            ? STORE_ORDER_INITIAL_PAYMENT_STATUS
            : ONLINE_ORDER_INITIAL_PAYMENT_STATUS) as PaymentStatus,
          collectedAt: isSettled ? now : null,
          customerName: body.customerName ?? null,
          customerPhone: body.customerPhone ?? null,
          customerWhatsapp: body.customerWhatsapp ?? null,
          customerAddress: body.customerAddress ?? null,
          customerLatitude: body.customerLatitude ?? null,
          customerLongitude: body.customerLongitude ?? null,
          note: body.note ?? null,
          subtotal: totals.subtotal,
          discountType: isGift ? null : (body.discountType ?? null),
          discountValue: isGift ? null : (body.discountValue ?? null),
          discountAmount: totals.discountAmount,
          total: totals.total,
          stockDeductedAt: isCounterSale ? now : null,
          // Kept on the sale so it outlives the product's completion and the list can filter on it.
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

      // A counter sale deducts now (a quick-sold product lands at zero); online orders wait for PREPARING.
      if (isCounterSale) {
        await deductStock(tx, toStockMovements(priced));
      }

      // The completion request is filed in the same transaction, so product, order and request never disagree.
      const quickSellRequests = [];
      for (const { line, input } of quickSold) {
        quickSellRequests.push(
          await fileChangeRequestInTransaction(tx, req.user!, {
            entityType: CHANGE_REQUEST_ENTITIES.PRODUCT,
            entityId: line.productId!,
            field: CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION,
            // An empty old value makes the admin card read "sold for X" rather than "from A to B".
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
          }),
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
    // Stock moved and quick-sold pieces were created; batched, so the till never waits on search.
    queueProductSync(created.items.map((item) => item.productId));
    queueMarkedImages(created.items.map((item) => item.productId));

    // After commit, so a rolled-back sale leaves neither the request's audit entry nor its push behind.
    for (const request of quickSellRequests) {
      await announceFiledChangeRequest(request, req.user!);
    }

    // Never awaited and after commit, so a slow push service can't delay the till; gifts are not "new sale" pushes.
    if (!isGift) {
      scheduleSaleNotification(created, req.user!);
    }

    sendOk(res, serializeOrder(created, req.user!.role), null, 201);
  }),
);

// PATCH /api/orders/:id — contact, note, payment method and discounts (Admin/Manager); lines are fixed at creation.
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

    // An online order must still be deliverable to someone, as the create schema enforces.
    if (isOnlineChannel(existing.channel)) {
      const name = body.customerName === undefined ? existing.customerName : body.customerName;
      const phone = body.customerPhone === undefined ? existing.customerPhone : body.customerPhone;
      if (!name || !phone) {
        throw new AppError(400, ERROR_CODES.ORDER_CUSTOMER_REQUIRED);
      }
    }

    const itemPatches = new Map((body.items ?? []).map((item) => [item.id, item]));
    for (const id of itemPatches.keys()) {
      if (!existing.items.some((item) => item.id === id)) {
        throw new AppError(400, ERROR_CODES.ORDER_ITEM_NOT_FOUND);
      }
    }

    // Re-priced from the line snapshots, never today's catalogue: a past sale keeps its price.
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
      orderDiscount,
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
  }),
);

// PATCH /api/orders/:id/status — Employees may advance; cancelling needs order.cancel.
router.patch(
  "/:id/status",
  requirePermission("order.updateStatus"),
  validateBody(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const target = (req.body as UpdateOrderStatusInput).status;

    // RETURNED only comes from POST /:id/return, so stock and returnedQuantity move with it.
    if (target === "RETURNED") {
      throw new AppError(400, ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);
    }

    const cancelling = target === "CANCELLED";
    if (cancelling && !can(req.user!, "order.cancel")) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }

    const { existing, updated } = await prisma.$transaction(async (tx) => {
      const existing = await lockOrder(tx, req.params.id);

      const allowed = ORDER_STATUS_TRANSITIONS[existing.status as OrderStatus] ?? [];
      if (!allowed.includes(target)) {
        throw new AppError(400, ERROR_CODES.ORDER_INVALID_STATUS_TRANSITION);
      }

      // stockDeductedAt is the one source of truth, so re-entering a state never double-deducts or double-restores.
      const deductNow = target === ONLINE_STOCK_DEDUCTION_STATUS && existing.stockDeductedAt === null;
      const restoreNow = cancelling && existing.stockDeductedAt !== null;

      if (deductNow) {
        await deductStock(tx, outstandingMovements(existing));
      }
      if (restoreNow) {
        await restoreStock(tx, outstandingMovements(existing));
      }

      const updated = await tx.order.update({
        where: { id: existing.id },
        data: {
          status: target,
          ...(deductNow ? { stockDeductedAt: new Date() } : {}),
          ...(restoreNow ? { stockDeductedAt: null } : {}),
        },
        include: orderInclude,
      });
      return { existing, updated };
    });

    await writeAudit({
      userId: req.user!.id,
      action: cancelling ? AuditAction.CANCEL : AuditAction.STATUS_CHANGE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: updated.id,
      oldValue: { status: existing.status, stockDeductedAt: existing.stockDeductedAt },
      newValue: { status: updated.status, stockDeductedAt: updated.stockDeductedAt },
    });
    queueProductSync(existing.items.map((item) => item.productId));
    queueMarkedImages(existing.items.map((item) => item.productId));

    sendOk(res, serializeOrder(updated, req.user!.role));
  }),
);

// POST /api/orders/:id/return — whole order or specific lines; Admin/Manager only.
router.post(
  "/:id/return",
  requirePermission("order.return"),
  validateBody(returnOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as ReturnOrderInput;

    const { existing, updated, returnedById } = await prisma.$transaction(async (tx) => {
      const existing = await lockOrder(tx, req.params.id);

      if (!(RETURNABLE_ORDER_STATUSES as readonly string[]).includes(existing.status)) {
        throw new AppError(409, ERROR_CODES.ORDER_NOT_RETURNABLE);
      }

      const itemsById = new Map(existing.items.map((item) => [item.id, item]));

      // No items = every line, in whatever quantity is still outstanding.
      const requested = body.items
        ? body.items.map((entry) => {
            const item = itemsById.get(entry.orderItemId);
            if (!item) {
              throw new AppError(400, ERROR_CODES.ORDER_ITEM_NOT_FOUND);
            }
            if (entry.quantity > item.quantity - item.returnedQuantity) {
              throw new AppError(400, ERROR_CODES.ORDER_RETURN_QUANTITY_EXCEEDED);
            }
            return { item, quantity: entry.quantity };
          })
        : existing.items
            .map((item) => ({ item, quantity: item.quantity - item.returnedQuantity }))
            .filter((line) => line.quantity > 0);

      // Nothing left to take back.
      if (requested.length === 0) {
        throw new AppError(409, ERROR_CODES.ORDER_NOT_RETURNABLE);
      }

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

      // Only goods that left the shelf go back on it.
      const movements = existing.stockDeductedAt
        ? toStockMovements(
            [...returnedById].map(([itemId, quantity]) => ({
              productId: itemsById.get(itemId)!.productId,
              variantId: itemsById.get(itemId)!.variantId,
              quantity,
            })),
          )
        : [];

      // Every line back in full makes the order RETURNED; a partial return only records quantities.
      const fullyReturned = existing.items.every(
        (item) => item.returnedQuantity + (returnedById.get(item.id) ?? 0) >= item.quantity,
      );

      for (const [itemId, quantity] of returnedById) {
        await tx.orderItem.update({
          where: { id: itemId },
          data: { returnedQuantity: { increment: quantity } },
        });
      }

      if (movements.length) {
        await restoreStock(tx, movements);
      }

      const updated = await tx.order.update({
        where: { id: existing.id },
        data: fullyReturned ? { status: "RETURNED", stockDeductedAt: null } : {},
        include: orderInclude,
      });
      return { existing, updated, returnedById };
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
    queueProductSync(existing.items.map((item) => item.productId));
    queueMarkedImages(existing.items.map((item) => item.productId));

    sendOk(res, serializeOrder(updated, req.user!.role));
  }),
);

// DELETE /api/orders/:id — soft delete (a financial record); committed stock goes back as on a cancellation.
router.delete(
  "/:id",
  requirePermission("order.delete"),
  asyncHandler(async (req, res) => {
    const { existing, deleted } = await prisma.$transaction(async (tx) => {
      const existing = await lockOrder(tx, req.params.id);
      const restoreNow = existing.stockDeductedAt !== null;
      if (restoreNow) {
        await restoreStock(tx, outstandingMovements(existing));
      }

      const deleted = await tx.order.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), ...(restoreNow ? { stockDeductedAt: null } : {}) },
      });
      return { existing, deleted };
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: existing.id,
      oldValue: serializeOrder(existing, Role.ADMIN) as AnyRecord,
      newValue: { deletedAt: deleted.deletedAt, stockDeductedAt: deleted.stockDeductedAt },
    });
    queueProductSync(existing.items.map((item) => item.productId));
    queueMarkedImages(existing.items.map((item) => item.productId));

    sendOk(res, { id: deleted.id, deletedAt: deleted.deletedAt });
  }),
);

export default router;
