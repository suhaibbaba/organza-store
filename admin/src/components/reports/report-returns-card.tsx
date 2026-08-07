"use client";

import { useTranslations } from "next-intl";
import { FigureCard } from "@/components/figures/figure-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReturnsTotals } from "@/types/report";

// What came back. Kept beside the sales figures rather than folded into
// them: the totals above are already net of returns, so this answers the
// separate question of how much was handed back — which the (?) on each card
// says out loud, because "returned value" next to a sales figure invites
// exactly the wrong subtraction.
export function ReportReturnsCard({ returns }: { returns: ReturnsTotals }) {
  const t = useTranslations("reports.returns");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("title")}</h2>

      {returns.itemCount === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <FigureCard
            label={t("amount")}
            description={t("amountHelp")}
            toggleLabel={tFigures("explain", { label: t("amount") })}
            value={formatMoney(returns.amount)}
          />
          <FigureCard
            label={t("items")}
            description={t("itemsHelp")}
            toggleLabel={tFigures("explain", { label: t("items") })}
            value={returns.itemCount}
            subtitle={t("orders", { count: returns.orderCount })}
          />
        </div>
      )}
    </section>
  );
}
