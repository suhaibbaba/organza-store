"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { RTL_LOCALES } from "@/constants/locale";
import { CHANNEL_COLORS, CHART_BAR_RADIUS, CHART_HEIGHT } from "@/constants/reports";
import type { AppLocale } from "@/i18n/routing";
import type { ChannelSales } from "@/types/report";

// Where the money came from: shop counter, WhatsApp or the website. Three
// columns, each labelled with its own rounded figure — the exact amounts and
// order counts are spelled out underneath, so nothing here depends on
// reading a bar against an axis (and nothing depends on colour alone).
export function ReportChannelChart({ byChannel }: { byChannel: ChannelSales[] }) {
  const t = useTranslations("reports.channels");
  const tChannel = useTranslations("orders.channel");
  const locale = useLocale() as AppLocale;
  const formatMoney = useMoneyFormatter();
  const isRtl = RTL_LOCALES.includes(locale);

  const data = byChannel.map((entry) => ({
    channel: entry.channel,
    label: tChannel(entry.channel),
    revenue: Number(entry.revenue),
    orderCount: entry.orderCount,
  }));

  const hasSales = data.some((entry) => entry.revenue > 0);

  // Column labels are abbreviated (1.2 ألف) so three of them fit across a
  // phone; the list below carries every figure in full.
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {hasSales ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
              <XAxis
                dataKey="label"
                // Mirrors with the page: the first channel sits where the
                // reader's eye starts.
                reversed={isRtl}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--foreground)", fontSize: 12 }}
              />
              <Bar dataKey="revenue" radius={CHART_BAR_RADIUS} maxBarSize={48} isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel]} />
                ))}
                <LabelList
                  dataKey="revenue"
                  position="top"
                  formatter={(value) => compact.format(Number(value ?? 0))}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        )}

        {/* The exact figures, in words rather than as a second axis — one
            chart never carries two scales. */}
        <ul className="mt-3 flex flex-col gap-2">
          {data.map((entry) => (
            <li key={entry.channel} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CHANNEL_COLORS[entry.channel] }}
                  aria-hidden="true"
                />
                <span className="truncate">{entry.label}</span>
              </span>
              {/* Two separate spans rather than one string with a separator:
                  a punctuation mark between an Arabic word and a number gets
                  re-ordered by the bidi algorithm and can read as part of the
                  number. */}
              <span className="flex shrink-0 items-center gap-3 text-foreground">
                <span>{formatMoney(entry.revenue)}</span>
                <span className="text-muted-foreground">{t("orders", { count: entry.orderCount })}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
