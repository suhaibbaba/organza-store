"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { can } from "@store/shared/lib/permissions";
import { Button, Tabs } from "@store/ui";
import { DASHBOARD_PERIOD_TABS } from "@/constants/dashboard";
import { useSession } from "@/components/providers/session-provider";
import { useSettingsQuery } from "@/hooks/use-settings";
import { downloadCsv, exportFilename, toCsv } from "@/lib/export-csv";
import type { ReportPeriod, SalesSummary } from "@/types/report";

interface PeriodControlsProps {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  summary: SalesSummary;
}

// Sits beside the heading naming the period: a control has to be next to what it changes.
export function PeriodControls({ period, onPeriodChange, summary }: PeriodControlsProps) {
  const t = useTranslations("dashboard.period");
  const tFigures = useTranslations("figures");
  const { user } = useSession();
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? "";

  const { totals, profit } = summary[period];

  // Whoever can read these figures can take them away.
  const canExport = can(user, "dashboard.view");

  function exportPeriod() {
    const rows: string[][] = [
      // Currency (from Settings) named in the header so cells stay numbers a spreadsheet can add.
      [t("exportColumns.figure"), t("exportColumns.amount", { currency })],
      [t("sold.label"), totals.revenue],
      [t("received.label"), totals.collectedRevenue],
      [tFigures("owed.label"), totals.pendingCollectionAmount],
    ];

    // A Manager's payload has no profit, so their export has no cost/profit rows.
    if (profit) {
      rows.push(
        [t("cogs.label"), profit.cogs],
        [t("expenses.label"), profit.overheads],
        [t("profitAll.label"), profit.netProfit],
        [t("profitReceived.label"), profit.receivedNetProfit],
      );
      if (profit.netMargin !== null) {
        rows.push([t("margin.label"), profit.netMargin]);
      }
    }

    downloadCsv(exportFilename(period, new Date()), toCsv(rows));
  }

  return (
    <>
      <Tabs tabs={DASHBOARD_PERIOD_TABS} value={period} onChange={onPeriodChange} label="dashboard.period.choose" />

      {canExport && (
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          icon={<Download className="size-4" aria-hidden="true" />}
          onClick={exportPeriod}
        >
          {t("export")}
        </Button>
      )}
    </>
  );
}
