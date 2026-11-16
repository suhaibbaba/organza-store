"use client";

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { PeriodSummary } from "@/types/report";

// What happened today, in the three states money can be in — never one vague
// "revenue" (spec.md "Cash drawer & expenses" -> Reporting):
//
//   Sold      — what left the shop today;
//   Received  — the part of it the shop is actually holding;
//   Still owed — the part the delivery company is holding, in amber because
//                it is the figure to chase, not takings.
//
// Sold = Received + Still owed, always, which is why all three are on screen
// at once: any two of them invite the wrong subtraction.
//
// The profit card is ADMIN ONLY and is simply absent otherwise — `profit` is
// missing from a Manager's payload (the backend never computes it), so there
// is no empty card to render and nothing to un-hide.
export function TodaySection({ summary }: { summary: PeriodSummary }) {
  const t = useTranslations("dashboard.today");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();
  const { totals, profit } = summary;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("title")}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard name="sold"
          tone="success"
          label={tFigures("sold.label")}
          tooltip={tFigures("sold.help")}
          value={formatMoney(totals.revenue)}
          hint={t("orders", { count: totals.orderCount })}
        />

        <StatCard name="received"
          tone="success"
          label={tFigures("received.label")}
          tooltip={tFigures("received.help")}
          value={formatMoney(totals.collectedRevenue)}
          hint={t("receivedHint")}
        />

        <StatCard name="owed"
          tone="warning"
          label={tFigures("owed.label")}
          tooltip={tFigures("owed.help")}
          value={formatMoney(totals.pendingCollectionAmount)}
          hint={t("owedOrders", { count: totals.pendingCollectionOrderCount })}
        />

        {profit && (
          <StatCard name="profit"
            label={t("profit.label")}
            tooltip={t("profit.help")}
            value={formatMoney(profit.netProfit)}
            hint={t("profit.hint")}
          />
        )}
      </div>
    </section>
  );
}
