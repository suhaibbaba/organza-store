import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { money, resolveDiscountAmount, roundMoney, formatMoney, ZERO_MONEY } from "@/lib/money";
import { ERROR_CODES } from "@/constants";
import type { AnyRecord, DiscountType, OrderTotals, PricedOrderItem, StockMovement } from "@/types";

// The one place order money is computed, so a client-supplied total has nowhere to enter.

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

// unitPrice × quantity − itemDiscount; exported so an edit re-prices from the stored snapshot.
export function priceLine(
  unitPrice: Prisma.Decimal.Value,
  quantity: number,
  discount: DiscountInput,
): { discountAmount: string; lineTotal: string } {
  const gross = roundMoney(money(unitPrice).mul(quantity));
  const discountAmount = resolveDiscountAmount(gross, discount.discountType, discount.discountValue);
  return {
    discountAmount: discountAmount.toFixed(2),
    lineTotal: roundMoney(gross.sub(discountAmount)).toFixed(2),
  };
}

// subtotal = sum of line totals; total = subtotal − the order discount resolved against it.
export function computeOrderTotals(lineTotals: readonly string[], discount: DiscountInput): OrderTotals {
  const subtotal = lineTotals.reduce((sum, line) => sum.add(money(line)), ZERO_MONEY());
  const rounded = roundMoney(subtotal);
  const discountAmount = resolveDiscountAmount(rounded, discount.discountType, discount.discountValue);
  return {
    subtotal: rounded.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    total: roundMoney(rounded.sub(discountAmount)).toFixed(2),
  };
}

// Snapshots each line (name, sku, price, cost) so later catalogue changes never rewrite the sale; variant fallback per rule 3.
export async function priceRequestedItems(items: readonly RequestedItem[]): Promise<PricedOrderItem[]> {
  const priced: PricedOrderItem[] = [];

  for (const item of items) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, deletedAt: null },
      include: { variants: true },
    });
    if (!product) {
      throw new AppError(400, ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE);
    }

    let variant: AnyRecord | null = null;
    if (item.variantId) {
      variant = product.variants.find((v) => v.id === item.variantId) ?? null;
      // A variant id that isn't this product's is a caller mistake: refuse rather than sell the parent.
      if (!variant) {
        throw new AppError(400, ERROR_CODES.ORDER_PRODUCT_UNAVAILABLE);
      }
    } else if (product.variants.length > 0) {
      // The parent of a variant-bearing product isn't sellable: it owns neither the price nor the stock.
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

// A gift re-prices every line to zero (not a 100% discount) and keeps unitCost — the figure gifts are reported at.
export function asGiftLines(lines: readonly PricedOrderItem[]): PricedOrderItem[] {
  const free = ZERO_MONEY().toFixed(2);
  return lines.map((line) => ({
    ...line,
    unitPrice: free,
    discountType: null,
    discountValue: null,
    discountAmount: free,
    lineTotal: free,
  }));
}

// Sums lines per stock target, so the same variant listed twice is checked and deducted as one total.
export function toStockMovements(
  lines: readonly { productId: string | null; variantId: string | null; quantity: number }[],
): StockMovement[] {
  const byTarget = new Map<string, StockMovement>();

  for (const line of lines) {
    if (line.quantity <= 0) {
      continue;
    }
    // Products that are no longer in the catalogue (variant hard-deleted) have nothing left to move stock against.
    if (!line.variantId && !line.productId) {
      continue;
    }

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
