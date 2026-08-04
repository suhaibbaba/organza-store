"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFigure } from "@/components/reports/report-figure";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { CHART_COLORS } from "@/constants/reports";
import type { SalesTotals } from "@/types/report";

// The numbers the whole page exists for, as large plain figures. Cost,
// profit and margin are simply absent from the API response for a role
// without permission to see them (CLAUDE.md rule 19), so the presence of the
// field — not a role check in the UI — decides what is rendered.
export function ReportHeadline({ totals }: { totals: SalesTotals }) {
  const t = useTranslations("reports.totals");
  const formatMoney = useMoneyFormatter();

  const showProfit = totals.profit !== undefined;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        <ReportFigure
          size="hero"
          seriesColor={CHART_COLORS.revenue}
          label={t("revenue")}
          value={formatMoney(totals.revenue)}
          hint={t("revenueHint", { orders: totals.orderCount, items: totals.itemCount })}
        />

        {showProfit && (
          <div className="grid grid-cols-2 gap-4">
            <ReportFigure
              seriesColor={CHART_COLORS.profit}
              label={t("profit")}
              value={formatMoney(totals.profit!)}
              // Margin is null when nothing sold — there is no percentage of
              // zero to state, so the line is simply left off.
              hint={
                totals.margin === null || totals.margin === undefined
                  ? undefined
                  : t("margin", { value: Number(totals.margin) / 100 })
              }
            />
            <ReportFigure label={t("cost")} value={formatMoney(totals.cost!)} />
          </div>
        )}

        {/* Sold is not the same as paid: an order handed to the delivery
            company is money the shop is still waiting for (spec.md "Payment
            collection"). Showing the two under revenue is what stops the
            headline figure being read as cash in hand. */}
        <div className="grid grid-cols-2 gap-4">
          <ReportFigure label={t("collected")} value={formatMoney(totals.collectedRevenue)} />
          <ReportFigure
            label={t("pendingCollection")}
            value={formatMoney(totals.pendingCollectionAmount)}
            hint={
              totals.pendingCollectionOrderCount > 0
                ? t("pendingCollectionOrders", { count: totals.pendingCollectionOrderCount })
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ReportFigure label={t("averageOrder")} value={formatMoney(totals.averageOrderValue)} />
          <ReportFigure label={t("discounts")} value={formatMoney(totals.discountAmount)} />
        </div>

        {/* Profit is only as honest as the costs behind it — say so plainly
            rather than letting an inflated figure pass as fact. */}
        {showProfit && (totals.missingCostItems ?? 0) > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("missingCost", { count: totals.missingCostItems! })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
