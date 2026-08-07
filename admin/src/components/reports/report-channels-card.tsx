"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ChannelSales } from "@/types/report";

// Where the money came from: shop counter, WhatsApp or the website.
//
// Figures, not bars. Three columns on a phone were never readable against an
// axis anyway — the exact amount was always spelled out underneath them —
// so the amounts are now the whole of it, one row per channel, each read
// straight rather than measured.
export function ReportChannelsCard({ byChannel }: { byChannel: ChannelSales[] }) {
  const t = useTranslations("reports.channels");
  const tChannel = useTranslations("orders.channel");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  const hasSales = byChannel.some((entry) => Number(entry.revenue) > 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <ExplainedLabel
          label={t("title")}
          description={t("help")}
          toggleLabel={tFigures("explain", { label: t("title") })}
          labelClassName="text-base font-semibold text-foreground"
        />

        {hasSales ? (
          <ul className="flex flex-col">
            {byChannel.map((entry) => (
              <li
                key={entry.channel}
                className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-0 last:pb-0"
              >
                <span className="min-w-0 truncate text-sm text-muted-foreground">{tChannel(entry.channel)}</span>

                {/* Two separate spans rather than one string with a
                    separator: a punctuation mark between an Arabic word and a
                    number gets re-ordered by the bidi algorithm and can end up
                    reading as part of the number. */}
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {formatMoney(entry.revenue)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("orders", { count: entry.orderCount })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
