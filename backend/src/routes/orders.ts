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
  exchangeOrderSchema,
  exchangePreviewSchema,
  listOrdersQuerySchema,
  returnOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  type CollectOrdersInput,
  type CreateOrderInput,
  type CustomerSuggestionsQuery,
  type ExchangeOrderInput,
  type ExchangePreviewInput,
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
import { scheduleExchangeNotification } from "@/lib/exchangeNotifications";
import {
  assertExchangeable,
  exchangeCashMovement,
  exchangeCredit,
  isPaymentTracked,
  resolveReturnLines,
  resolveSettlement,
} from "@/lib/orderExchange";
import { writeAudit } from "@/lib/audit";
import { orderBalance, reconcileCredit, recordOrderPayment, type CreditReconciled } from "@/lib/orderCredit";
import { ensureCustomerForOrder } from "@/lib/customers";
import { money, roundMoney, ZERO_MONEY } from "@/lib/money";
import {
  handOverItemsSchema,
  recordPaymentSchema,
  type HandOverItemsInput,
  type RecordPaymentInput,
} from "@/validation/customer";
import {
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  EXCHANGE_PAYMENT_METHOD,
  CHANGE_REQUEST_FIELDS,
  COLLECTABLE_ORDER_STATUSES,
  ERROR_CODES,
  GIFT_ORDER_TYPE,
  MAX_INT32,
  MONEY_DECIMAL_PLACES,
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
      handedOverBy: { select: { id: true, name: true } },
    },
  },
  payments: {
    orderBy: [{ receivedAt: "asc" as const }, { id: "asc" as const }],
    include: { receivedBy: { select: { id: true, name: true } } },
  },
  // Author's name only — no email, phone or idNumber (rule 19).
  createdBy: { select: { id: true, name: true } },
  exchangeOf: { select: { id: true, orderNumber: true, createdAt: true } },
  exchanges: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" as const },
    select: { id: true, orderNumber: true, createdAt: true },
  },
} satisfies Prisma.OrderInclude;

