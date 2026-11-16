import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { StockMovement } from "@/types";

// Stock movement for orders. Every call runs inside the caller's
// transaction, and deduction is guarded so two POS terminals selling the
// last piece at the same moment can't both succeed.

type Tx = Prisma.TransactionClient;

// Takes stock off the shelf, one target at a time. The `stock: { gte }`
// guard makes the check and the decrement a single atomic statement — a
// read-then-write would leave a window where both callers see enough stock.
// A zero-row result means someone else got there first.
export async function deductStock(tx: Tx, movements: readonly StockMovement[]): Promise<void> {
  for (const movement of movements) {
    const result = movement.variantId
      ? await tx.variant.updateMany({
          where: { id: movement.variantId, stock: { gte: movement.quantity } },
          data: { stock: { decrement: movement.quantity } },
        })
      : await tx.product.updateMany({
          where: { id: movement.productId!, stock: { gte: movement.quantity } },
          data: { stock: { decrement: movement.quantity } },
        });

    if (result.count === 0) throw new AppError(409, ERROR_CODES.ORDER_INSUFFICIENT_STOCK);
  }
}

// Puts stock back — on a cancellation or a return. No guard: restoring can
// never fail on availability, and a target that has since been deleted
// simply matches nothing.
export async function restoreStock(tx: Tx, movements: readonly StockMovement[]): Promise<void> {
  for (const movement of movements) {
    if (movement.variantId) {
      await tx.variant.updateMany({
        where: { id: movement.variantId },
        data: { stock: { increment: movement.quantity } },
      });
    } else {
      await tx.product.updateMany({
        where: { id: movement.productId! },
        data: { stock: { increment: movement.quantity } },
      });
    }
  }
}
