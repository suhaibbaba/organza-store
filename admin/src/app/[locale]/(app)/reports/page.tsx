"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSalesReportQuery } from "@/hooks/use-reports";
import { DEFAULT_REPORT_PRESET } from "@/constants/reports";
import { rangeForPreset } from "@/lib/report-range";
import { ReportRangePicker } from "@/components/reports/report-range-picker";
import { ReportHeadline } from "@/components/reports/report-headline";
import { ReportTrendChart } from "@/components/reports/report-trend-chart";
import { ReportChannelChart } from "@/components/reports/report-channel-chart";
import { ReportTopSellers } from "@/components/reports/report-top-sellers";
import { ReportReturnsCard } from "@/components/reports/report-returns-card";
import { ReportEmpty, ReportError, ReportLoading } from "@/components/reports/report-states";
import { Spinner } from "@/components/ui/spinner";
import type { ReportRangeValue } from "@/types/report";

// Sales & profit for a picked range (spec.md "Reports"). Access is gated on
// the backend: the report endpoints require order.view, and cost/profit are
// only computed for roles with product.viewCost — an Employee opening this
// page sees the same sales figures they already see on the orders list, and
// no cost or profit anywhere.
export default function ReportsPage() {
  const t = useTranslations("reports");
  const [range, setRange] = useState<ReportRangeValue>(() => rangeForPreset(DEFAULT_REPORT_PRESET));

  const { data, isLoading, isFetching, isError, error, refetch } = useSalesReportQuery(range.from, range.to);
  const isEmpty = data !== undefined && data.totals.orderCount === 0 && data.returns.itemCount === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ReportRangePicker value={range} onChange={setRange} />

      {isLoading ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError error={error} onRetry={() => void refetch()} />
      ) : data ? (
        <>
          {/* The previous range stays on screen while the next one loads, so
              this spinner is the only thing that changes mid-fetch. */}
          {isFetching && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t("updating")}
            </p>
          )}

          {isEmpty ? (
            <ReportEmpty />
          ) : (
            <>
              <ReportHeadline totals={data.totals} />
              <ReportTrendChart series={data.series} granularity={data.granularity} />
              <ReportChannelChart byChannel={data.byChannel} />
              <ReportTopSellers byRevenue={data.topByRevenue} byQuantity={data.topByQuantity} />
              <ReportReturnsCard returns={data.returns} />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
