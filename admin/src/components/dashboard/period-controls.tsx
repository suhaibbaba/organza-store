"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { REPORT_PERIODS } from "@organza/shared/constants/report";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/providers/session-provider";
import { useSettingsQuery } from "@/hooks/use-settings";
import { downloadCsv, exportFilename, toCsv } from "@/lib/export-csv";
import type { ReportPeriod, SalesSummary } from "@/types/report";

interface PeriodControlsProps {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  summary: SalesSummary;
}

// Which window the figures block is showing, and the button that takes it
// away as a spreadsheet. They sit in the page header rather than above the
// block itself so the desktop layout has one row of controls instead of one
// per section — the state still belongs to the figures block, and the block's
// own heading goes on naming the period being shown.
export function PeriodControls({ period, onPeriodChange, summary }: PeriodControlsProps) {
  const t = useTranslations("dashboard.period");
  const tFigures = useTranslations("figures");
  const { user } = useSession();
  const { data: settings } = useSettingsQuery();
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
    <>
      {/* Sized to its labels, not to the row: a full-width tab strip on a
          desktop puts "Today" and "This month" a hand's width apart. The
          labels never wrap or truncate either — both are TabsList's own doing
          now, so every tab row in the app behaves the same way. */}
      <Tabs value={period} onValueChange={(value) => onPeriodChange(value as ReportPeriod)}>
        <TabsList>
          {REPORT_PERIODS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`periods.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {canExport && (
        <Button type="button" variant="outline" className="h-11 shrink-0" onClick={exportPeriod}>
          <Download className="size-4" aria-hidden="true" />
          {t("export")}
        </Button>
      )}
    </>
  );
}
