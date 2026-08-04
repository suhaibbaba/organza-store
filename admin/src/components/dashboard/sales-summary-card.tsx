"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { ReportFigure } from "@/components/reports/report-figure";
import { Link } from "@/i18n/navigation";
import { useSalesSummaryQuery } from "@/hooks/use-reports";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ApiError } from "@/lib/api/errors";
import { RTL_LOCALES } from "@/constants/locale";
import { CHART_COLORS } from "@/constants/reports";
import { REPORT_PERIODS } from "@shared/constants/report";
import type { AppLocale } from "@/i18n/routing";
import type { ReportPeriod, SalesTotals } from "@/types/report";

// Sales & profit on the dashboard (spec.md "Dashboard": today/month sales
// summary). One tap switches period; profit only appears for the roles the
// API sends it to (CLAUDE.md rule 19 — the gate is the backend's, this just
// renders whatever arrived).
function PeriodFigures({ totals }: { totals: SalesTotals }) {
  const t = useTranslations("dashboard.sales");
  const formatMoney = useMoneyFormatter();

  return (
    <div className="flex flex-col gap-4">
      <ReportFigure
        size="hero"
        seriesColor={CHART_COLORS.revenue}
        label={t("revenue")}
        value={formatMoney(totals.revenue)}
      />
      <div className="grid grid-cols-2 gap-4">
        <ReportFigure label={t("orders")} value={totals.orderCount} />
        <ReportFigure label={t("averageOrder")} value={formatMoney(totals.averageOrderValue)} />
      </div>
      {/* Only worth a line when there is something outstanding: on a day of
          pure counter sales this would just be a zero taking up space. */}
      {Number(totals.pendingCollectionAmount) > 0 && (
        <ReportFigure
          label={t("pendingCollection")}
          value={formatMoney(totals.pendingCollectionAmount)}
          hint={t("pendingCollectionOrders", { count: totals.pendingCollectionOrderCount })}
        />
      )}
      {totals.profit !== undefined && (
        <ReportFigure
          seriesColor={CHART_COLORS.profit}
          label={t("profit")}
          value={formatMoney(totals.profit)}
          hint={
            totals.margin === null || totals.margin === undefined
              ? undefined
              : t("margin", { value: Number(totals.margin) / 100 })
          }
        />
      )}
    </div>
  );
}

export function SalesSummaryCard() {
  const t = useTranslations("dashboard.sales");
  const locale = useLocale() as AppLocale;
  const translateError = useTranslateError();
  const { data, isLoading, isError, error } = useSalesSummaryQuery();

  // The "see everything" arrow points the way the language reads.
  const ArrowIcon = RTL_LOCALES.includes(locale) ? ArrowLeft : ArrowRight;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <Link
          href="/reports"
          className="flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
        >
          {t("viewReports")}
          <ArrowIcon className="size-4" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" aria-busy="true" />
        ) : isError ? (
          <Alert variant="destructive">
            {error instanceof ApiError ? translateError(error.code) : t("error")}
          </Alert>
        ) : data ? (
          <Tabs defaultValue="today">
            <TabsList className="w-full">
              {REPORT_PERIODS.map((period) => (
                <TabsTrigger key={period} value={period}>
                  {t(`periods.${period}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            {REPORT_PERIODS.map((period) => (
              <TabsContent key={period} value={period}>
                <PeriodFigures totals={data[period as ReportPeriod]} />
              </TabsContent>
            ))}
          </Tabs>
        ) : null}
      </CardContent>
    </Card>
  );
}
