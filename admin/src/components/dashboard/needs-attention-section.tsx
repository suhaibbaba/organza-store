"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useCollectionSummaryQuery } from "@/hooks/use-orders";
import { usePendingExpenseCountQuery } from "@/hooks/use-expenses";
import { RTL_LOCALES } from "@/constants/locale";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";
import type { DashboardSummary } from "@/types/dashboard";

// The three open loops, in one place: stock about to run out, money someone
// spent that nobody has agreed to yet, and money the delivery company is
// still holding.
//
// Every row is rendered even at zero. A list whose rows move around depending
// on the day is a list an untrained user has to re-read each time; "0" in a
// fixed position is read at a glance and is reassuring rather than noise.
export function NeedsAttentionSection({ summary }: { summary: DashboardSummary }) {
  const t = useTranslations("dashboard.attention");
  const formatMoney = useMoneyFormatter();
  const { data: collection } = useCollectionSummaryQuery();
  const { data: pendingExpenses } = usePendingExpenseCountQuery();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("title")}</h2>

      <Card className="divide-y divide-border">
        <AttentionRow
          label={t("lowStock")}
          value={summary.lowStock.count}
          highlight={summary.lowStock.count > 0}
          href="/inventory?lowStock=true"
        />

        {/* No destination yet: expenses are backend-only so far, so this
            reports the number without pretending there is a screen behind
            it. It gets a link the moment that screen exists. */}
        <AttentionRow
          label={t("pendingApprovals")}
          value={pendingExpenses ?? 0}
          highlight={(pendingExpenses ?? 0) > 0}
        />

        <AttentionRow
          label={t("uncollected")}
          value={formatMoney(collection?.amount ?? "0")}
          highlight={Number(collection?.amount ?? 0) > 0}
          href="/orders/collection"
        />
      </Card>
    </section>
  );
}

interface AttentionRowProps {
  label: string;
  value: ReactNode;
  // Zero is not something to act on, so it reads muted; anything else is.
  highlight: boolean;
  href?: string;
}

function AttentionRow({ label, value, highlight, href }: AttentionRowProps) {
  const locale = useLocale() as AppLocale;
  // The chevron points the way the language reads, not always to the right.
  const ChevronIcon = RTL_LOCALES.includes(locale) ? ChevronLeft : ChevronRight;

  const content = (
    <>
      <p className="min-w-0 flex-1 text-sm text-foreground">{label}</p>
      <p className={cn("shrink-0 font-semibold tabular-nums", highlight ? "text-foreground" : "text-muted-foreground")}>
        {value}
      </p>
      {href && <ChevronIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );

  // min-h-14 on both branches so a row that happens to have nowhere to go is
  // the same height as its neighbours.
  if (!href) {
    return <div className="flex min-h-14 items-center gap-3 px-4 py-2">{content}</div>;
  }

  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors active:bg-accent"
    >
      {content}
    </Link>
  );
}
