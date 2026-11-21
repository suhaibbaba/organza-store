"use client";

import { useLocale, useTranslations } from "next-intl";
import { StatCard, StatRow } from "@store/ui";
import { COLLECTION_OVERDUE_DAYS } from "@organza/shared/constants/order";
import type { CollectionSummary } from "@organza/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { daysSince, formatDate } from "@/lib/format";
import { getTextDirection } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";

// Amber, because money the courier still holds must never read as takings; every figure is net of returns.
export function CollectionSummaryCards({ summary }: { summary: CollectionSummary }) {
  const t = useTranslations("orders.collection.summary");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const oldest = summary.oldestCreatedAt;

  return (
    <StatRow cards={4} data-testid="collection-summary">
      <StatCard
        data-testid="stat-card-outstanding-total"
        label={t("label")}
        icon="wallet"
        tone="warning"
        value={formatMoney(summary.amount)}
        caption={t("orders", { count: summary.orderCount })}
      />
      <StatCard
        data-testid="stat-card-with-courier"
        label={t("withCourier")}
        icon="send"
        value={formatMoney(summary.withCourierAmount)}
        caption={t("withCourierHint", { count: summary.withCourierCount })}
      />
      <StatCard
        data-testid="stat-card-not-shipped"
        label={t("notShipped")}
        icon="package"
        tone="neutral"
        value={formatMoney(summary.notShippedAmount)}
        caption={t("notShippedHint", { count: summary.notShippedCount })}
      />
      <StatCard
        data-testid="stat-card-oldest"
        label={t("oldest")}
        icon="clock"
        tone={summary.overdueCount > 0 ? "danger" : "primary"}
        // The card sets figures left-to-right; a count with a word must follow the page's direction.
        value={oldest ? <span dir={getTextDirection(locale as AppLocale)}>{t("oldestDays", { count: daysSince(oldest) })}</span> : t("none")}
        caption={
          oldest
            ? `${formatDate(oldest, locale)} · ${t("overdue", { count: summary.overdueCount, days: COLLECTION_OVERDUE_DAYS })}`
            : undefined
        }
      />
    </StatRow>
  );
}
