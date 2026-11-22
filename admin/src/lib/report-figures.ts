import { MONEY_DECIMAL_PLACES } from "@store/shared/constants/order";
import type { SalesTotals } from "@store/shared/types/report";

// "Still owed to us" is the courier's money plus what customers owe on credit (spec.md "Customers and selling on credit").
export function owedTotal(totals: Pick<SalesTotals, "pendingCollectionAmount" | "customerDebtAmount">): string {
  return (Number(totals.pendingCollectionAmount) + Number(totals.customerDebtAmount)).toFixed(MONEY_DECIMAL_PLACES);
}
