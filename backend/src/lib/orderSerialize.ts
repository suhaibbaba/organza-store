import type { Role } from "@prisma/client";
import { can } from "@organza/shared/lib/permissions";
import { formatMoney } from "@/lib/money";
import type { AnyRecord } from "@/types";

// `unitCost` is sensitive (CLAUDE.md rule 19): ADMIN ONLY. Gated here, at
// the response boundary, with the same permission the product API uses for
// cost — one rule, one place.
function canSeeCost(role: Role): boolean {
  return can({ role }, "product.viewCost");
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
    subtotal: formatMoney(order.subtotal?.toString()),
    discountType: order.discountType,
    discountValue: formatMoney(order.discountValue?.toString()),
    discountAmount: formatMoney(order.discountAmount?.toString()),
    total: formatMoney(order.total?.toString()),
    stockDeductedAt: order.stockDeductedAt,
    deletedAt: order.deletedAt,
    items: (order.items ?? []).map((item: AnyRecord) => serializeItem(item, role)),
    createdById: order.createdById,
    createdBy: order.createdBy ? { id: order.createdBy.id, name: order.createdBy.name } : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// Lighter DTO for the list endpoint — enough to render a row without
// shipping every line of every order.
export function serializeOrderSummary(order: AnyRecord) {
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
    subtotal: formatMoney(order.subtotal?.toString()),
    discountAmount: formatMoney(order.discountAmount?.toString()),
    total: formatMoney(order.total?.toString()),
    itemCount: order._count?.items ?? (order.items?.length ?? 0),
    stockDeductedAt: order.stockDeductedAt,
    createdById: order.createdById,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
