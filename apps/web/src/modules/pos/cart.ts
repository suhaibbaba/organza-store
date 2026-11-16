import {
  addMoney,
  allocateMoney,
  compareMoney,
  fromMinor,
  multiplyMoney,
  toMinor,
  type Translatable,
} from '@organza/shared';
import { useCallback, useEffect, useState } from 'react';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { safeStorage } from '@web/shared/lib/safe-storage';

export interface CartLine {
  key: string;
  itemId: string;
  productId: string;
  name: Translatable;
  variantLabel: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  /** Discount on the whole line. */
  discount: string;
  available: number;
  /** Set when the server refused this line (sold just now, price changed). */
  problem?: 'STOCK' | 'PRICE' | 'NOT_SELLABLE';
}

export interface CartCustomer {
  id: string;
  name: string;
  phone: string | null;
  debt: string;
  credit: string;
}

export interface Cart {
  /** Kept until the sale is saved: a retry after a crash replays instead of selling twice. */
  idempotencyKey: string;
  lines: CartLine[];
  customer: CartCustomer | null;
  cartDiscount: string;
  note: string;
  parkedAt?: string;
}

const emptyCart = (): Cart => ({
  idempotencyKey: newIdempotencyKey(),
  lines: [],
  customer: null,
  cartDiscount: '0.00',
  note: '',
});

const key = (registerId: string) => `organza.pos.${registerId}`;

interface Stored {
  current: Cart;
  parked: Cart[];
}

function load(registerId: string): Stored {
  try {
    const raw = safeStorage.get(key(registerId));
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed.current?.idempotencyKey)
        return { current: parsed.current, parked: parsed.parked ?? [] };
    }
  } catch {
    // A broken stored cart is dropped; nothing was sold from it.
  }
  return { current: emptyCart(), parked: [] };
}

/** Totals exactly as the server computes them (cart discount spread over lines by value). */
export function cartTotals(cart: Cart) {
  const nets = cart.lines.map((l) =>
    addMoney(multiplyMoney(l.unitPrice, l.quantity), fromMinor(-toMinor(l.discount))),
  );
  const subtotal = addMoney('0', ...cart.lines.map((l) => multiplyMoney(l.unitPrice, l.quantity)));
  const netTotal = addMoney('0', ...nets);
  const cartDiscount = compareMoney(cart.cartDiscount, netTotal) > 0 ? netTotal : cart.cartDiscount;
  const shares = allocateMoney(
    cartDiscount,
    nets.map((n) => toMinor(n)),
  );
  const discountTotal = addMoney('0', ...cart.lines.map((l) => l.discount), ...shares);
  const total = addMoney(subtotal, fromMinor(-toMinor(discountTotal)));
  const count = cart.lines.reduce((n, l) => n + l.quantity, 0);
  return { subtotal, discountTotal, total, count };
}

export const MAX_PARKED = 6;

/** The till's cart and parked carts, saved on this device after every change. */
export function useCart(registerId: string) {
  const [state, setState] = useState<Stored>(() => load(registerId));
  useEffect(() => setState(load(registerId)), [registerId]);
  useEffect(() => safeStorage.set(key(registerId), JSON.stringify(state)), [registerId, state]);

  const update = useCallback(
    (fn: (cart: Cart) => Cart) => setState((s) => ({ ...s, current: fn(s.current) })),
    [],
  );

  const add = useCallback(
    (line: Omit<CartLine, 'key' | 'quantity' | 'discount'>) =>
      update((cart) => {
        const existing = cart.lines.find((l) => l.itemId === line.itemId);
        if (existing)
          return {
            ...cart,
            lines: cart.lines.map((l) =>
              l === existing ? { ...l, quantity: l.quantity + 1, problem: undefined } : l,
            ),
          };
        return {
          ...cart,
          lines: [
            ...cart.lines,
            { ...line, key: newIdempotencyKey(), quantity: 1, discount: '0.00' },
          ],
        };
      }),
    [update],
  );

  return {
    cart: state.current,
    parked: state.parked,
    add,
    setQuantity: (lineKey: string, quantity: number) =>
      update((cart) => ({
        ...cart,
        lines:
          quantity <= 0
            ? cart.lines.filter((l) => l.key !== lineKey)
            : cart.lines.map((l) =>
                l.key === lineKey ? { ...l, quantity, problem: undefined } : l,
              ),
      })),
    setLineDiscount: (lineKey: string, discount: string) =>
      update((cart) => ({
        ...cart,
        lines: cart.lines.map((l) => (l.key === lineKey ? { ...l, discount } : l)),
      })),
    remove: (lineKey: string) =>
      update((cart) => ({ ...cart, lines: cart.lines.filter((l) => l.key !== lineKey) })),
    setCustomer: (customer: CartCustomer | null) => update((cart) => ({ ...cart, customer })),
    setCartDiscount: (cartDiscount: string) => update((cart) => ({ ...cart, cartDiscount })),
    setNote: (note: string) => update((cart) => ({ ...cart, note })),
    /** Applies what the server said about lines: new prices, or lines that cannot be sold. */
    markProblems: (problems: { itemId: string; problem: CartLine['problem']; price?: string }[]) =>
      update((cart) => ({
        ...cart,
        lines: cart.lines.map((l) => {
          const p = problems.find((x) => x.itemId === l.itemId);
          if (!p) return l;
          return { ...l, problem: p.problem, unitPrice: p.price ?? l.unitPrice };
        }),
      })),
    clear: () => setState((s) => ({ ...s, current: emptyCart() })),
    park: () =>
      setState((s) =>
        s.current.lines.length === 0 || s.parked.length >= MAX_PARKED
          ? s
          : {
              current: emptyCart(),
              parked: [...s.parked, { ...s.current, parkedAt: new Date().toISOString() }],
            },
      ),
    resume: (index: number) =>
      setState((s) => {
        const picked = s.parked[index];
        if (!picked) return s;
        const rest = s.parked.filter((_, i) => i !== index);
        // The cart being served now is parked in its place if it has anything in it.
        const parked = s.current.lines.length
          ? [...rest, { ...s.current, parkedAt: new Date().toISOString() }]
          : rest;
        return { current: { ...picked, parkedAt: undefined }, parked };
      }),
  };
}

export type CartApi = ReturnType<typeof useCart>;
