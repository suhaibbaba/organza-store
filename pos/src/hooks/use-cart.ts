"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import type { DiscountType } from "@store/shared/types/order";
import type { QuickSellItemInput } from "@store/shared/schemas/order";
import { clampQuantity } from "@store/shared/constants/quantity";
import { cartLineKey, computeTotals, toCartLine, toQuickSellCartLine } from "@/lib/cart";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import { readCart, writeCart } from "@/lib/cart-stash";
import type { CartLine, CartTotals, DiscountState } from "@/types/cart";

const NO_DISCOUNT: DiscountState = { type: null, value: null };

export interface Cart {
  lines: CartLine[];
  orderDiscount: DiscountState;
  totals: CartTotals;
  isEmpty: boolean;
  // Returned so the caller can tell the cashier what landed: a scan gives no other feedback.
  addItem: (product: Product, variant: Variant | null) => CartLine;
  // Quick sell (spec.md): always a new line, never merged, since two typed pieces are two pieces.
  addQuickSellItem: (input: QuickSellItemInput, quantity: number) => CartLine;
  setQuantity: (key: string, quantity: number) => void;
  incrementQuantity: (key: string) => void;
  decrementQuantity: (key: string) => void;
  removeLine: (key: string) => void;
  // Undo of a removal: back where it was, unless the same piece was scanned in again meanwhile.
  restoreLine: (line: CartLine, index: number) => void;
  setLineDiscount: (key: string, type: DiscountType | null, value: string | null) => void;
  setOrderDiscount: (type: DiscountType | null, value: string | null) => void;
  clear: () => void;
}

// Clamped to [1, stock]: the backend would refuse more at checkout, with the customer waiting.
function clampLineQuantity(quantity: number, line: CartLine): number {
  return clampQuantity(quantity, MIN_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, line.availableStock));
}

// Component state, kept per person while the till is locked (lib/cart-stash); mutations read a ref so rapid scans don't race.
export function useCart(ownerId?: string): Cart {
  const [initial] = useState(() => readCart(ownerId));
  const linesRef = useRef<CartLine[]>(initial?.lines ?? []);
  const [lines, setLines] = useState<CartLine[]>(initial?.lines ?? []);
  const [orderDiscount, setOrderDiscountState] = useState<DiscountState>(initial?.orderDiscount ?? NO_DISCOUNT);

  useEffect(() => {
    writeCart(ownerId, { lines, orderDiscount });
  }, [ownerId, lines, orderDiscount]);

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  // Every quantity/discount edit is "replace one line, keep the rest".
  const updateLine = useCallback(
    (key: string, update: (line: CartLine) => CartLine) => {
      commit(linesRef.current.map((line) => (line.key === key ? update(line) : line)));
    },
    [commit],
  );

  const addItem = useCallback(
    (product: Product, variant: Variant | null): CartLine => {
      const incoming = toCartLine(product, variant);
      const existing = linesRef.current.find((line) => line.key === incoming.key);

      if (!existing) {
        commit([incoming, ...linesRef.current]);
        return incoming;
      }

      // A repeat scan bumps the line and refreshes its price/stock snapshot from this newer lookup.
      const refreshed: CartLine = {
        ...existing,
        unitPrice: incoming.unitPrice,
        availableStock: incoming.availableStock,
        imageUrl: incoming.imageUrl,
        quantity: existing.quantity + 1,
      };
      const updated: CartLine = { ...refreshed, quantity: clampLineQuantity(refreshed.quantity, refreshed) };
      commit(linesRef.current.map((line) => (line.key === updated.key ? updated : line)));
      return updated;
    },
    [commit],
  );

  const addQuickSellItem = useCallback(
    (input: QuickSellItemInput, quantity: number): CartLine => {
      const line = toQuickSellCartLine(input, clampQuantity(quantity, MIN_CART_QUANTITY));
      commit([line, ...linesRef.current]);
      return line;
    },
    [commit],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      updateLine(key, (line) => ({ ...line, quantity: clampLineQuantity(quantity, line) }));
    },
    [updateLine],
  );

  const incrementQuantity = useCallback(
    (key: string) => {
      updateLine(key, (line) => ({ ...line, quantity: clampLineQuantity(line.quantity + 1, line) }));
    },
    [updateLine],
  );

  const decrementQuantity = useCallback(
    (key: string) => {
      updateLine(key, (line) => ({ ...line, quantity: clampLineQuantity(line.quantity - 1, line) }));
    },
    [updateLine],
  );

  const removeLine = useCallback(
    (key: string) => {
      commit(linesRef.current.filter((line) => line.key !== key));
    },
    [commit],
  );

  const restoreLine = useCallback(
    (line: CartLine, index: number) => {
      if (linesRef.current.some((current) => current.key === line.key)) {
        return;
      }
      const next = [...linesRef.current];
      next.splice(Math.min(index, next.length), 0, line);
      commit(next);
    },
    [commit],
  );

  const setLineDiscount = useCallback(
    (key: string, type: DiscountType | null, value: string | null) => {
      // Both halves move together: the create-order schema refuses a half-set pair.
      const applied =
        type && value ? { discountType: type, discountValue: value } : { discountType: null, discountValue: null };
      updateLine(key, (line) => ({ ...line, ...applied }));
    },
    [updateLine],
  );

  const setOrderDiscount = useCallback((type: DiscountType | null, value: string | null) => {
    setOrderDiscountState(type && value ? { type, value } : NO_DISCOUNT);
  }, []);

  const clear = useCallback(() => {
    commit([]);
    setOrderDiscountState(NO_DISCOUNT);
  }, [commit]);

  const totals = useMemo(() => computeTotals(lines, orderDiscount), [lines, orderDiscount]);

  return {
    lines,
    orderDiscount,
    totals,
    isEmpty: lines.length === 0,
    addItem,
    addQuickSellItem,
    setQuantity,
    incrementQuantity,
    decrementQuantity,
    removeLine,
    restoreLine,
    setLineDiscount,
    setOrderDiscount,
    clear,
  };
}

export { cartLineKey };
