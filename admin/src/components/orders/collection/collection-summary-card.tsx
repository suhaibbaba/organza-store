"use client";

import { Typography } from "@store/ui";
import { useLocale, useTranslations } from "next-intl";
import type { CollectionSummary } from "@organza/shared/types/order";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDate } from "@/lib/format";

// Amber, because money the courier still holds must never read as takings; net of returns and cancellations, like report revenue.
export function CollectionSummaryCard({ summary }: { summary: CollectionSummary }) {
  const t = useTranslations("orders.collection.summary");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <StatCard name="outstanding-total"
      tone="warning"
      label={t("label")}
      value={formatMoney(summary.amount)}
      hint={
        <>
          {t("orders", { count: summary.orderCount })}
          {summary.oldestCreatedAt && (
            <Typography variant="caption" className="block">{t("oldest", { date: formatDate(summary.oldestCreatedAt, locale) })}</Typography>
          )}
        </>
      }
    />
  );
}
