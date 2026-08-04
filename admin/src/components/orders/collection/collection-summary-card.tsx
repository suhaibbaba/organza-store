"use client";

import { useLocale, useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import type { CollectionSummary } from "@shared/types/order";
import { Card, CardContent } from "@/components/ui/card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDate } from "@/lib/format";

// The one number this screen exists for: how much the delivery company is
// still holding. Rendered large enough to read at arm's length, the way the
// reports headline is — this is a figure the owner checks, not scans.
//
// The amount is net of returns and free of cancelled sales (the backend
// computes it exactly like report revenue), so it is what is genuinely owed.
export function CollectionSummaryCard({ summary }: { summary: CollectionSummary }) {
  const t = useTranslations("orders.collection.summary");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <HandCoins className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("label")}</p>
        </div>
        <p className="text-3xl font-bold tabular-nums text-foreground">{formatMoney(summary.amount)}</p>
        <p className="text-sm text-muted-foreground">{t("orders", { count: summary.orderCount })}</p>
        {/* "Owed since 12 July" is what turns a total into something to act
            on; with nothing outstanding there is no date to state. */}
        {summary.oldestCreatedAt && (
          <p className="text-xs text-muted-foreground">
            {t("oldest", { date: formatDate(summary.oldestCreatedAt, locale) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
