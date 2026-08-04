import { Router } from "express";
import { can } from "@shared/lib/permissions";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateQuery } from "@/middleware/validate";
import { sendOk } from "@/lib/response";
import { granularityFor, periodRange, pickedRange } from "@/lib/reportRange";
import {
  queryChannelTotals,
  querySeries,
  queryTopSellers,
  queryTotals,
  toChannelSales,
  toReturnsTotals,
  toSalesTotals,
  toSeries,
  toTopSellers,
} from "@/lib/reports";
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
// Two gates, both enforced here rather than in the UI:
//   * order.view  — reaching the reports at all. Everyone who may look at a
//                   sale may look at the totals of those sales, Employees
//                   included (they already see order totals in the list).
//   * product.viewCost — cost, profit and margin. Admin + Manager only, the
//                   same permission that hides `cost` on products and
//                   `unitCost` on order lines (CLAUDE.md rule 19). Below
//                   that, those fields are never computed into the response
//                   at all, so there is nothing to un-hide client-side.
const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/reports/sales-summary — the dashboard's Sales & Profit block:
// today / this week / this month, each on the caller's own clock (tzOffset).
// ---------------------------------------------------------------------------
router.get(
  "/sales-summary",
  requirePermission("order.view"),
  validateQuery(salesSummaryQuerySchema),
  asyncHandler(async (req, res) => {
    const { tzOffset } = req.validatedQuery as SalesSummaryQuery;
    const canViewCost = can(req.user!, "product.viewCost");
    // One `now` for all three periods, so the figures can't disagree about
    // what time it is halfway through the request.
    const now = new Date();

    const rows = await Promise.all(
      REPORT_PERIODS.map((period) => queryTotals(periodRange(period, tzOffset, now)))
    );

    const summary = REPORT_PERIODS.reduce((acc, period, index) => {
      acc[period] = toSalesTotals(rows[index], canViewCost);
      return acc;
    }, {} as SalesSummary);

    sendOk(res, summary);
  })
);

// ---------------------------------------------------------------------------
// GET /api/reports/sales?from=&to= — the Reports page: totals, returns, the
// channel split, a trend series and the best sellers for a picked range.
// Every part is aggregated by Postgres; no order is ever loaded into memory.
// ---------------------------------------------------------------------------
router.get(
  "/sales",
  requirePermission("order.view"),
  validateQuery(salesReportQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as SalesReportQuery;
    const canViewCost = can(req.user!, "product.viewCost");

    const range = pickedRange(query.from, query.to, query.tzOffset);
    const granularity = granularityFor(range);

    const [totals, channels, series, topByRevenue, topByQuantity] = await Promise.all([
      queryTotals(range),
      queryChannelTotals(range),
      querySeries(range, granularity, query.tzOffset),
      queryTopSellers(range, "revenue", query.topLimit),
      queryTopSellers(range, "quantity", query.topLimit),
    ]);

    const report: SalesReport = {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      granularity,
      totals: toSalesTotals(totals, canViewCost),
      returns: toReturnsTotals(totals),
      byChannel: toChannelSales(channels, canViewCost),
      series: toSeries(series, canViewCost),
      topByRevenue: toTopSellers(topByRevenue, canViewCost),
      topByQuantity: toTopSellers(topByQuantity, canViewCost),
    };

    sendOk(res, report);
  })
);

export default router;
