"use client";

import { useTranslations } from "next-intl";
import { Card } from "@store/ui";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ChannelSales } from "@/types/report";

// Where the money came from, as figures read straight — never bars to measure.
export function ReportChannelsCard({ byChannel }: { byChannel: ChannelSales[] }) {
  const t = useTranslations("reports.channels");
  const tChannel = useTranslations("orders.channel");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  const hasSales = byChannel.some((entry) => Number(entry.revenue) > 0);

  return (
    <Card className="flex flex-col gap-2">
      <ExplainedLabel
        label={t("title")}
        description={t("help")}
        toggleLabel={tFigures("explain", { label: t("title") })}
        labelClassName="text-section font-semibold text-ink"
      />

      {hasSales ? (
        <ul className="flex flex-col">
          {byChannel.map((entry) => (
            <li
              key={entry.channel}
              className="flex items-baseline justify-between gap-3 border-b border-line py-3 last:border-0 last:pb-0"
            >
              <span className="min-w-0 truncate text-label text-ink-muted">{tChannel(entry.channel)}</span>

              {/* Separate spans, not one string: bidi would reorder a separator into the number. */}
              <span className="flex shrink-0 items-baseline gap-3">
                <span className="text-section font-semibold tabular-nums text-ink">{formatMoney(entry.revenue)}</span>
                <span className="text-meta text-ink-muted">{t("orders", { count: entry.orderCount })}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-label text-ink-muted">{t("empty")}</p>
      )}
    </Card>
  );
}
