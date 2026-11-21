"use client";

import { useTranslations } from "next-intl";
import { Spinner, Typography } from "@store/ui";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSalesReportQuery } from "@/hooks/use-reports";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { DEFAULT_REPORT_RANGE, REPORT_RANGE_URL_PARAMS } from "@/constants/reports";
import { rangeForPreset } from "@/lib/report-range";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ReportRangePicker } from "@/components/reports/report-range-picker";
import { ReportHeadline } from "@/components/reports/report-headline";
import { ReportProfitStatement } from "@/components/reports/report-profit-statement";
import { ReportOrdersCard } from "@/components/reports/report-orders-card";
import { ReportChannelsCard } from "@/components/reports/report-channels-card";
import { ReportTopSellers } from "@/components/reports/report-top-sellers";
import { ReportReturnsCard } from "@/components/reports/report-returns-card";
import { ReportEmpty, ReportError, ReportLoading } from "@/components/reports/report-states";
import type { ReportRangeValue } from "@/types/report";

// Sales & profit behind report.view (the API refuses regardless); figures, no chart: read standing at a counter.
export default function ReportsPage() {
  return (
    <RoleGuard action="report.view">
      <ReportsPageContent />
    </RoleGuard>
  );
}

function ReportsPageContent() {
  const t = useTranslations("reports");
  const [filters, changeFilters] = useUrlFilters(DEFAULT_REPORT_RANGE, REPORT_RANGE_URL_PARAMS);
  const range = rangeForPreset(filters.preset, filters);

  const { data, isLoading, isFetching, isError, error, refetch } = useSalesReportQuery(range.from, range.to);
  const isEmpty = data !== undefined && data.totals.orderCount === 0 && data.returns.itemCount === 0;

  function changeRange(next: ReportRangeValue) {
    changeFilters(next.preset === "custom" ? next : { preset: next.preset, from: "", to: "" });
  }

  function renderBody() {
    if (isLoading) {
      return <ReportLoading />;
    }
    if (isError) {
      return <ReportError error={error} onRetry={() => void refetch()} />;
    }
    if (!data) {
      return null;
    }
    if (isEmpty) {
      return <ReportEmpty />;
    }
    return (
      <div className="flex flex-col gap-5">
        <ReportHeadline totals={data.totals} />
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-5">
            {data.profit && <ReportProfitStatement profit={data.profit} />}
            <ReportTopSellers byRevenue={data.topByRevenue} byQuantity={data.topByQuantity} />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <ReportOrdersCard totals={data.totals} />
            <ReportChannelsCard byChannel={data.byChannel} />
            <ReportReturnsCard returns={data.returns} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader name="reports" title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <ReportRangePicker value={range} onChange={changeRange} />
          {/* The previous range stays on screen while the next one loads. */}
          {isFetching && !isLoading && (
            <Typography
              variant="small"
              tone="muted"
              as="p"
              className="flex items-center gap-2"
              data-test-selector="reports-updating"
            >
              <Spinner />
              {t("updating")}
            </Typography>
          )}
        </div>
        {renderBody()}
      </div>
    </PageContainer>
  );
}
