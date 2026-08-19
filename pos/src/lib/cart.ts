import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import type { CreateOrderItemInput, QuickSellItemInput } from "@organza/shared/schemas/order";
import type { I18n } from "@organza/shared/types/common";
import { QUANTITY_MAX } from "@organza/shared/constants/quantity";
import { fromCents, multiplyCents, resolveDiscountCents, toCents } from "@/lib/money";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import type { CartLine, CartTotals, DiscountState } from "@/types/cart";

// A quick-sold line has no shelf figure behind it, so the only ceiling on
// what it may sell is the shared one every quantity stepper obeys.
const QUICK_SELL_MAX_QUANTITY = QUANTITY_MAX;

// Pure cart maths + shaping. Kept out of the React components so the
// arithmetic behind the number the cashier reads out is testable and lives
// in one place.

// A line's identity: the same variant scanned twice is one line with
// quantity 2, not two lines.
export function cartLineKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

// A quick-sold line's identity. Nothing in the catalogue backs it, so it
// cannot be keyed by a product id — and it must NEVER merge with another:
// typing "abaya" twice at the counter is two different pieces that happen to
// share a name, and merging them would sell one and lose the other.
let quickSellCounter = 0;

export function quickSellCartLineKey(): string {
  quickSellCounter += 1;
  return `quick:${quickSellCounter}`;
}

// A piece typed at the counter because it is not in the system yet (spec.md
// "Quick sell"). Same CartLine as everything else — it prices, discounts and
// totals identically — with the catalogue half left empty and the typed name
// and price standing in for it.
export function toQuickSellCartLine(input: QuickSellItemInput, quantity: number): CartLine {
  const detail = input.detail?.trim() || undefined;
  const text = (value: string): I18n => ({ ar: value, en: value, he: value });

  return {
    key: quickSellCartLineKey(),
    productId: null,
    variantId: null,
    quickSell: { name: input.name.trim(), price: input.price, ...(detail ? { detail } : {}) },
    name: text(input.name.trim()),
    // The typed "which one" reads exactly where a variant name would, so the
    // cart line, the receipt and the order all say "Abaya — black" without
    // anything having to know a variant was never built.
    variantName: detail ? text(detail) : null,
    sku: null,
    imageUrl: null,
    unitPrice: input.price,
    // Whatever the cashier says is leaving the shop. There is no shelf figure
    // to check it against — the piece was never on a shelf the system knows
    // about — so the stepper's ceiling is the shared quantity maximum alone.
    availableStock: QUICK_SELL_MAX_QUANTITY,
    trackLowStock: false,
    quantity,
    discountType: null,
    discountValue: null,
  };
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
    quickSell: null,
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
// cost. Every price on the sale is read from the catalogue server-side, with
// ONE exception that proves the rule: a quick-sold line has no catalogue
// entry to read a price from, so the figure typed at the counter travels with
// it (spec.md "Quick sell"). Nothing is being overridden — that figure IS the
// piece's first price, and the backend makes it the new product's basePrice
// as well as the line's, so the two cannot disagree.
export function toOrderItems(lines: readonly CartLine[]): CreateOrderItemInput[] {
  return lines.map((line) => ({
    // Either a catalogue product or a quick sale, never both and never
    // neither — the create-order schema refuses anything else.
    ...(line.quickSell ? { quickSell: line.quickSell } : { productId: line.productId! }),
    ...(line.variantId ? { variantId: line.variantId } : {}),
    quantity: line.quantity,
    ...(line.discountType && line.discountValue
      ? { discountType: line.discountType, discountValue: line.discountValue }
      : {}),
  }));
}
