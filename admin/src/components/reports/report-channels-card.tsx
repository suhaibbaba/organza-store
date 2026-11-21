"use client";

import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { Typography } from "@store/ui";
import { DetailCard } from "@/components/layout/detail-card";
import { ReportFactRow } from "@/components/reports/report-fact-row";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReportChannelsCardProps } from "@/types/report";

// Where the money came from, as figures read straight — never bars to measure.
export function ReportChannelsCard({ byChannel }: ReportChannelsCardProps) {
  const t = useTranslations("reports.channels");
  const tChannel = useTranslations("orders.channel");
  const formatMoney = useMoneyFormatter();
  const hasSales = byChannel.some((entry) => Number(entry.revenue) > 0);

  return (
    <DetailCard icon={Store} title={t("title")} data-testid="report-channels">
      <Typography variant="small" tone="muted" as="p">
        {t("help")}
      </Typography>
      {hasSales ? (
        <dl className="flex flex-col divide-y divide-line">
          {byChannel.map((entry) => (
            <ReportFactRow
              key={entry.channel}
              name={`channel-${entry.channel}`}
              label={tChannel(entry.channel)}
              hint={t("orders", { count: entry.orderCount })}
              value={formatMoney(entry.revenue)}
            />
          ))}
        </dl>
      ) : (
        <Typography variant="body" tone="muted" as="p">
          {t("empty")}
        </Typography>
      )}
    </DetailCard>
  );
}