// A refund paid back after a cancel, return, delete or re-discount is audited on its own, like any money out of the till.
async function auditRefund(userId: string, orderId: string, reconciled: CreditReconciled | null) {
  if (!reconciled?.refund) {
    return;
  }
  await writeAudit({
    userId,
    action: AuditAction.PAYMENT_REFUNDED,
    entityType: AUDIT_ENTITY.ORDER,
    entityId: orderId,
    newValue: { amount: reconciled.refund.toFixed(MONEY_DECIMAL_PLACES), paymentStatus: reconciled.paymentStatus },
  });
}

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
  customerId: true,
  onCredit: true,
  paidAmount: true,
  subtotal: true,
  discountAmount: true,
  total: true,
  hasQuickSale: true,
  exchangeOfOrderId: true,
  exchangeSettlement: true,
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
    if (query.isExchange) {
      where.exchangeOfOrderId = { not: null };
    }
    // The till finds the sale a piece came from by the code on its label.
    if (query.itemCode) {
      const code = query.itemCode;
      where.items = {
        some: { OR: [{ sku: code }, { product: { barcode: code } }, { variant: { barcode: code } }] },
      };
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

    // A credit sale needs its own permission and a real customer, whose details become the order's snapshot.
    const onCredit = body.onCredit === true;
    if (onCredit && !can(req.user!, "order.sellOnCredit")) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }
    // A counter credit sale names its Customer row; an online one is found or created from its phone below.
    const creditCustomer =
      onCredit && body.customerId ? await prisma.customer.findUnique({ where: { id: body.customerId } }) : null;
    if (onCredit && body.customerId && !creditCustomer) {
      throw new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND);
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

      // A credit sale may be paid in part now; never more than it costs.
      const paidNow = onCredit ? roundMoney(money(body.paidNow ?? 0)) : ZERO_MONEY();
      if (paidNow.greaterThan(totals.total)) {
        throw new AppError(400, ERROR_CODES.ORDER_PAYMENT_EXCEEDS_BALANCE);
      }
      const creditSettled = onCredit && paidNow.greaterThanOrEqualTo(totals.total);

      // A WhatsApp order finds or creates its customer by phone, so their orders gather on one page.
      const customer = creditCustomer
        ? creditCustomer
        : isOnlineChannel(body.channel) && body.customerName && body.customerPhone
          ? await ensureCustomerForOrder(
              tx,
              {
                name: body.customerName,
                phone: body.customerPhone,
                whatsapp: body.customerWhatsapp,
                address: body.customerAddress,
                latitude: body.customerLatitude,
                longitude: body.customerLongitude,
              },
              req.user!.id,
            )
          : null;

      const order = await tx.order.create({
        data: {
          channel: body.channel,
          type: body.type as OrderType,
          status: (isCounterSale ? STORE_ORDER_INITIAL_STATUS : ONLINE_ORDER_INITIAL_STATUS) as OrderStatus,
          paymentMethod: body.paymentMethod,
          // A courier order is not paid until the delivery company settles up (spec.md "Payment collection").
          paymentStatus: (onCredit
            ? creditSettled
              ? "COLLECTED"
              : "ON_CREDIT"
            : isSettled
              ? STORE_ORDER_INITIAL_PAYMENT_STATUS
              : ONLINE_ORDER_INITIAL_PAYMENT_STATUS) as PaymentStatus,
          collectedAt: onCredit ? (creditSettled ? now : null) : isSettled ? now : null,
          customerName: creditCustomer?.name ?? body.customerName ?? null,
          customerPhone: creditCustomer?.phone ?? body.customerPhone ?? null,
          customerWhatsapp: creditCustomer ? creditCustomer.whatsapp : (body.customerWhatsapp ?? null),
          customerAddress: creditCustomer ? creditCustomer.address : (body.customerAddress ?? null),
          customerLatitude: creditCustomer ? creditCustomer.latitude : (body.customerLatitude ?? null),
          customerLongitude: creditCustomer ? creditCustomer.longitude : (body.customerLongitude ?? null),
          customerId: customer?.id ?? null,
          onCredit,
          paidAmount: paidNow,
          ...(paidNow.greaterThan(0)
            ? { payments: { create: { amount: paidNow, receivedById: req.user!.id, receivedAt: now } } }
            : {}),
          note: body.note ?? null,
          subtotal: totals.subtotal,
          discountType: isGift ? null : (body.discountType ?? null),
          discountValue: isGift ? null : (body.discountValue ?? null),
          discountAmount: totals.discountAmount,
          total: totals.total,
          // A credit sale is sold the moment it is made, on any channel, so its stock goes now too.
          stockDeductedAt: isCounterSale || onCredit ? now : null,
          // Kept on the sale so it outlives the product's completion and the list can filter on it.
          hasQuickSale: quickSold.length > 0,
          createdById: req.user!.id,
          items: {
            create: priced.map((line, index) => ({
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
              // A counter or credit sale's piece leaves (by hand or courier) unless kept in the shop; a plain courier parcel never asks.
              ...((isCounterSale || onCredit) && !(onCredit && body.items[index]?.keptInShop)
                ? { handedOverAt: now, handedOverById: req.user!.id }
                : {}),
            })),
          },
        },
        include: orderInclude,
      });

      // A counter sale deducts now (a quick-sold product lands at zero); online orders wait for PREPARING.
      if (isCounterSale || onCredit) {
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
    // An exchange's money is fixed by what came back; re-pricing either side would break what was carried over.
    const repricing = body.items !== undefined || body.discountType !== undefined || body.discountValue !== undefined;
    if (repricing && (existing.exchangeOfOrderId || existing.exchanges.length > 0)) {
      throw new AppError(409, ERROR_CODES.ORDER_HAS_EXCHANGES);
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

    const { updated, reconciled } = await prisma.$transaction(async (tx) => {
      // Locked, so a payment taken at the same moment cannot slip past the re-priced balance.
      await lockOrder(tx, existing.id);
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

      await tx.order.update({
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
      });
      // A new discount changes what a credit sale owes: anything paid beyond it goes back.
      const reconciled = await reconcileCredit(tx, existing.id, req.user!.id);
      const updated = await tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: orderInclude });
      return { updated, reconciled };
    });
    await auditRefund(req.user!.id, updated.id, reconciled);

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

    const { existing, updated, reconciled } = await prisma.$transaction(async (tx) => {
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

      await tx.order.update({
        where: { id: existing.id },
        data: {
          status: target,
          ...(deductNow ? { stockDeductedAt: new Date() } : {}),
          ...(restoreNow ? { stockDeductedAt: null } : {}),
        },
      });
      const reconciled = cancelling ? await reconcileCredit(tx, existing.id, req.user!.id) : null;
      const updated = await tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: orderInclude });
      return { existing, updated, reconciled };
    });
    await auditRefund(req.user!.id, updated.id, reconciled);

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

    const { existing, updated, returnedById, reconciled } = await prisma.$transaction(async (tx) => {
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

      await tx.order.update({
        where: { id: existing.id },
        data: fullyReturned ? { status: "RETURNED", stockDeductedAt: null } : {},
      });
      // What came back is no longer owed; if more was paid than what is kept, the difference is paid back.
      const reconciled = await reconcileCredit(tx, existing.id, req.user!.id);
      const updated = await tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: orderInclude });
      return { existing, updated, returnedById, reconciled };
    });
    await auditRefund(req.user!.id, updated.id, reconciled);

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

