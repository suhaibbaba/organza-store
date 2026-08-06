export interface CashSessionDto {
  id: string;
  date: string;
  tzOffset: number;
  status: "OPEN" | "CLOSED";

  openingFloat: string;
  cashSales: string;
  cashExpenses: string;
  expected: string;

  countedAmount: string | null;
  withdrawnAmount: string;
  difference: string | null;
  closingBalance: string | null;
  note: string | null;

  differenceCarried: boolean;
  followUpResolvedAt: string | null;
  followUpResolvedBy: { id: string; name: string } | null;

  openedBy: { id: string; name: string } | null;
  closedBy: { id: string; name: string } | null;
  openedAt: string;
  closedAt: string | null;
}

export interface CurrentCashSessionDto {
  session: CashSessionDto | null;
  suggestedOpeningFloat: string;
  openFollowUpCount: number;
}
