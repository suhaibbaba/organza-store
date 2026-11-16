import type { Prisma } from "@prisma/client";
import type {
  CashSession,
  CashSessionActor,
  CashSessionFigures,
  CashSessionSortField,
  CashSessionStatus,
  CurrentCashSession,
} from "@organza/shared/types/cash";

export type {
  CashSession,
  CashSessionActor,
  CashSessionFigures,
  CashSessionSortField,
  CashSessionStatus,
  CurrentCashSession,
};

// What the drawer's own arithmetic works in: Decimals, not the 2dp strings
// the API hands out. Converted to strings once, at the response boundary.
export interface CashSessionMovements {
  cashSales: Prisma.Decimal;
  cashExpenses: Prisma.Decimal;
}