// POST /api/orders/:id/exchange/preview — what the chosen pieces would carry over; writes nothing.
router.post(
  "/:id/exchange/preview",
  requirePermission("order.exchange"),
  validateBody(exchangePreviewSchema),
  asyncHandler(async (req, res) => {
    const { returnItems } = req.body as ExchangePreviewInput;
    const order = await loadOrder(req.params.id);
    assertExchangeable(order);
    const credit = exchangeCredit(order, resolveReturnLines(order.items, returnItems));
    sendOk(res, { credit: credit.toFixed(MONEY_DECIMAL_PLACES) });
  }),
);

// POST /api/orders/:id/exchange — pieces back onto the shelf, new pieces out as their own sale, the difference settled; every role.
router.post(
  "/:id/exchange",
  requirePermission("order.exchange"),
  validateBody(exchangeOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as ExchangeOrderInput;
    const user = req.user!;

    // Priced before the transaction, from today's catalogue, exactly as a sale is.
    const lines = await priceRequestedItems(body.items.map((item) => ({ ...item, productId: item.productId! })));
    const requested = computeOrderTotals(
      lines.map((line) => line.lineTotal),
      body,
    );

    const { original, created, difference, settlement } = await prisma.$transaction(async (tx) => {
      const original = await lockOrder(tx, req.params.id);
      assertExchangeable(original);

      const returned = resolveReturnLines(original.items, body.returnItems);
      const credit = exchangeCredit(original, returned);
      const difference = roundMoney(money(requested.total).sub(credit));
      const settlement = resolveSettlement(difference, body.settlement);

      // Owing the difference is a credit sale, so it needs that permission and somebody to owe it.
      const onCredit = settlement === "DEBT";
      if (onCredit && !can(user, "order.sellOnCredit")) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN);
      }
      // The exchange stays with the original sale's customer unless another is named.
      const customerId = body.customerId ?? original.customerId;
      const customer = customerId ? await tx.customer.findUnique({ where: { id: customerId } }) : null;
      if (customerId && !customer) {
        throw new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND);
      }
      if (onCredit && !customer) {
        throw new AppError(400, ERROR_CODES.ORDER_EXCHANGE_CUSTOMER_REQUIRED);
      }

      // --- the pieces coming back: on the shelf again, recorded as returned and as exchanged ---
      for (const [itemId, quantity] of returned) {
        await tx.orderItem.update({
          where: { id: itemId },
          data: { returnedQuantity: { increment: quantity }, exchangedQuantity: { increment: quantity } },
        });
      }
      const itemsById = new Map(original.items.map((item) => [item.id, item]));
      if (original.stockDeductedAt) {
        await restoreStock(
          tx,
          toStockMovements(
            [...returned].map(([itemId, quantity]) => ({
              productId: itemsById.get(itemId)!.productId,
              variantId: itemsById.get(itemId)!.variantId,
              quantity,
            })),
          ),
        );
      }
      const fullyReturned = original.items.every(
        (item) => item.returnedQuantity + (returned.get(item.id) ?? 0) >= item.quantity,
      );
      // An account's credit leaves it as an EXCHANGE payment, never as cash out of the drawer.
      if (isPaymentTracked(original) && credit.greaterThan(0)) {
        await tx.orderPayment.create({
          data: {
            orderId: original.id,
            amount: credit.negated(),
            method: EXCHANGE_PAYMENT_METHOD,
            receivedById: user.id,
            receivedAt: new Date(),
          },
        });
      }
      await tx.order.update({
        where: { id: original.id },
        data: {
          ...(fullyReturned ? { status: "RETURNED", stockDeductedAt: null } : {}),
          ...(isPaymentTracked(original) && credit.greaterThan(0)
            ? { paidAmount: roundMoney(original.paidAmount.sub(credit)) }
            : {}),
        },
      });
      // Re-settles the account (what is still owed on it); the credit already left, so nothing is paid back here.
      await reconcileCredit(tx, original.id, user.id);

      // --- the new pieces: their own sale, paid first with what came back ---
      const waived = settlement === "WAIVED";
      const totals = waived
        ? computeOrderTotals(
            lines.map((line) => line.lineTotal),
            { discountType: "AMOUNT", discountValue: roundMoney(money(requested.subtotal).sub(credit)).toFixed(2) },
          )
        : requested;
      const kept = settlement === "KEPT" ? difference.negated() : ZERO_MONEY();
      const total = roundMoney(money(totals.total).add(kept));
      const cash = exchangeCashMovement(difference, settlement);
      const paid = roundMoney(credit.add(cash));
      const now = new Date();

      const payments = [
        ...(credit.greaterThan(0) ? [{ amount: credit, method: EXCHANGE_PAYMENT_METHOD }] : []),
        ...(!cash.isZero() ? [{ amount: cash, method: "CASH" }] : []),
      ];

      const created = await tx.order.create({
        data: {
          channel: "STORE",
          type: "SALE",
          status: STORE_ORDER_INITIAL_STATUS as OrderStatus,
          paymentMethod: "CASH",
          paymentStatus: (onCredit ? "ON_CREDIT" : "COLLECTED") as PaymentStatus,
          collectedAt: onCredit ? null : now,
          customerName: customer?.name ?? original.customerName,
          customerPhone: customer?.phone ?? original.customerPhone,
          customerWhatsapp: customer ? customer.whatsapp : original.customerWhatsapp,
          customerAddress: customer ? customer.address : original.customerAddress,
          customerLatitude: customer ? customer.latitude : original.customerLatitude,
          customerLongitude: customer ? customer.longitude : original.customerLongitude,
          customerId: customer?.id ?? null,
          onCredit,
          paidAmount: paid,
          ...(payments.length
            ? {
                payments: {
                  create: payments.map((payment) => ({
                    amount: payment.amount,
                    method: payment.method as "CASH" | "EXCHANGE",
                    receivedById: user.id,
                    receivedAt: now,
                  })),
                },
              }
            : {}),
          note: body.note ?? null,
          subtotal: totals.subtotal,
          discountType: waived ? "AMOUNT" : (body.discountType ?? null),
          discountValue: waived ? totals.discountAmount : (body.discountValue ?? null),
          discountAmount: totals.discountAmount,
          total,
          stockDeductedAt: now,
          exchangeOfOrderId: original.id,
          exchangeCredit: credit,
          exchangeKept: kept,
          exchangeSettlement: settlement,
          createdById: user.id,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              name: line.name as Prisma.InputJsonValue,
              variantName: (line.variantName ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              sku: line.sku,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              quantity: line.quantity,
              discountType: line.discountType,
              discountValue: line.discountValue,
              discountAmount: line.discountAmount,
              lineTotal: line.lineTotal,
              handedOverAt: now,
              handedOverById: user.id,
            })),
          },
        },
        include: orderInclude,
      });
      await deductStock(tx, toStockMovements(lines));

      return { original, created, difference, settlement };
    });

    await writeAudit({
      userId: user.id,
      action: AuditAction.EXCHANGE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: original.id,
      oldValue: serializeOrder(original, Role.ADMIN),
      newValue: {
        exchangeOrderId: created.id,
        returned: body.returnItems,
      },
    });
    await writeAudit({
      userId: user.id,
      action: AuditAction.EXCHANGE,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: created.id,
      newValue: { ...serializeOrder(created, Role.ADMIN), difference: difference.toFixed(MONEY_DECIMAL_PLACES) },
    });
    const productIds = [...original.items, ...created.items].map((item) => item.productId);
    queueProductSync(productIds);
    queueMarkedImages(productIds);

    // Never awaited: the alert can't hold up the till, and a failed push never undoes an exchange.
    scheduleExchangeNotification(
      {
        orderId: created.id,
        orderNumber: created.orderNumber,
        originalOrderNumber: original.orderNumber,
        difference: difference.toFixed(MONEY_DECIMAL_PLACES),
        settlement,
        staffName: created.createdBy?.name ?? "",
      },
      user,
    );

    sendOk(res, serializeOrder(created, user.role), null, 201);
  }),
);

