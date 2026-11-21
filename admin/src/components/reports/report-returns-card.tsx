"use client";

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReturnsTotals } from "@/types/report";

// Kept apart from the sales figures, which are already net of returns — the (?) says so to stop a double subtraction.
export function ReportReturnsCard({ returns }: { returns: ReturnsTotals }) {
  const t = useTranslations("reports.returns");
  const formatMoney = useMoneyFormatter();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink">{t("title")}</h2>

      {returns.itemCount === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-4 text-label text-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard name="returns-amount" label={t("amount")} tooltip={t("amountHelp")} value={formatMoney(returns.amount)} />
          <StatCard name="returns-items"
            label={t("items")}
            tooltip={t("itemsHelp")}
            value={returns.itemCount}
            hint={t("orders", { count: returns.orderCount })}
          />
        </div>
      )}
    </section>
  );
}
