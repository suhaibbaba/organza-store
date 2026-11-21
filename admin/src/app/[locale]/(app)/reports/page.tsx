"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSalesReportQuery } from "@/hooks/use-reports";
import { DEFAULT_REPORT_PRESET } from "@/constants/reports";
import { rangeForPreset } from "@/lib/report-range";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ReportRangePicker } from "@/components/reports/report-range-picker";
import { ReportHeadline } from "@/components/reports/report-headline";
import { ReportChannelsCard } from "@/components/reports/report-channels-card";
import { ReportTopSellers } from "@/components/reports/report-top-sellers";
import { ReportReturnsCard } from "@/components/reports/report-returns-card";
import { ReportEmpty, ReportError, ReportLoading } from "@/components/reports/report-states";
import { Spinner } from "@store/ui";
import type { ReportRangeValue } from "@/types/report";

// Sales & profit, ADMIN only (report.view; the API 403s regardless). Figures, no chart: read standing at a counter.
export default function ReportsPage() {
  return (
    <RoleGuard action="report.view">
      <ReportsPageContent />
    </RoleGuard>
  );
}

function ReportsPageContent() {
  const t = useTranslations("reports");
  const [range, setRange] = useState<ReportRangeValue>(() => rangeForPreset(DEFAULT_REPORT_PRESET));

  const { data, isLoading, isFetching, isError, error, refetch } = useSalesReportQuery(range.from, range.to);
  const isEmpty = data !== undefined && data.totals.orderCount === 0 && data.returns.itemCount === 0;

  return (
    <PageContainer>
      <PageHeader
        name="reports"
        title={t("title")}
        description={t("subtitle")}
        actions={<ReportRangePicker value={range} onChange={setRange} />}
      />

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <ReportLoading />
        ) : isError ? (
          <ReportError error={error} onRetry={() => void refetch()} />
        ) : data ? (
          <>
            {/* The previous range stays on screen while the next one loads. */}
            {isFetching && (
              <p className="flex items-center justify-center gap-2 text-label text-ink-muted">
                <Spinner />
                {t("updating")}
              </p>
            )}

            {isEmpty ? (
              <ReportEmpty />
            ) : (
              <>
                <ReportHeadline totals={data.totals} />
                <ReportChannelsCard byChannel={data.byChannel} />
                <ReportTopSellers byRevenue={data.topByRevenue} byQuantity={data.topByQuantity} />
                <ReportReturnsCard returns={data.returns} />
              </>
            )}
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
