"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StatCard } from "@/components/layout/stat-card";
import { PeriodControls } from "@/components/dashboard/period-controls";
import { DEFAULT_DASHBOARD_PERIOD } from "@/constants/dashboard";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReportPeriod, SalesSummary } from "@/types/report";

// The same three states of money as the Today block, over a longer window,
// plus what it cost to earn them.
//
// Every figure here comes from ONE request (the dashboard's summary carries
// today, this week and this month together), so switching period is instant
// and can never show two periods' figures side by side mid-fetch.
//
// Which period is on screen is chosen at the top of THIS block
// (dashboard/period-controls.tsx), not in the page header. Up there the tabs
// sat directly over the Today block — which never changes — while the figures
// they switched were two phone screens further down: a tap looked like it did
// nothing, and "This month" read as labelling today's numbers.
//
// The cost and profit cards are ADMIN ONLY: `profit` is simply missing from a
// Manager's payload, so there is nothing to render and no empty placeholder.
export function PeriodSection({ summary }: { summary: SalesSummary }) {
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_DASHBOARD_PERIOD);
  const t = useTranslations("dashboard.period");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  const { totals, profit } = summary[period];

  return (
    <section className="flex flex-col gap-3">
      {/* The heading names the period being shown, so the figures below can
          never be read as belonging to some other window; the control that
          changes it sits right beside it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t(`periods.${period}`)}</h2>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <PeriodControls period={period} onPeriodChange={setPeriod} summary={summary} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard name="sold"
          label={t("sold.label")}
          tooltip={tFigures("sold.help")}
          value={formatMoney(totals.revenue)}
          hint={t("sold.hint")}
        />

        <StatCard name="received"
          tone="success"
          label={t("received.label")}
          tooltip={tFigures("received.help")}
          value={formatMoney(totals.collectedRevenue)}
          hint={t("received.hint")}
        />

        <StatCard name="owed"
          tone="warning"
          label={tFigures("owed.label")}
          tooltip={tFigures("owed.help")}
          value={formatMoney(totals.pendingCollectionAmount)}
          hint={t("owed.hint")}
        />

        {profit && (
          <>
            <StatCard name="cogs"
              label={t("cogs.label")}
              tooltip={t("cogs.help")}
              value={formatMoney(profit.cogs)}
              hint={t("cogs.hint")}
            />

            <StatCard name="expenses"
              label={t("expenses.label")}
              tooltip={t("expenses.help")}
              value={formatMoney(profit.overheads)}
              hint={t("expenses.hint")}
            />

            {/* The two profits, side by side on purpose: one of them counts
                money the delivery company is still holding, and the other
                does not. Showing either alone is what makes a "profit"
                figure ambiguous. */}
            <StatCard name="profit-all"
              label={t("profitAll.label")}
              tooltip={t("profitAll.help")}
              value={formatMoney(profit.netProfit)}
              hint={t("profitAll.hint")}
            />

            <StatCard name="profit-received"
              tone="success"
              label={t("profitReceived.label")}
              tooltip={t("profitReceived.help")}
              value={formatMoney(profit.receivedNetProfit)}
              hint={t("profitReceived.hint")}
            />

            <StatCard name="margin"
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
