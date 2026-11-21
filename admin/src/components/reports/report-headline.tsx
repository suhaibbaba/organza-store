"use client";

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReportHeadlineProps } from "@/types/report";

// Sold, received and owed always together, so sales never reads as cash in hand.
export function ReportHeadline({ totals }: ReportHeadlineProps) {
  const t = useTranslations("reports.totals");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-test-selector="reports-headline">
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
    </div>
  );
}
