"use client";

import { useTranslations } from "next-intl";
import { FigureCard } from "@/components/figures/figure-card";
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

      <div className="grid grid-cols-2 gap-3">
        <FigureCard
          tone="positive"
          label={tFigures("sold.label")}
          description={tFigures("sold.help")}
          toggleLabel={tFigures("explain", { label: tFigures("sold.label") })}
          value={formatMoney(totals.revenue)}
          subtitle={t("orders", { count: totals.orderCount })}
        />

        <FigureCard
          tone="positive"
          label={tFigures("received.label")}
          description={tFigures("received.help")}
          toggleLabel={tFigures("explain", { label: tFigures("received.label") })}
          value={formatMoney(totals.collectedRevenue)}
          subtitle={t("receivedHint")}
        />

        <FigureCard
          tone="warning"
          label={tFigures("owed.label")}
          description={tFigures("owed.help")}
          toggleLabel={tFigures("explain", { label: tFigures("owed.label") })}
          value={formatMoney(totals.pendingCollectionAmount)}
          subtitle={t("owedOrders", { count: totals.pendingCollectionOrderCount })}
        />

        {profit && (
          <FigureCard
            label={t("profit.label")}
            description={t("profit.help")}
            toggleLabel={tFigures("explain", { label: t("profit.label") })}
            value={formatMoney(profit.netProfit)}
            subtitle={t("profit.hint")}
          />
        )}
      </div>
    </section>
  );
}
