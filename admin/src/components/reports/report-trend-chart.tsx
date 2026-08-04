"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartLegend } from "@/components/reports/chart-legend";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { RTL_LOCALES } from "@/constants/locale";
import { CHART_COLORS, CHART_DOT_RADIUS, CHART_HEIGHT, CHART_LINE_WIDTH } from "@/constants/reports";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import type { ReportGranularity, SalesSeriesPoint } from "@/types/report";

interface ReportTrendChartProps {
  series: SalesSeriesPoint[];
  granularity: ReportGranularity;
}

// Sales over the picked range, with profit alongside it for the roles allowed
// to see profit at all (the API simply doesn't send it to the others, so the
// second line appears or doesn't without the chart knowing about roles).
export function ReportTrendChart({ series, granularity }: ReportTrendChartProps) {
  const t = useTranslations("reports.trend");
  const locale = useLocale() as AppLocale;
  const formatMoney = useMoneyFormatter();
  const isRtl = RTL_LOCALES.includes(locale);
  const hasProfit = series.some((point) => point.profit !== undefined);

  // Recharts needs numbers; the API sends 2dp strings (money is never a
  // float over the wire), so the conversion happens here and nowhere else.
  const data = series.map((point) => ({
    date: point.date,
    revenue: Number(point.revenue),
    profit: point.profit === undefined ? undefined : Number(point.profit),
    orderCount: point.orderCount,
  }));

  // Day buckets get the day of the month — a full date on every tick is
  // unreadable on a phone; the tooltip carries the whole date.
  function formatTick(value: string): string {
    if (granularity === "day") {
      return new Intl.NumberFormat(locale).format(new Date(`${value}T00:00:00`).getDate());
    }
    return formatDate(`${value}T00:00:00`, locale);
  }

  // Axis money is abbreviated (1.2K) so three ticks fit beside an Arabic
  // label; exact figures live in the tooltip and in the headline numbers.
  function formatAxisMoney(value: number): string {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }

  // Touch counts as hover on a phone: tapping a point opens this, which is
  // where the exact figures live (the axis only carries rounded ones).
  function renderTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 text-sm shadow-md">
        <p className="mb-1 font-medium text-popover-foreground">{formatDate(`${label}T00:00:00`, locale)}</p>
        {payload.map((entry) => (
          <p key={String(entry.dataKey)} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
            {t(entry.dataKey === "revenue" ? "revenue" : "profit")}: {formatMoney(Number(entry.value ?? 0))}
          </p>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <ChartLegend
          items={[
            { label: t("revenue"), color: CHART_COLORS.revenue },
            ...(hasProfit ? [{ label: t("profit"), color: CHART_COLORS.profit }] : []),
          ]}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            {/* Horizontal hairlines only — vertical ones add ink without
                helping anyone read a total. */}
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              // The whole layout mirrors in Arabic/Hebrew, time included:
              // the newest bucket sits where the reader's eye starts.
              reversed={isRtl}
              tickFormatter={formatTick}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              orientation={isRtl ? "right" : "left"}
              tickFormatter={formatAxisMoney}
              tickLine={false}
              axisLine={false}
              width={44}
              tickCount={4}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: CHART_COLORS.grid }} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={CHART_COLORS.revenue}
              strokeWidth={CHART_LINE_WIDTH}
              strokeLinecap="round"
              dot={false}
              // The ring keeps the active dot legible where the two lines
              // cross, and makes it a bigger touch target than the line.
              activeDot={{ r: CHART_DOT_RADIUS, strokeWidth: 2, stroke: "var(--card)" }}
            />
            {hasProfit && (
              <Line
                type="monotone"
                dataKey="profit"
                stroke={CHART_COLORS.profit}
                strokeWidth={CHART_LINE_WIDTH}
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: CHART_DOT_RADIUS, strokeWidth: 2, stroke: "var(--card)" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
