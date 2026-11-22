import type { CartLine, DiscountState } from "@/types/cart";

export interface CartSnapshot {
  lines: CartLine[];
  orderDiscount: DiscountState;
}

// One open sale per person on this tablet, in memory only: locking keeps it for whoever unlocks next as that person.
const stash = new Map<string, CartSnapshot>();

export function readCart(ownerId: string | undefined): CartSnapshot | undefined {
  return ownerId ? stash.get(ownerId) : undefined;
}

export function writeCart(ownerId: string | undefined, snapshot: CartSnapshot): void {
  if (!ownerId) {
    return;
  }
  if (snapshot.lines.length === 0) {
    stash.delete(ownerId);
    return;
  }
  stash.set(ownerId, snapshot);
}

export function dropCart(ownerId: string): void {
  stash.delete(ownerId);
}
