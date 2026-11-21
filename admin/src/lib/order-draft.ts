import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import type { CreateOrderItemInput } from "@store/shared/schemas/order";
import { MIN_ORDER_QUANTITY } from "@/constants/orders";
import { fromCents, multiplyCents, resolveDiscountCents, toCents } from "@/lib/money";
import type { DiscountState, OrderCustomerDraft, OrderDraftLine, OrderDraftTotals } from "@/types/order";

// Mirrors pos/src/lib/cart.ts: same line identity, order of operations and request shape.

export function orderLineKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

// Price follows the variant-to-parent fallback (rule 3) via resolvedPrice.
export function toDraftLine(product: Product, variant: Variant | null): OrderDraftLine {
  const image = variant?.images?.[0] ?? product.images?.[0] ?? null;

  return {
    key: orderLineKey(product.id, variant?.id ?? null),
    productId: product.id,
    variantId: variant?.id ?? null,
    name: product.name,
    variantName: variant?.name ?? null,
    sku: variant?.sku ?? product.sku,
    imageUrl: image?.thumbnailUrl ?? image?.url ?? null,
    unitPrice: variant ? variant.resolvedPrice : product.basePrice,
    // Variants own the stock, so a missing product stock means "not sellable", not "unlimited".
    availableStock: variant ? variant.stock : (product.stock ?? 0),
    quantity: MIN_ORDER_QUANTITY,
    discountType: null,
    discountValue: null,
  };
}

export function lineGrossCents(line: OrderDraftLine): number {
  return multiplyCents(toCents(line.unitPrice), line.quantity);
}

export function lineDiscountCents(line: OrderDraftLine): number {
  return resolveDiscountCents(lineGrossCents(line), line.discountType, line.discountValue);
}

export function lineTotal(line: OrderDraftLine): string {
  return fromCents(lineGrossCents(line) - lineDiscountCents(line));
}

// Same order of operations as backend/src/lib/orderPricing.ts, so the screen matches the saved order.
export function computeDraftTotals(lines: readonly OrderDraftLine[], orderDiscount: DiscountState): OrderDraftTotals {
  let subtotalCents = 0;
  let itemDiscountCents = 0;
  let itemCount = 0;

  for (const line of lines) {
    subtotalCents += lineGrossCents(line) - lineDiscountCents(line);
    itemDiscountCents += lineDiscountCents(line);
    itemCount += line.quantity;
  }

  const orderDiscountCents = resolveDiscountCents(subtotalCents, orderDiscount.type, orderDiscount.value);

  return {
    itemCount,
    subtotal: fromCents(subtotalCents),
    itemDiscountTotal: fromCents(itemDiscountCents),
    orderDiscountAmount: fromCents(orderDiscountCents),
    total: fromCents(subtotalCents - orderDiscountCents),
  };
}

// Never what it costs: every price is read from the catalogue server-side.
export function toOrderItems(lines: readonly OrderDraftLine[]): CreateOrderItemInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    ...(line.variantId ? { variantId: line.variantId } : {}),
    quantity: line.quantity,
    ...(line.discountType && line.discountValue
      ? { discountType: line.discountType, discountValue: line.discountValue }
      : {}),
  }));
}

// Optional fields omitted rather than sent empty (the schema refuses ""); name and phone always sent.
export function toCustomerFields(customer: OrderCustomerDraft) {
  const latitude = customer.latitude.trim();
  const longitude = customer.longitude.trim();
  // Half a coordinate points nowhere, so the pair goes together or not at all.
  const hasLocation = latitude !== "" && longitude !== "";

  return {
    customerName: customer.name.trim(),
    customerPhone: customer.phone.trim(),
    ...(customer.whatsapp.trim() ? { customerWhatsapp: customer.whatsapp.trim() } : {}),
    ...(customer.address.trim() ? { customerAddress: customer.address.trim() } : {}),
    ...(customer.note.trim() ? { note: customer.note.trim() } : {}),
    ...(hasLocation ? { customerLatitude: Number(latitude), customerLongitude: Number(longitude) } : {}),
  };
}
