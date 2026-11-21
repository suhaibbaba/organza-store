import { Router } from "express";
import { can } from "@store/shared/lib/permissions";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateQuery } from "@/middleware/validate";
import { sendOk } from "@/lib/response";
import { periodRange, pickedRange } from "@/lib/reportRange";
import {
  queryChannelTotals,
  queryGiftCost,
  queryTopSellers,
  queryTopSellerThumbnails,
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

// Reports are gated on the screen they serve (report.view, dashboard.view), never on order.view (rule 19).
const router = Router();
router.use(requireAuth);

// GET /api/reports/sales-summary — today / this week / this month on the caller's clock.
router.get(
  "/sales-summary",
  requirePermission("dashboard.view"),
  validateQuery(salesSummaryQuerySchema),
  asyncHandler(async (req, res) => {
    const { tzOffset } = req.validatedQuery as SalesSummaryQuery;
    const canViewCost = can(req.user!, "product.viewCost");
    // One `now` for all three periods.
    const now = new Date();

    // Gifts and expenses feed only the Admin-only profit block, so they are skipped below it.
    const periods = await Promise.all(
      REPORT_PERIODS.map(async (period) => {
        const range = periodRange(period, tzOffset, now);
        const [totals, gifts, expenses] = await Promise.all([
          queryTotals(range),
          canViewCost ? queryGiftCost(range) : undefined,
          canViewCost ? queryExpenseTotals(range) : undefined,
        ]);
        return { totals, gifts, expenses };
      }),
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
  }),
);

// GET /api/reports/sales?from=&to= — totals, returns, channels and best sellers, all aggregated in Postgres.
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
      // Only used by the Admin-only profit block, but cheap enough to always fetch.
      queryGiftCost(range),
      queryExpenseTotals(range),
    ]);

    const thumbnails = await queryTopSellerThumbnails([...topByRevenue, ...topByQuantity]);

    const report: SalesReport = {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: toSalesTotals(totals, canViewCost),
      returns: toReturnsTotals(totals),
      byChannel: toChannelSales(channels, canViewCost),
      topByRevenue: toTopSellers(topByRevenue, canViewCost, thumbnails),
      topByQuantity: toTopSellers(topByQuantity, canViewCost, thumbnails),
    };

    // Sold/received/owed and gross/net, attached only for a role that may see cost.
    if (canViewCost) {
      report.profit = toProfitTotals(totals, gifts, expenseTotal(expenses));
    }

    sendOk(res, report);
  }),
);

export default router;
