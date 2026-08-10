import { Router } from "express";
import { can } from "@organza/shared/lib/permissions";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateQuery } from "@/middleware/validate";
import { sendOk } from "@/lib/response";
import { periodRange, pickedRange } from "@/lib/reportRange";
import {
  queryChannelTotals,
  queryGiftCost,
  queryTopSellers,
  queryTotals,
  toChannelSales,
  toProfitTotals,
  toReturnsTotals,
  toSalesTotals,
  toTopSellers,
} from "@/lib/reports";
import { expenseTotal, queryExpenseTotals } from "@/lib/expenses";
import {
  salesReportQuerySchema,
  salesSummaryQuerySchema,
  type SalesReportQuery,
  type SalesSummaryQuery,
} from "@/validation/report";
import { REPORT_PERIODS } from "@/constants";
import type { SalesReport, SalesSummary } from "@/types";

// Sales & profit reporting (spec.md "Reports" / "Dashboard"), Phase 2.
//
// Nothing here is reachable with order.view, which is what it used to take.
// That permission exists so somebody can ring up a sale and follow the orders
// they took — an Employee holds it — and hanging the reports off it handed
// them every sale in the shop added up. Reading ONE order is not reading ALL
// of them, so each endpoint is gated on the screen it actually serves:
//
//   * report.view    — the Reports page (/sales). ADMIN ONLY.
//   * dashboard.view — the dashboard's Sales block (/sales-summary), which is
//                      Admin/Manager, exactly like the rest of that screen.
//
// An Employee holds neither, so both 403 for them: no sales figure of any
// kind reaches an Employee, not a partial one and not a zeroed one.
//
// On top of that, and independent of it:
//   * product.viewCost — cost, COGS, profit and margin. ADMIN ONLY, the same
//                   permission that hides `cost` on products and `unitCost`
//                   on order lines (CLAUDE.md rule 19). Below that, those
//                   fields are never computed into the response at all, so
//                   there is nothing to un-hide client-side — and the whole
//                   `profit` block (sold/received/owed, gross and net) is
//                   simply absent.
const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/reports/sales-summary — the dashboard's Sales & Profit block:
// today / this week / this month, each on the caller's own clock (tzOffset).
// ---------------------------------------------------------------------------
router.get(
  "/sales-summary",
  requirePermission("dashboard.view"),
  validateQuery(salesSummaryQuerySchema),
  asyncHandler(async (req, res) => {
    const { tzOffset } = req.validatedQuery as SalesSummaryQuery;
    const canViewCost = can(req.user!, "product.viewCost");
    // One `now` for all three periods, so the figures can't disagree about
    // what time it is halfway through the request.
    const now = new Date();

    // Gifts and expenses are only read for the profit block, which is
    // Admin-only — so below that permission they aren't queried at all.
    const periods = await Promise.all(
      REPORT_PERIODS.map(async (period) => {
        const range = periodRange(period, tzOffset, now);
        const [totals, gifts, expenses] = await Promise.all([
          queryTotals(range),
          canViewCost ? queryGiftCost(range) : undefined,
          canViewCost ? queryExpenseTotals(range) : undefined,
        ]);
        return { totals, gifts, expenses };
      })
    );

    const summary = REPORT_PERIODS.reduce((acc, period, index) => {
      const { totals, gifts, expenses } = periods[index];
      acc[period] = {
        totals: toSalesTotals(totals, canViewCost),
        ...(canViewCost ? { profit: toProfitTotals(totals, gifts, expenseTotal(expenses)) } : {}),
      };
      return acc;
    }, {} as SalesSummary);

    sendOk(res, summary);
  })
);

// ---------------------------------------------------------------------------
// GET /api/reports/sales?from=&to= — the Reports page: totals, returns, the
// channel split and the best sellers for a picked range. Every part is
// aggregated by Postgres; no order is ever loaded into memory.
// ---------------------------------------------------------------------------
router.get(
  "/sales",
  requirePermission("report.view"),
  validateQuery(salesReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as SalesReportQuery;
    const canViewCost = can(req.user!, "product.viewCost");

    const range = pickedRange(query.from, query.to, query.tzOffset);

    const [totals, channels, topByRevenue, topByQuantity, gifts, expenses] = await Promise.all([
      queryTotals(range),
      queryChannelTotals(range),
      queryTopSellers(range, "revenue", query.topLimit),
      queryTopSellers(range, "quantity", query.topLimit),
      // Only ever read for the profit block below, which is Admin-only —
      // but cheap enough that branching the fan-out would buy nothing.
      queryGiftCost(range),
      queryExpenseTotals(range),
    ]);

    const report: SalesReport = {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: toSalesTotals(totals, canViewCost),
      returns: toReturnsTotals(totals),
      byChannel: toChannelSales(channels, canViewCost),
      topByRevenue: toTopSellers(topByRevenue, canViewCost),
      topByQuantity: toTopSellers(topByQuantity, canViewCost),
    };

    // Sold vs. received vs. owed, gross vs. net — the block that answers the
    // money question without a single ambiguous number. Attached only for a
    // role that may see cost, because every figure in it is derived from one.
    if (canViewCost) {
      report.profit = toProfitTotals(totals, gifts, expenseTotal(expenses));
    }

    sendOk(res, report);
  })
);

export default router;
