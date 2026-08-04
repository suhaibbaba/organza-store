import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import type { CreateOrderItemInput } from "@shared/schemas/order";
import { MIN_ORDER_QUANTITY } from "@/constants/orders";
import { fromCents, multiplyCents, resolveDiscountCents, toCents } from "@/lib/money";
import type { DiscountState, OrderCustomerDraft, OrderDraftLine, OrderDraftTotals } from "@/types/order";

// Pure maths + shaping for an order being entered by hand. Kept out of the
// React components so the arithmetic behind the total read back to the
// customer is testable and lives in one place.
//
// Mirrors pos/src/lib/cart.ts: same line identity, same order of operations,
// same "ids and quantities only" request shape.

// A line's identity: the same variant added twice is one line with quantity
// 2, not two lines.
export function orderLineKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

// Builds a line from whatever the catalogue returned. Price follows the
// variant-inherits-from-parent fallback (CLAUDE.md rule 3) via the
// already-resolved `resolvedPrice`, so nothing is re-derived here.
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
    // A variant-bearing product's own `stock` is absent from the API by
    // design (variants own it), so a missing value means "not sellable"
    // rather than "unlimited".
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

// subtotal = sum of line totals (item discounts already applied);
// total = subtotal - the order-level discount resolved against it. Same order
// of operations as backend/src/lib/orderPricing.ts, so the figure on screen
// matches the one the saved order carries.
export function computeDraftTotals(
  lines: readonly OrderDraftLine[],
  orderDiscount: DiscountState
): OrderDraftTotals {
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

// The order API is told what was sold and what was taken off — never what it
// costs. Every price is read from the catalogue server-side.
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

// The customer half of the request. Optional fields are omitted rather than
// sent empty: the create schema requires a non-empty string when a key is
// present, so `""` would be a validation error where "not given" is fine.
// Name and phone are always sent — an online order must be deliverable back
// to someone (ORDER_CUSTOMER_REQUIRED).
export function toCustomerFields(customer: OrderCustomerDraft) {
  const latitude = customer.latitude.trim();
  const longitude = customer.longitude.trim();
  // Half a coordinate points nowhere, so the pair is sent together or not at
  // all (isLocationConsistent).
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
