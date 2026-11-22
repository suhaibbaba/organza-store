import type { CartLine, DiscountState } from "@/types/cart";

export interface CartSnapshot {
  lines: CartLine[];
  orderDiscount: DiscountState;
}

// One open sale per person on this tablet, in memory only: locking keeps it for whoever unlocks next as that person.
const stash = new Map<string, CartSnapshot>();
const listeners = new Set<() => void>();

function changed(): void {
  listeners.forEach((listener) => listener());
}

// An app update reloads the page and would lose every cart here, so it waits while any sale is open.
export function hasOpenSale(): boolean {
  return stash.size > 0;
}

export function subscribeOpenSale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readCart(ownerId: string | undefined): CartSnapshot | undefined {
  return ownerId ? stash.get(ownerId) : undefined;
}

export function writeCart(ownerId: string | undefined, snapshot: CartSnapshot): void {
  if (!ownerId) {
    return;
  }
  const wasOpen = stash.has(ownerId);
  if (snapshot.lines.length === 0) {
    stash.delete(ownerId);
  } else {
    stash.set(ownerId, snapshot);
  }
  if (wasOpen !== stash.has(ownerId)) {
    changed();
  }
}

export function dropCart(ownerId: string): void {
  if (stash.delete(ownerId)) {
    changed();
  }
}