// POST /api/orders/:id/payments — money taken on a credit sale; never more than it still owes.
router.post(
  "/:id/payments",
  requirePermission("order.recordPayment"),
  validateBody(recordPaymentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as RecordPaymentInput;
    const { recorded, updated } = await prisma.$transaction(async (tx) => {
      const existing = await lockOrder(tx, req.params.id);
      const recorded = await recordOrderPayment(tx, existing, {
        amount: money(body.amount),
        note: body.note,
        userId: req.user!.id,
        at: new Date(),
      });
      const updated = await tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: orderInclude });
      return { recorded, updated };
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.PAYMENT_RECEIVED,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: updated.id,
      oldValue: { balance: recorded.balanceBefore.toFixed(MONEY_DECIMAL_PLACES) },
      newValue: {
        paymentId: recorded.paymentId,
        amount: recorded.amount.toFixed(MONEY_DECIMAL_PLACES),
        balance: recorded.balanceAfter.toFixed(MONEY_DECIMAL_PLACES),
        paymentStatus: recorded.paymentStatus,
      },
    });

    sendOk(res, serializeOrder(updated, req.user!.role), null, 201);
  }),
);

// POST /api/orders/:id/handover — pieces of a credit sale kept in the shop are collected by the customer.
router.post(
  "/:id/handover",
  requirePermission("order.markHandedOver"),
  validateBody(handOverItemsSchema),
  asyncHandler(async (req, res) => {
    const ids = [...new Set((req.body as HandOverItemsInput).itemIds)];
    const at = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await lockOrder(tx, req.params.id);
      if (!existing.onCredit || existing.status === "CANCELLED") {
        throw new AppError(409, ERROR_CODES.ORDER_NOT_ON_CREDIT);
      }
      const byId = new Map(existing.items.map((item) => [item.id, item]));
      for (const id of ids) {
        const item = byId.get(id);
        if (!item) {
          throw new AppError(400, ERROR_CODES.ORDER_ITEM_NOT_FOUND);
        }
        if (item.handedOverAt) {
          throw new AppError(409, ERROR_CODES.ORDER_ALREADY_HANDED_OVER);
        }
      }
      await tx.orderItem.updateMany({
        where: { id: { in: ids }, orderId: existing.id, handedOverAt: null },
        data: { handedOverAt: at, handedOverById: req.user!.id },
      });
      return tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: orderInclude });
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.HANDED_OVER,
      entityType: AUDIT_ENTITY.ORDER,
      entityId: updated.id,
      newValue: { itemIds: ids, handedOverAt: at },
    });

    sendOk(res, serializeOrder(updated, req.user!.role));
  }),
);

// DELETE /api/orders/:id — soft delete (a financial record); committed stock goes back as on a cancellation.
router.delete(
  "/:id",
  requirePermission("order.delete"),
  asyncHandler(async (req, res) => {
    const { existing, deleted, reconciled } = await prisma.$transaction(async (tx) => {
      const existing = await lockOrder(tx, req.params.id);
      // The exchange carries this sale's money; take its pieces back with a return instead.
      if (existing.exchanges.length > 0) {
        throw new AppError(409, ERROR_CODES.ORDER_HAS_EXCHANGES);
      }
      const restoreNow = existing.stockDeductedAt !== null;
      if (restoreNow) {
        await restoreStock(tx, outstandingMovements(existing));
      }

      const deleted = await tx.order.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), ...(restoreNow ? { stockDeductedAt: null } : {}) },
      });
      const reconciled = await reconcileCredit(tx, existing.id, req.user!.id);
      return { existing, deleted, reconciled };
    });
    await auditRefund(req.user!.id, existing.id, reconciled);

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
