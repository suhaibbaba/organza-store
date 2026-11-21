import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { StockMovement } from "@/types";

// Stock movement for orders, inside the caller's transaction; deduction is guarded against two tills selling the last piece.

type Tx = Prisma.TransactionClient;

// `stock: { gte }` makes check and decrement one atomic statement; zero rows means someone else got there first.
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

    if (result.count === 0) {
      throw new AppError(409, ERROR_CODES.ORDER_INSUFFICIENT_STOCK);
    }
  }
}

// Puts stock back on cancel or return; unguarded, and a deleted target simply matches nothing.
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
