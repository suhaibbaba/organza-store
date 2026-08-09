"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { SalesTotals } from "@/types/report";

// The numbers the whole page exists for — figures only, no chart, laid out
// exactly like the dashboard's cards so the same figure never wears two faces
// on two screens (spec.md "The admin dashboard": what the reader needs is a
// number they can act on, not a trend to interpret).
//
// Sold / Received / Still owed are named separately and always all three, so
// "sales" is never read as "money in hand" — and they carry the same (?)
// explanations as the dashboard, from the same `figures` messages.
//
// Cost, profit and margin are simply absent from the API response for a role
// without permission to see them (CLAUDE.md rule 19), so the presence of the
// field — not a role check in the UI — decides what is rendered.
export function ReportHeadline({ totals }: { totals: SalesTotals }) {
  const t = useTranslations("reports.totals");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();

  const showProfit = totals.profit !== undefined;
  const hasMargin = totals.margin !== null && totals.margin !== undefined;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("title")}</h2>

      {/* One column on a phone, two from a large phone / small tablet up, and
          four across on a desktop — the amounts stay scannable side by side
          without a single figure stretching a 2560px monitor. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={tFigures("sold.label")}
          tooltip={tFigures("sold.help")}
          value={formatMoney(totals.revenue)}
          hint={t("soldHint", { orders: totals.orderCount, items: totals.itemCount })}
        />

        <StatCard
          tone="success"
          label={tFigures("received.label")}
          tooltip={tFigures("received.help")}
          value={formatMoney(totals.collectedRevenue)}
        />

        {/* Amber, because "still owed" is the figure to chase and must never
            look like takings. Never colour alone — the label says it too. */}
        <StatCard
          tone="warning"
          label={tFigures("owed.label")}
          tooltip={tFigures("owed.help")}
          value={formatMoney(totals.pendingCollectionAmount)}
          hint={
            totals.pendingCollectionOrderCount > 0
              ? t("owedOrders", { count: totals.pendingCollectionOrderCount })
              : undefined
          }
        />

        <StatCard
          label={t("averageOrder.label")}
          tooltip={t("averageOrder.help")}
          value={formatMoney(totals.averageOrderValue)}
        />

        <StatCard
          label={t("discounts.label")}
          tooltip={t("discounts.help")}
          value={formatMoney(totals.discountAmount)}
        />

        {showProfit && (
          <>
            <StatCard label={t("cost.label")} tooltip={t("cost.help")} value={formatMoney(totals.cost!)} />

            <StatCard
              label={t("profit.label")}
              tooltip={t("profit.help")}
              value={formatMoney(totals.profit!)}
              // Margin is null when nothing sold — there is no percentage of
              // zero to state, so the line is simply left off.
              hint={hasMargin ? t("margin", { value: Number(totals.margin) / 100 }) : undefined}
            />
          </>
        )}
      </div>

      {/* Profit is only as honest as the costs behind it — say so plainly
          rather than letting an inflated figure pass as fact. */}
      {showProfit && (totals.missingCostItems ?? 0) > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("missingCost", { count: totals.missingCostItems! })}
        </p>
      )}
    </section>
  );
}
