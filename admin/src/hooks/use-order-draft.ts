"use client";

import { useCallback, useMemo, useState } from "react";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import type { DiscountType } from "@shared/types/order";
import { clampQuantity } from "@shared/constants/quantity";
import { MIN_ORDER_QUANTITY } from "@/constants/orders";
import { computeDraftTotals, orderLineKey, toDraftLine } from "@/lib/order-draft";
import type { DiscountState, OrderDraftLine, OrderDraftTotals } from "@/types/order";

const NO_DISCOUNT: DiscountState = { type: null, value: null };

export interface OrderDraft {
  lines: OrderDraftLine[];
  orderDiscount: DiscountState;
  totals: OrderDraftTotals;
  isEmpty: boolean;
  // Returns the resulting line so the caller can confirm what just landed in
  // the order.
  addItem: (product: Product, variant: Variant | null) => OrderDraftLine;
  setQuantity: (key: string, quantity: number) => void;
  incrementQuantity: (key: string) => void;
  decrementQuantity: (key: string) => void;
  removeLine: (key: string) => void;
  setLineDiscount: (key: string, type: DiscountType | null, value: string | null) => void;
  setOrderDiscount: (type: DiscountType | null, value: string | null) => void;
  clear: () => void;
}

// Quantity can never leave [1, what's on the shelf]: below one the line should
// have been removed, above stock the backend would reject the order anyway
// (ORDER_INSUFFICIENT_STOCK) and the user would only find out on save.
function clampLineQuantity(quantity: number, line: OrderDraftLine): number {
  return clampQuantity(quantity, MIN_ORDER_QUANTITY, Math.max(MIN_ORDER_QUANTITY, line.availableStock));
}

// The order being written down. Held in component state on purpose: a
// half-entered WhatsApp order belongs to the person typing it right now, and
// abandoning it should cost nothing more than leaving the screen.
export function useOrderDraft(): OrderDraft {
  const [lines, setLines] = useState<OrderDraftLine[]>([]);
  const [orderDiscount, setOrderDiscountState] = useState<DiscountState>(NO_DISCOUNT);

  // Every quantity/discount edit is "replace one line, keep the rest".
  const updateLine = useCallback((key: string, update: (line: OrderDraftLine) => OrderDraftLine) => {
    setLines((current) => current.map((line) => (line.key === key ? update(line) : line)));
  }, []);

  const addItem = useCallback((product: Product, variant: Variant | null): OrderDraftLine => {
    const incoming = toDraftLine(product, variant);
    let result = incoming;

    setLines((current) => {
      const existing = current.find((line) => line.key === incoming.key);
      if (!existing) {
        result = incoming;
        return [incoming, ...current];
      }

      // Adding an item the order already holds bumps that line instead of
      // stacking a duplicate — and refreshes its price/stock snapshot from
      // this lookup, which is newer than the one it was added with.
      const refreshed: OrderDraftLine = {
        ...existing,
        unitPrice: incoming.unitPrice,
        availableStock: incoming.availableStock,
        imageUrl: incoming.imageUrl,
        quantity: existing.quantity + 1,
      };
      const updated: OrderDraftLine = { ...refreshed, quantity: clampLineQuantity(refreshed.quantity, refreshed) };
      result = updated;
      return current.map((line) => (line.key === updated.key ? updated : line));
    });

    return result;
  }, []);

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      updateLine(key, (line) => ({ ...line, quantity: clampLineQuantity(quantity, line) }));
    },
    [updateLine]
  );

  const incrementQuantity = useCallback(
    (key: string) => {
      updateLine(key, (line) => ({ ...line, quantity: clampLineQuantity(line.quantity + 1, line) }));
    },
    [updateLine]
  );

  const decrementQuantity = useCallback(
    (key: string) => {
      updateLine(key, (line) => ({ ...line, quantity: clampLineQuantity(line.quantity - 1, line) }));
    },
    [updateLine]
  );

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const setLineDiscount = useCallback(
    (key: string, type: DiscountType | null, value: string | null) => {
      // Both halves move together — the create-order schema refuses a
      // half-set pair (isDiscountConsistent).
      const applied =
        type && value
          ? { discountType: type, discountValue: value }
          : { discountType: null, discountValue: null };
      updateLine(key, (line) => ({ ...line, ...applied }));
    },
    [updateLine]
  );

  const setOrderDiscount = useCallback((type: DiscountType | null, value: string | null) => {
    setOrderDiscountState(type && value ? { type, value } : NO_DISCOUNT);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setOrderDiscountState(NO_DISCOUNT);
  }, []);

  const totals = useMemo(() => computeDraftTotals(lines, orderDiscount), [lines, orderDiscount]);

  return {
    lines,
    orderDiscount,
    totals,
    isEmpty: lines.length === 0,
    addItem,
    setQuantity,
    incrementQuantity,
    decrementQuantity,
    removeLine,
    setLineDiscount,
    setOrderDiscount,
    clear,
  };
}

export { orderLineKey };
