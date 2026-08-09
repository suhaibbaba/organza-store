"use client";

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReportPeriod, SalesSummary } from "@/types/report";

// The same three states of money as the Today block, over a longer window,
// plus what it cost to earn them.
//
// Every figure here comes from ONE request (the dashboard's summary carries
// today, this week and this month together), so switching period is instant
// and can never show two periods' figures side by side mid-fetch.
//
// Which period is on screen is chosen in the page header
// (dashboard/period-controls.tsx) — the heading below still names it, so the
// figures can never be read as belonging to some other window.
//
// The cost and profit cards are ADMIN ONLY: `profit` is simply missing from a
// Manager's payload, so there is nothing to render and no empty placeholder.
export function PeriodSection({ summary, period }: { summary: SalesSummary; period: ReportPeriod }) {
  const t = useTranslations("dashboard.period");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  const { totals, profit } = summary[period];

  return (
    <section className="flex flex-col gap-3">
      {/* The heading names the period being shown, so the figures below can
          never be read as belonging to some other window. */}
      <h2 className="text-base font-semibold">{t(`periods.${period}`)}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("sold.label")}
          tooltip={tFigures("sold.help")}
          value={formatMoney(totals.revenue)}
          hint={t("sold.hint")}
        />

        <StatCard
          tone="success"
          label={t("received.label")}
          tooltip={tFigures("received.help")}
          value={formatMoney(totals.collectedRevenue)}
          hint={t("received.hint")}
        />

        <StatCard
          tone="warning"
          label={tFigures("owed.label")}
          tooltip={tFigures("owed.help")}
          value={formatMoney(totals.pendingCollectionAmount)}
          hint={t("owed.hint")}
        />

        {profit && (
          <>
            <StatCard
              label={t("cogs.label")}
              tooltip={t("cogs.help")}
              value={formatMoney(profit.cogs)}
              hint={t("cogs.hint")}
            />

            <StatCard
              label={t("expenses.label")}
              tooltip={t("expenses.help")}
              value={formatMoney(profit.overheads)}
              hint={t("expenses.hint")}
            />

            {/* The two profits, side by side on purpose: one of them counts
                money the delivery company is still holding, and the other
                does not. Showing either alone is what makes a "profit"
                figure ambiguous. */}
            <StatCard
              label={t("profitAll.label")}
              tooltip={t("profitAll.help")}
              value={formatMoney(profit.netProfit)}
              hint={t("profitAll.hint")}
            />

            <StatCard
              tone="success"
              label={t("profitReceived.label")}
              tooltip={t("profitReceived.help")}
              value={formatMoney(profit.receivedNetProfit)}
              hint={t("profitReceived.hint")}
            />

            <StatCard
              label={t("margin.label")}
              tooltip={t("margin.help")}
              // Null when nothing was sold — there is no margin on no sales,
              // and a 0% would read as a loss.
              value={
                profit.netMargin === null
                  ? t("margin.none")
                  : t("margin.value", { value: Number(profit.netMargin) / 100 })
              }
              hint={t("margin.hint")}
            />
          </>
        )}
      </div>
    </section>
  );
}
