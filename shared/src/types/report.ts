import type { REPORT_PERIODS } from "@/constants/report";
import type { I18n } from "@/types/common";
import type { OrderChannel } from "@/types/order";

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

// Every money figure below is a 2dp string, like the rest of the API: floats
// can't hold every 2dp value exactly (CLAUDE.md — money is never a Float).
//
// All of it is computed from the ORDER ITEM SNAPSHOTS (unitPrice/unitCost
// frozen at sale time), never from today's catalogue, and always net:
// cancelled and soft-deleted orders are out, returned quantities are
// subtracted from both revenue and cost.
export interface SalesTotals {
  // Orders that still have something sold in them (a fully returned order
  // contributes nothing, so it isn't counted).
  orderCount: number;
  // Units sold, minus units returned.
  itemCount: number;
  // What the shop sold: unit prices less item AND order discounts, less
  // returns. This is the sales figure — NOT the money in hand, because an
  // order handed to the delivery company is only paid for later.
  revenue: string;
  // The part of `revenue` whose money has actually been collected (a counter
  // sale, or a courier order an Admin/Manager has settled).
  collectedRevenue: string;
  // The part still owed by the delivery company. Always
  // revenue - collectedRevenue, stated explicitly so the shop can read what
  // it is waiting for without doing the subtraction.
  pendingCollectionAmount: string;
  // How many orders that outstanding amount is spread over.
  pendingCollectionOrderCount: number;
  // How much was given away in discounts (both levels) on what stayed sold.
  discountAmount: string;
  averageOrderValue: string;

  // SENSITIVE (CLAUDE.md rule 19 — product.viewCost): ADMIN ONLY. Absent
  // entirely from anyone else's response, not zeroed.
  //
  // `cost` is cost of goods sold on what stayed sold; `profit` is the GROSS
  // profit (revenue - COGS) — what the shop earns before anything it spends
  // to keep the doors open. Net profit needs expenses, which cannot be
  // attributed to a single channel, so it lives on the report's own `profit`
  // block rather than here.
  cost?: string;
  profit?: string;
  // profit / revenue * 100, as a 2dp string. Null when revenue is 0 (there
  // is no margin on nothing) — a number here would be a divide-by-zero lie.
  margin?: string | null;
  // Sold lines whose product had no cost recorded at the time of sale. They
  // count as cost 0, so a non-zero number here means profit is optimistic —
  // the admin surfaces it rather than letting the figure quietly mislead.
  missingCostItems?: number;
}

// What came back. Kept separate from the totals above (which are already net
// of it) so "we sold 40 and 3 came back" is answerable.
export interface ReturnsTotals {
  orderCount: number;
  itemCount: number;
  amount: string;
}

export interface ChannelSales extends SalesTotals {
  channel: OrderChannel;
}

// One best-selling line: a variant when the product has them, the product
// itself otherwise. Names are the snapshots taken at sale time.
export interface TopSeller {
  productId: string | null;
  variantId: string | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  quantity: number;
  revenue: string;
  profit?: string;
}

// The money question the shop actually asks, answered without a single
// ambiguous number (spec.md "Cash drawer & expenses" -> Reporting). ADMIN
// ONLY — every field below is either a cost or derived from one.
//
// Three states of the same sales, never conflated:
//   sold     — what left the shop, net of discounts and returns;
//   received — the part that has actually been paid for;
//   owed     — the part the delivery company is still holding.
//   sold = received + owed, always.
//
// And two profits, each stated for BOTH "all sales" and "only what has been
// received", because a good month and a month that has been paid for are
// different months:
//   gross = sales - COGS
//   net   = gross - expenses (approved ones, cash or not) - gifts at cost
//
// Gifts are counted here and nowhere else: a gift earns nothing, so it is
// excluded from sales entirely, and what it cost the shop is subtracted as a
// cost of doing business rather than as cost of goods sold.
export interface ProfitTotals {
  sold: string;
  received: string;
  owed: string;
  // How many orders the outstanding amount is spread over.
  owedOrderCount: number;

  // Cost of goods sold, on everything sold and on the received part alone.
  cogs: string;
  receivedCogs: string;
  // Approved expenses dated inside the range (cash and non-cash alike — both
  // are money the shop spent).
  expenses: string;
  // What the stock given away this range cost the shop.
  giftCost: string;
  // Everything subtracted from gross to reach net: `expenses` + `giftCost`.
  // Stated rather than left for the reader to add up, so a screen showing
  // "what running the shop cost" never does money arithmetic of its own.
  overheads: string;

  grossProfit: string;
  netProfit: string;
  receivedGrossProfit: string;
  // Expenses are subtracted in full here too: a bill is owed whether or not
  // the delivery company has settled up yet.
  receivedNetProfit: string;

  // netProfit / sold * 100, as a 2dp string — what the shop actually keeps
  // out of what it sold. Null when nothing was sold: there is no margin on
  // no sales, and a 0% would read as a loss. Note this is the NET margin;
  // SalesTotals.margin is the gross one.
  netMargin: string | null;

  // Sold lines whose product had no cost recorded at the time of sale. They
  // count as zero, so a non-zero number here means both profits are
  // optimistic — surfaced rather than left to quietly mislead.
  missingCostItems: number;
}

// One period of the dashboard's summary. The sales figures every role may
// read are in `totals`; `profit` — sold/received/owed and the two profits —
// is ADMIN ONLY and simply absent for everyone else, so a screen renders what
// arrived rather than deciding a role for itself.
export interface PeriodSummary {
  totals: SalesTotals;
  profit?: ProfitTotals;
}

// GET /api/reports/sales-summary — today / this week / this month, which is
// exactly what the dashboard shows: its Today block reads `today`, and its
// period tabs switch between the three without another request.
export type SalesSummary = Record<ReportPeriod, PeriodSummary>;

// GET /api/reports/sales?from=&to= — the Reports page.
export interface SalesReport {
  // The instants the figures actually cover, resolved from the requested
  // local dates + offset. `to` is exclusive (local midnight after `to`).
  range: { from: string; to: string };
  totals: SalesTotals;
  // Sold vs. received vs. owed, gross vs. net. ADMIN ONLY — absent entirely
  // for every other role, like every other cost-derived figure.
  profit?: ProfitTotals;
  returns: ReturnsTotals;
  byChannel: ChannelSales[];
  topByRevenue: TopSeller[];
  topByQuantity: TopSeller[];
}
