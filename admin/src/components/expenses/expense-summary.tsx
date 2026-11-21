"use client";

import { useLocale, useTranslations } from "next-intl";
import { Clock, PieChart, Wallet, WalletMinimal } from "lucide-react";
import { CardButton, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { DetailCard } from "@/components/layout/detail-card";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { EXPENSE_BREAKDOWN_LIMIT } from "@/constants/expenses";
import type { ExpenseCategoryBreakdownProps, ExpenseSummaryCardsProps } from "@/types/expense";

// Spent counts approved money only; what waits for approval is shown apart and never added in.
export function ExpenseSummaryCards({ summary }: ExpenseSummaryCardsProps) {
  const t = useTranslations("expenses.summary");
  const formatMoney = useMoneyFormatter();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <StatCard
        name="expenses-total"
        className="col-span-2 sm:col-span-1"
        icon={WalletMinimal}
        label={t("total")}
        value={formatMoney(summary.total)}
        hint={t("count", { count: summary.count })}
      />
      <StatCard
        name="expenses-cash"
        icon={Wallet}
        tone="warning"
        label={t("cash")}
        value={formatMoney(summary.cashTotal)}
        hint={t("cashHint")}
      />
      <StatCard
        name="expenses-pending"
        icon={Clock}
        tone={summary.pendingCount > 0 ? "warning" : "default"}
        label={t("pending")}
        value={formatMoney(summary.pendingAmount)}
        hint={t("pendingHint", { count: summary.pendingCount })}
      />
    </div>
  );
}

// Where the money went, biggest first; a tap filters the list to that category.
export function ExpenseCategoryBreakdown({ summary, categories, activeId, onSelect }: ExpenseCategoryBreakdownProps) {
  const t = useTranslations("expenses.breakdown");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const total = Number(summary.total);
  const rows = summary.byCategory.slice(0, EXPENSE_BREAKDOWN_LIMIT);
  const nameOf = (id: string) => {
    const category = categories.find((one) => one.id === id);
    return category ? localize(category.name, locale) : "";
  };

  return (
    <DetailCard icon={PieChart} title={t("title")} data-testid="expenses-breakdown">
      {rows.length === 0 ? (
        <Typography variant="small" tone="muted" as="p">
          {t("empty")}
        </Typography>
      ) : (
        <ul className="grid grid-cols-1 gap-1 md:grid-cols-2 2xl:grid-cols-1">
          {rows.map((row) => {
            const share = total > 0 ? (Number(row.total) / total) * 100 : 0;
            const active = activeId === row.categoryId;
            return (
              <li key={row.categoryId}>
                <CardButton
                  data-testid={testSelectorFor("expenses-breakdown-row", row.categoryId)}
                  selected={active}
                  onClick={() => onSelect(active ? null : row.categoryId)}
                  className={cn("flex-col gap-1.5 px-2.5 py-2", !active && "border-transparent")}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <Typography variant="body" weight={active ? "semibold" : undefined} as="span" className="truncate">
                      {nameOf(row.categoryId)}
                    </Typography>
                    <Typography variant="body" weight="semibold" as="span" className="shrink-0 tabular-nums">
                      {formatMoney(row.total)}
                    </Typography>
                  </span>
                  <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-sunken">
                    <span
                      className="block h-full origin-left animate-grow-in rounded-full bg-primary-500 rtl:origin-right"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </span>
                </CardButton>
              </li>
            );
          })}
        </ul>
      )}
    </DetailCard>
  );
}
