"use client";

import { useTranslations } from "next-intl";
import { Alert } from "@store/ui";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { SalesTotals } from "@/types/report";

// Sold / Received / Still owed always all three so sales never reads as cash in hand; cost/profit render only when the API sent them (rule 19).
export function ReportHeadline({ totals }: { totals: SalesTotals }) {
  const t = useTranslations("reports.totals");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  const showProfit = totals.profit !== undefined;
  const hasMargin = totals.margin !== null && totals.margin !== undefined;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink">{t("title")}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          name="sold"
          label={tFigures("sold.label")}
          tooltip={tFigures("sold.help")}
          value={formatMoney(totals.revenue)}
          hint={t("soldHint", { orders: totals.orderCount, items: totals.itemCount })}
        />

        <StatCard
          name="received"
          tone="success"
          label={tFigures("received.label")}
          tooltip={tFigures("received.help")}
          value={formatMoney(totals.collectedRevenue)}
        />

        {/* Amber: "still owed" is the figure to chase and must never look like takings. */}
        <StatCard
          name="owed"
          tone="warning"
          label={tFigures("owed.label")}
          tooltip={tFigures("owed.help")}
          value={formatMoney(totals.pendingCollectionAmount)}
          hint={
            totals.pendingCollectionOrderCount > 0
              ? t("owedOrders", { count: totals.pendingCollectionOrderCount })
              : undefined
          }
        />

        <StatCard
          name="average-order"
          label={t("averageOrder.label")}
          tooltip={t("averageOrder.help")}
          value={formatMoney(totals.averageOrderValue)}
        />

        <StatCard
          name="discounts"
          label={t("discounts.label")}
          tooltip={t("discounts.help")}
          value={formatMoney(totals.discountAmount)}
        />

        {showProfit && (
          <>
            <StatCard name="cost" label={t("cost.label")} tooltip={t("cost.help")} value={formatMoney(totals.cost!)} />

            <StatCard
              name="profit"
              label={t("profit.label")}
              tooltip={t("profit.help")}
              value={formatMoney(totals.profit!)}
              // Margin is null when nothing sold.
              hint={hasMargin ? t("margin", { value: Number(totals.margin) / 100 }) : undefined}
            />
          </>
        )}
      </div>

      {/* Profit is only as honest as the costs behind it. */}
      {showProfit && (totals.missingCostItems ?? 0) > 0 && (
        <Alert tone="warning">{t("missingCost", { count: totals.missingCostItems! })}</Alert>
      )}
    </section>
  );
}
