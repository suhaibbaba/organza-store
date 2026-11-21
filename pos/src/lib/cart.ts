import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import type { CreateOrderItemInput, QuickSellItemInput } from "@store/shared/schemas/order";
import type { I18n } from "@store/shared/types/common";
import { QUANTITY_MAX } from "@store/shared/constants/quantity";
import { fromCents, multiplyCents, resolveDiscountCents, toCents } from "@/lib/money";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import type { CartLine, CartTotals, DiscountState } from "@/types/cart";

const QUICK_SELL_MAX_QUANTITY = QUANTITY_MAX;

// Pure cart maths, kept out of components so the figure the cashier reads out is testable.

export function cartLineKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

// Never merged: two typed pieces with the same name are two different pieces.
let quickSellCounter = 0;

export function quickSellCartLineKey(): string {
  quickSellCounter += 1;
  return `quick:${quickSellCounter}`;
}

// Quick sell (spec.md): a normal CartLine with the catalogue half empty, so it prices and totals the same.
export function toQuickSellCartLine(input: QuickSellItemInput, quantity: number): CartLine {
  const detail = input.detail?.trim() || undefined;
  const text = (value: string): I18n => ({ ar: value, en: value, he: value });

  return {
    key: quickSellCartLineKey(),
    productId: null,
    variantId: null,
    quickSell: { name: input.name.trim(), price: input.price, ...(detail ? { detail } : {}) },
    name: text(input.name.trim()),
    // Reads where a variant name would, so the line and receipt say "Abaya — black".
    variantName: detail ? text(detail) : null,
    sku: null,
    imageUrl: null,
    unitPrice: input.price,
    // No shelf figure exists, so only the shared quantity maximum applies.
    availableStock: QUICK_SELL_MAX_QUANTITY,
    trackLowStock: false,
    quantity,
    discountType: null,
    discountValue: null,
  };
}

// Price and stock come pre-resolved with the variant-inherits-parent fallback (rule 3).
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
    // A variant-bearing product's own stock is absent by design, so missing means not sellable.
    availableStock: variant ? variant.stock : (product.stock ?? 0),
    // Low-stock alerts are opt-in per product; a variant inherits its parent's answer.
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

// Same order of operations as backend lib/orderPricing.ts, so the screen matches the receipt.
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

// Never sends prices except a quick-sold line's, which has no catalogue entry to read one from.
export function toOrderItems(lines: readonly CartLine[]): CreateOrderItemInput[] {
  return lines.map((line) => ({
    // Exactly one of the two: the create-order schema refuses anything else.
    ...(line.quickSell ? { quickSell: line.quickSell } : { productId: line.productId! }),
    ...(line.variantId ? { variantId: line.variantId } : {}),
    quantity: line.quantity,
    ...(line.discountType && line.discountValue
      ? { discountType: line.discountType, discountValue: line.discountValue }
      : {}),
  }));
}
