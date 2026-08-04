import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { money, resolveDiscountAmount, roundMoney, formatMoney, ZERO_MONEY } from "@/lib/money";
import { ERROR_CODES } from "@/constants";
import type { AnyRecord, DiscountType, OrderTotals, PricedOrderItem, StockMovement } from "@/types";

// The one place order money is computed. Both creation and editing go
// through it, so a client-supplied total has nowhere to enter: the caller
// only ever names products, quantities and discounts.

interface RequestedItem {
  productId: string;
  variantId?: string;
  quantity: number;
  discountType?: DiscountType | null;
  discountValue?: string | null;
}

interface DiscountInput {
  discountType?: DiscountType | null;
  discountValue?: string | null;
}

// unitPrice * quantity - itemDiscount. Exported so the edit path can
// re-price an existing line from its stored snapshot without re-reading the
// catalogue (a past sale keeps the price it was sold at).
export function priceLine(
  unitPrice: Prisma.Decimal.Value,
  quantity: number,
  discount: DiscountInput
): { discountAmount: string; lineTotal: string } {
  const gross = roundMoney(money(unitPrice).mul(quantity));
  const discountAmount = resolveDiscountAmount(gross, discount.discountType, discount.discountValue);
  return {
    discountAmount: discountAmount.toFixed(2),
    lineTotal: roundMoney(gross.sub(discountAmount)).toFixed(2),
  };
}

// subtotal = sum of line totals (item discounts already applied);
// total = subtotal - the order-level discount resolved against it.
export function computeOrderTotals(
  lineTotals: readonly string[],
  discount: DiscountInput
): OrderTotals {
  const subtotal = lineTotals.reduce((sum, line) => sum.add(money(line)), ZERO_MONEY());
  const rounded = roundMoney(subtotal);
  const discountAmount = resolveDiscountAmount(rounded, discount.discountType, discount.discountValue);
  return {
    subtotal: rounded.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    total: roundMoney(rounded.sub(discountAmount)).toFixed(2),
  };
}

// Resolves each requested line against the live catalogue and snapshots it:
// name, sku, price and cost are frozen here so renaming or repricing the
// product later never rewrites this sale. Price/cost follow the same
// variant-inherits-from-parent fallback the product API uses (CLAUDE.md
// rule 3) — resolved at read time, never copied onto the variant.
export async function priceRequestedItems(items: readonly RequestedItem[]): Promise<PricedOrderItem[]> {
  const priced: PricedOrderItem[] = [];

  for (const item of items) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, deletedAt: null },
      include: { variants: true },
    });
    if (!product) throw new AppError(400, ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE);

    let variant: AnyRecord | null = null;
    if (item.variantId) {
      variant = product.variants.find((v) => v.id === item.variantId) ?? null;
      // A variant id that isn't this product's is a caller mistake, not a
      // missing row — refuse rather than silently selling the parent.
      if (!variant) throw new AppError(400, ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE);
    } else if (product.variants.length > 0) {
      // The parent of a variant-bearing product isn't purchasable: it owns
      // neither the price nor the stock that would be sold.
      throw new AppError(400, ERROR_CODES.ORDER_VARIANT_REQUIRED);
    }

    const unitPrice = (variant?.priceOverride ?? product.basePrice).toString();
    const resolvedCost = variant?.cost ?? product.cost ?? null;
    const line = priceLine(unitPrice, item.quantity, item);

    priced.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? product.sku ?? null,
      unitPrice: formatMoney(unitPrice)!,
      unitCost: formatMoney(resolvedCost?.toString()),
      quantity: item.quantity,
      discountType: item.discountType ?? null,
      discountValue: item.discountValue ?? null,
      discountAmount: line.discountAmount,
      lineTotal: line.lineTotal,
    });
  }

  return priced;
}

// Collapses lines into per-stock-target quantities: the same variant listed
// twice in one order has to be checked and deducted as one total, or the
// second line could oversell what the first already took.
export function toStockMovements(
  lines: readonly { productId: string | null; variantId: string | null; quantity: number }[]
): StockMovement[] {
  const byTarget = new Map<string, StockMovement>();

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    // Products that are no longer in the catalogue (variant hard-deleted)
    // have nothing left to move stock against.
    if (!line.variantId && !line.productId) continue;

    const key = line.variantId ? `variant:${line.variantId}` : `product:${line.productId}`;
    const existing = byTarget.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      byTarget.set(key, {
        productId: line.variantId ? null : line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      });
    }
  }

  return [...byTarget.values()];
}
