import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import type { CreateOrderItemInput } from "@shared/schemas/order";
import { fromCents, multiplyCents, resolveDiscountCents, toCents } from "@/lib/money";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import type { CartLine, CartTotals, DiscountState } from "@/types/cart";

// Pure cart maths + shaping. Kept out of the React components so the
// arithmetic behind the number the cashier reads out is testable and lives
// in one place.

// A line's identity: the same variant scanned twice is one line with
// quantity 2, not two lines.
export function cartLineKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

// Builds a line from whatever the catalogue returned. Price and stock follow
// the variant-inherits-from-parent fallback (CLAUDE.md rule 3) via the
// already-resolved `resolvedPrice`, so nothing is re-derived here.
export function toCartLine(product: Product, variant: Variant | null): CartLine {
  const image = variant?.images?.[0] ?? product.images?.[0] ?? null;

  return {
    key: cartLineKey(product.id, variant?.id ?? null),
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
    availableStock: variant ? variant.stock : product.stock ?? 0,
    // Variants have no flag of their own — low-stock alerts are opt-in per
    // PRODUCT (CLAUDE.md rule 7's stock default is 1, so most pieces here are
    // one-offs), and a variant inherits its parent's answer.
    trackLowStock: product.trackLowStock,
    quantity: MIN_CART_QUANTITY,
    discountType: null,
    discountValue: null,
  };
}

export function lineGrossCents(line: CartLine): number {
  return multiplyCents(toCents(line.unitPrice), line.quantity);
}

export function lineDiscountCents(line: CartLine): number {
  return resolveDiscountCents(lineGrossCents(line), line.discountType, line.discountValue);
}

export function lineTotal(line: CartLine): string {
  return fromCents(lineGrossCents(line) - lineDiscountCents(line));
}

// subtotal = sum of line totals (item discounts already applied);
// total = subtotal - the order-level discount resolved against it. Same
// order of operations as backend/src/lib/orderPricing.ts, so the figure on
// screen matches the one the receipt is built from.
export function computeTotals(lines: readonly CartLine[], orderDiscount: DiscountState): CartTotals {
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
// cost. Every price on the sale is read from the catalogue server-side.
export function toOrderItems(lines: readonly CartLine[]): CreateOrderItemInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    ...(line.variantId ? { variantId: line.variantId } : {}),
    quantity: line.quantity,
    ...(line.discountType && line.discountValue
      ? { discountType: line.discountType, discountValue: line.discountValue }
      : {}),
  }));
}
