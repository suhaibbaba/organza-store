"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import type { DiscountType } from "@organza/shared/types/order";
import { clampQuantity } from "@organza/shared/constants/quantity";
import { cartLineKey, computeTotals, toCartLine } from "@/lib/cart";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import type { CartLine, CartTotals, DiscountState } from "@/types/cart";

const NO_DISCOUNT: DiscountState = { type: null, value: null };

export interface Cart {
  lines: CartLine[];
  orderDiscount: DiscountState;
  totals: CartTotals;
  isEmpty: boolean;
  // Returns the resulting line so the caller can tell the cashier what just
  // landed in the cart — a scan gives no other feedback that it worked.
  addItem: (product: Product, variant: Variant | null) => CartLine;
  setQuantity: (key: string, quantity: number) => void;
  incrementQuantity: (key: string) => void;
  decrementQuantity: (key: string) => void;
  removeLine: (key: string) => void;
  setLineDiscount: (key: string, type: DiscountType | null, value: string | null) => void;
  setOrderDiscount: (type: DiscountType | null, value: string | null) => void;
  clear: () => void;
}

// Quantity can never leave [1, what's on the shelf]: below one the line
// should have been removed, above stock the backend would reject the sale
// anyway (ORDER_INSUFFICIENT_STOCK) and the cashier would find out only at
// checkout, with the customer waiting. The shared 999 ceiling applies on top
// of that, so a line can never carry a number the stepper refuses to show.
function clampLineQuantity(quantity: number, line: CartLine): number {
  return clampQuantity(quantity, MIN_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, line.availableStock));
}

// The open sale. Held in component state on purpose: a sale belongs to the
// person standing at the counter right now, and abandoning it should cost
// nothing more than a refresh.
//
// The lines live in a ref as well as in state, and every mutation reads the
// ref rather than the state variable. Two reasons, both about scanning: a
// handler has to be able to return the line it just produced (state updates
// aren't visible until the next render), and a camera firing two scans
// inside one tick must see the first one's result instead of both starting
// from the same stale array.
export function useCart(): Cart {
  const linesRef = useRef<CartLine[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orderDiscount, setOrderDiscountState] = useState<DiscountState>(NO_DISCOUNT);

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  // Every quantity/discount edit is "replace one line, keep the rest".
  const updateLine = useCallback(
    (key: string, update: (line: CartLine) => CartLine) => {
      commit(linesRef.current.map((line) => (line.key === key ? update(line) : line)));
    },
    [commit]
  );

  const addItem = useCallback(
    (product: Product, variant: Variant | null): CartLine => {
      const incoming = toCartLine(product, variant);
      const existing = linesRef.current.find((line) => line.key === incoming.key);

      if (!existing) {
        commit([incoming, ...linesRef.current]);
        return incoming;
      }

      // Re-scanning an item the cart already holds bumps that line instead
      // of stacking a duplicate — and refreshes its price/stock snapshot
      // from this lookup, which is newer than the one it was added with.
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
    [commit]
  );

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

  const removeLine = useCallback(
    (key: string) => {
      commit(linesRef.current.filter((line) => line.key !== key));
    },
    [commit]
  );

  const setLineDiscount = useCallback(
    (key: string, type: DiscountType | null, value: string | null) => {
      // Both halves move together — the create-order schema refuses a
      // half-set pair (isDiscountConsistent).
      const applied = type && value ? { discountType: type, discountValue: value } : { discountType: null, discountValue: null };
      updateLine(key, (line) => ({ ...line, ...applied }));
    },
    [updateLine]
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
    setQuantity,
    incrementQuantity,
    decrementQuantity,
    removeLine,
    setLineDiscount,
    setOrderDiscount,
    clear,
  };
}

export { cartLineKey };
