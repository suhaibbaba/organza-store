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
import { Spinner } from "@/components/ui/spinner";
import type { ReportRangeValue } from "@/types/report";

// Sales & profit for a picked range (spec.md "Reports"). ADMIN ONLY.
//
// The gate is report.view, and the real one is on the backend: /api/reports/
// sales 403s without it. This guard is what stops a typed URL or an old
// bookmark from showing a signed-in Manager or Employee a broken-looking
// screen — they get the same "you don't have permission" sentence the API
// would have answered with, and a way back to a screen that is theirs.
//
// Figures only, no chart — the same choice as the dashboard (spec.md "The
// admin dashboard"): the reader is standing at a counter with a phone in one
// hand, and a number they can act on beats a trend they have to interpret.
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
