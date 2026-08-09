"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CollectionSummary } from "@shared/types/order";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDate } from "@/lib/format";

// The one number this screen exists for: how much the delivery company is
// still holding. The shared StatCard, so the figure wears the same face here
// as "مستحق لنا" does on the dashboard and the reports page — amber, because
// money somebody else is holding must never read as takings.
//
// The amount is net of returns and free of cancelled sales (the backend
// computes it exactly like report revenue), so it is what is genuinely owed.
export function CollectionSummaryCard({ summary }: { summary: CollectionSummary }) {
  const t = useTranslations("orders.collection.summary");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <StatCard
      tone="warning"
      label={t("label")}
      value={formatMoney(summary.amount)}
      hint={
        <>
          {t("orders", { count: summary.orderCount })}
          {/* "Owed since 12 July" is what turns a total into something to act
              on; with nothing outstanding there is no date to state. */}
          {summary.oldestCreatedAt && (
            <span className="block">{t("oldest", { date: formatDate(summary.oldestCreatedAt, locale) })}</span>
          )}
        </>
      }
    />
  );
}
