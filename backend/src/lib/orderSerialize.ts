import type { Role } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { formatMoney, zeroMoneyText } from "@/lib/money";
import { orderBalance } from "@/lib/orderCredit";
import { MONEY_DECIMAL_PLACES } from "@/constants";
import type { AnyRecord } from "@/types";

// unitCost is Admin only (rule 19), gated at the response boundary with the product API's own permission.
function canSeeCost(role: Role): boolean {
  return can({ role }, "product.viewCost");
}

// A variant's own photo first, else its product's; null for a quick-sold line or a removed product.
function lineThumbnail(item: AnyRecord): string | null {
  return item.variant?.images?.[0]?.thumbnailUrl ?? item.product?.images?.[0]?.thumbnailUrl ?? null;
}

function serializeItem(item: AnyRecord, role: Role) {
  const dto: AnyRecord = {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    variantName: item.variantName,
    sku: item.sku,
    unitPrice: formatMoney(item.unitPrice?.toString()),
    quantity: item.quantity,
    discountType: item.discountType,
    discountValue: formatMoney(item.discountValue?.toString()),
    discountAmount: formatMoney(item.discountAmount?.toString()),
    lineTotal: formatMoney(item.lineTotal?.toString()),
    returnedQuantity: item.returnedQuantity,
    quickSold: item.quickSold ?? false,
    thumbnailUrl: lineThumbnail(item),
    handedOverAt: item.handedOverAt ?? null,
    handedOverBy: item.handedOverBy ? { id: item.handedOverBy.id, name: item.handedOverBy.name } : null,
  };

  if (canSeeCost(role)) {
    dto.unitCost = formatMoney(item.unitCost?.toString());
  }

  return dto;
}

export function serializeOrder(order: AnyRecord, role: Role) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    // SALE or GIFT — what this order IS, as opposed to where it came from.
    type: order.type,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    collectedAt: order.collectedAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerWhatsapp: order.customerWhatsapp,
    customerAddress: order.customerAddress,
    customerLatitude: order.customerLatitude,
    customerLongitude: order.customerLongitude,
    note: order.note,
    customerId: order.customerId ?? null,
    onCredit: order.onCredit ?? false,
    paidAmount: formatMoney(order.paidAmount?.toString()) ?? zeroMoneyText(),
    // Only a credit sale owes the shop money of its own; a courier parcel's is on the collection screen.
    balance:
      order.onCredit && order.items ? orderBalance(order as never).toFixed(MONEY_DECIMAL_PLACES) : zeroMoneyText(),
    payments: (order.payments ?? []).map((payment: AnyRecord) => ({
      id: payment.id,
      amount: formatMoney(payment.amount?.toString()),
      method: payment.method,
      receivedAt: payment.receivedAt,
      note: payment.note ?? null,
      receivedBy: payment.receivedBy ? { id: payment.receivedBy.id, name: payment.receivedBy.name } : null,
    })),
    subtotal: formatMoney(order.subtotal?.toString()),
    discountType: order.discountType,
    discountValue: formatMoney(order.discountValue?.toString()),
    discountAmount: formatMoney(order.discountAmount?.toString()),
    total: formatMoney(order.total?.toString()),
    hasQuickSale: order.hasQuickSale ?? false,
    stockDeductedAt: order.stockDeductedAt,
    deletedAt: order.deletedAt,
    items: (order.items ?? []).map((item: AnyRecord) => serializeItem(item, role)),
    createdById: order.createdById,
    createdBy: order.createdBy ? { id: order.createdBy.id, name: order.createdBy.name } : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function serializePreviewItem(item: AnyRecord) {
  return {
    id: item.id,
    name: item.name,
    variantName: item.variantName ?? null,
    quantity: item.quantity,
    thumbnailUrl: lineThumbnail(item),
  };
}

export function serializeOrderSummary(order: AnyRecord, outstanding?: Map<string, string>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    type: order.type,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    collectedAt: order.collectedAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerId: order.customerId ?? null,
    onCredit: order.onCredit ?? false,
    paidAmount: formatMoney(order.paidAmount?.toString()) ?? zeroMoneyText(),
    subtotal: formatMoney(order.subtotal?.toString()),
    discountAmount: formatMoney(order.discountAmount?.toString()),
    total: formatMoney(order.total?.toString()),
    // Net of partial returns; only an order still waiting for its money has one.
    outstanding: order.paymentStatus === "PENDING_COLLECTION" ? (outstanding?.get(order.id) ?? formatMoney("0")) : null,
    itemCount: order._count?.items ?? order.items?.length ?? 0,
    previewItems: (order.items ?? []).map(serializePreviewItem),
    hasQuickSale: order.hasQuickSale ?? false,
    stockDeductedAt: order.stockDeductedAt,
    createdById: order.createdById,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
