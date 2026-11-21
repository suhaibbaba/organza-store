import type { Prisma } from "@prisma/client";
import type {
  CashSession,
  CashSessionActor,
  CashSessionFigures,
  CashSessionSortField,
  CashSessionStatus,
  CurrentCashSession,
} from "@store/shared/types/cash";

export type {
  CashSession,
  CashSessionActor,
  CashSessionFigures,
  CashSessionSortField,
  CashSessionStatus,
  CurrentCashSession,
};

// Drawer arithmetic in Decimals, converted to 2dp strings once at the response boundary.
export interface CashSessionMovements {
  cashSales: Prisma.Decimal;
  cashExpenses: Prisma.Decimal;
}
