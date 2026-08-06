"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { can } from "@shared/lib/permissions";
import { REPORT_PERIODS } from "@shared/constants/report";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FigureCard } from "@/components/dashboard/figure-card";
import { useSession } from "@/components/providers/session-provider";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useSettingsQuery } from "@/hooks/use-settings";
import { DEFAULT_DASHBOARD_PERIOD } from "@/constants/dashboard";
import { downloadCsv, exportFilename, toCsv } from "@/lib/export-csv";
import type { ReportPeriod, SalesSummary } from "@/types/report";

// The same three states of money as the Today block, over a longer window,
// plus what it cost to earn them.
//
// Every figure here comes from ONE request (the dashboard's summary carries
// today, this week and this month together), so switching period is instant
// and can never show two periods' figures side by side mid-fetch.
//
// The cost and profit cards are ADMIN ONLY: `profit` is simply missing from a
// Manager's payload, so there is nothing to render and no empty placeholder.
export function PeriodSection({ summary }: { summary: SalesSummary }) {
  const t = useTranslations("dashboard.period");
  const tFigures = useTranslations("dashboard.figures");
  const formatMoney = useMoneyFormatter();
  const { user } = useSession();
  const { data: settings } = useSettingsQuery();
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_DASHBOARD_PERIOD);
  const currency = settings?.currency ?? "";

  const { totals, profit } = summary[period];

  // Visible to Admin and Manager. Gated on the permission that reaches this
  // screen at all rather than invented: the dashboard is Admin/Manager, so
  // this says "everyone who can read these figures can take them away".
  const canExport = can(user, "dashboard.view");

  function exportPeriod() {
    const rows: string[][] = [
      // Labels exactly as they read on screen, and the currency named in the
      // header rather than glued to each cell — the values stay numbers a
      // spreadsheet can add up. The code comes from Settings like every other
      // amount (CLAUDE.md rule 14).
      [t("exportColumns.figure"), t("exportColumns.amount", { currency })],
      [t("sold.label"), totals.revenue],
      [t("received.label"), totals.collectedRevenue],
      [tFigures("owed.label"), totals.pendingCollectionAmount],
    ];

    // Only what the caller was actually sent — a Manager's export has no
    // cost or profit rows because their payload has none.
    if (profit) {
      rows.push(
        [t("cogs.label"), profit.cogs],
        [t("expenses.label"), profit.overheads],
        [t("profitAll.label"), profit.netProfit],
        [t("profitReceived.label"), profit.receivedNetProfit]
      );
      if (profit.netMargin !== null) rows.push([t("margin.label"), profit.netMargin]);
    }

    downloadCsv(exportFilename(period, new Date()), toCsv(rows));
  }

  return (
    <section className="flex flex-col gap-3">
      {/* The heading names the period being shown, so the figures below can
          never be read as belonging to some other window. */}
      <h2 className="text-base font-semibold">{t(`periods.${period}`)}</h2>

      <div className="flex flex-wrap items-center gap-3">
        {/* The tabs take a whole row of their own (w-full pushes the export
            button onto the next line on a phone). Sharing the row squeezes
            them until a label is cut in half, and a tab reading "This m…" is
            a tab nobody trusts. */}
        <Tabs value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)} className="w-full">
          <TabsList className="flex w-full">
            {REPORT_PERIODS.map((key) => (
              <TabsTrigger key={key} value={key} className="whitespace-nowrap px-2">
                {t(`periods.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ms-auto, not mr/ml: it sits at the reading-end of the row, which
            is the left edge in Arabic and the right in English. */}
        {canExport && (
          <Button type="button" variant="outline" className="ms-auto h-11" onClick={exportPeriod}>
            <Download className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FigureCard
          label={t("sold.label")}
          description={tFigures("sold.help")}
          toggleLabel={tFigures("explain", { label: t("sold.label") })}
          value={formatMoney(totals.revenue)}
          subtitle={t("sold.hint")}
        />

        <FigureCard
          tone="positive"
          label={t("received.label")}
          description={tFigures("received.help")}
          toggleLabel={tFigures("explain", { label: t("received.label") })}
          value={formatMoney(totals.collectedRevenue)}
          subtitle={t("received.hint")}
        />

        <FigureCard
          tone="warning"
          label={tFigures("owed.label")}
          description={tFigures("owed.help")}
          toggleLabel={tFigures("explain", { label: tFigures("owed.label") })}
          value={formatMoney(totals.pendingCollectionAmount)}
          subtitle={t("owed.hint")}
        />

        {profit && (
          <>
            <FigureCard
              label={t("cogs.label")}
              description={t("cogs.help")}
              toggleLabel={tFigures("explain", { label: t("cogs.label") })}
              value={formatMoney(profit.cogs)}
              subtitle={t("cogs.hint")}
            />

            <FigureCard
              label={t("expenses.label")}
              description={t("expenses.help")}
              toggleLabel={tFigures("explain", { label: t("expenses.label") })}
              value={formatMoney(profit.overheads)}
              subtitle={t("expenses.hint")}
            />

            {/* The two profits, side by side on purpose: one of them counts
                money the delivery company is still holding, and the other
                does not. Showing either alone is what makes a "profit"
                figure ambiguous. */}
            <FigureCard
              label={t("profitAll.label")}
              description={t("profitAll.help")}
              toggleLabel={tFigures("explain", { label: t("profitAll.label") })}
              value={formatMoney(profit.netProfit)}
              subtitle={t("profitAll.hint")}
            />

            <FigureCard
              tone="positive"
              label={t("profitReceived.label")}
              description={t("profitReceived.help")}
              toggleLabel={tFigures("explain", { label: t("profitReceived.label") })}
              value={formatMoney(profit.receivedNetProfit)}
              subtitle={t("profitReceived.hint")}
            />

            <FigureCard
              label={t("margin.label")}
              description={t("margin.help")}
              toggleLabel={tFigures("explain", { label: t("margin.label") })}
              // Null when nothing was sold — there is no margin on no sales,
              // and a 0% would read as a loss.
              value={
                profit.netMargin === null
                  ? t("margin.none")
                  : t("margin.value", { value: Number(profit.netMargin) / 100 })
              }
              subtitle={t("margin.hint")}
            />
          </>
        )}
      </div>
    </section>
  );
}
