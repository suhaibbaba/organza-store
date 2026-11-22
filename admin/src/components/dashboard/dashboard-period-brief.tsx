"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, Download } from "lucide-react";
import { can } from "@store/shared/lib/permissions";
import { Button, SegmentedControl, Typography } from "@store/ui";
import { Link } from "@/i18n/navigation";
import { DetailCard } from "@/components/layout/detail-card";
import { useSession } from "@/components/providers/session-provider";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { downloadCsv, exportFilename, toCsv } from "@/lib/export-csv";
import { cn } from "@/lib/utils";
import { DASHBOARD_BRIEF_PERIODS, DEFAULT_DASHBOARD_PERIOD } from "@/constants/dashboard";
import type { DashboardPeriodBriefProps } from "@/types/dashboard";
import type { ReportPeriod } from "@/types/report";
import { owedTotal } from "@/lib/report-figures";

// The Reports range that holds the same figures as the card: this week or this month.
function reportHref(period: ReportPeriod) {
  return { pathname: "/reports", query: { preset: period === "week" ? "thisWeek" : "thisMonth" } };
}

// Four figures for the week or the month; the breakdown lives on Reports, one link away.
export function DashboardPeriodBrief({ summary }: DashboardPeriodBriefProps) {
  const t = useTranslations("dashboard.period");
  const tBrief = useTranslations("dashboard.brief");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();
  const { user } = useSession();
  const { data: settings } = useSettingsQuery();
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_DASHBOARD_PERIOD);
  const { totals, profit } = summary[period];

  function exportPeriod() {
    const currency = settings?.currency ?? "";
    const rows: string[][] = [
      [t("exportColumns.figure"), t("exportColumns.amount", { currency })],
      [t("sold.label"), totals.revenue],
      [t("received.label"), totals.collectedRevenue],
      [tFigures("owed.label"), owedTotal(totals)],
    ];
    // No profit in a Manager's payload, so no cost/profit rows in their file.
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

  const figures = [
    { key: "sold", label: t("sold.label"), value: totals.revenue, tile: "bg-sunken", ink: "text-ink" },
    {
      key: "received",
      label: t("received.label"),
      value: totals.collectedRevenue,
      tile: "bg-success-50",
      ink: "text-success-700",
    },
    {
      key: "owed",
      label: tFigures("owed.label"),
      value: owedTotal(totals),
      tile: "bg-warning-50",
      ink: "text-warning-700",
    },
    ...(profit
      ? [
          {
            key: "net",
            label: tBrief("netProfit"),
            value: profit.netProfit,
            tile: "bg-primary-50",
            ink: "text-primary-900",
          },
        ]
      : []),
  ];

  return (
    <DetailCard
      icon={CalendarRange}
      title={t(`periods.${period}`)}
      data-testid="dashboard-period-brief"
      className="animate-rise [animation-delay:450ms]"
      action={
        <div className="w-max shrink-0">
          <SegmentedControl
            data-testid="dashboard-period"
            label={tBrief("choose")}
            options={DASHBOARD_BRIEF_PERIODS.map((value) => ({ value, label: t(`periods.${value}`) }))}
            value={period}
            onChange={setPeriod}
          />
        </div>
      }
    >
      <dl className={cn("grid grid-cols-2 gap-3", figures.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {figures.map((figure) => (
          <div
            key={figure.key}
            data-test-selector={`dashboard-period-${figure.key}`}
            className={cn("flex min-w-0 flex-col gap-1.5 rounded-panel p-4", figure.tile)}
          >
            <Typography variant="small" tone="muted" as="dt">
              {figure.label}
            </Typography>
            <dd className={cn("break-words text-section font-bold tabular-nums", figure.ink)}>
              {formatMoney(figure.value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {can(user, "dashboard.view") && (
          <Button
            type="button"
            variant="quiet"
            data-test-selector="dashboard-period-export"
            icon={<Download className="size-4" aria-hidden="true" />}
            onClick={exportPeriod}
          >
            {t("export")}
          </Button>
        )}
        {can(user, "report.view") && (
          <Link
            href={reportHref(period)}
            data-test-selector="dashboard-full-report"
            className="ms-auto rounded-control text-label font-medium text-primary-700 transition-colors hover:text-primary-900 focus-link"
          >
            {tBrief("fullReport")}
          </Link>
        )}
      </div>
    </DetailCard>
  );
}
