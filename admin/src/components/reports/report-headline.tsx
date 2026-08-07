"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { FigureCard } from "@/components/figures/figure-card";
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

      {/* Two columns on a phone, like every other figure grid in the app:
          any wider and the amounts stop being scannable side by side. */}
      <div className="grid grid-cols-2 gap-3">
        <FigureCard
          label={tFigures("sold.label")}
          description={tFigures("sold.help")}
          toggleLabel={tFigures("explain", { label: tFigures("sold.label") })}
          value={formatMoney(totals.revenue)}
          subtitle={t("soldHint", { orders: totals.orderCount, items: totals.itemCount })}
        />

        <FigureCard
          tone="positive"
          label={tFigures("received.label")}
          description={tFigures("received.help")}
          toggleLabel={tFigures("explain", { label: tFigures("received.label") })}
          value={formatMoney(totals.collectedRevenue)}
        />

        {/* Amber, because "still owed" is the figure to chase and must never
            look like takings. Never colour alone — the label says it too. */}
        <FigureCard
          tone="warning"
          label={tFigures("owed.label")}
          description={tFigures("owed.help")}
          toggleLabel={tFigures("explain", { label: tFigures("owed.label") })}
          value={formatMoney(totals.pendingCollectionAmount)}
          subtitle={
            totals.pendingCollectionOrderCount > 0
              ? t("owedOrders", { count: totals.pendingCollectionOrderCount })
              : undefined
          }
        />

        <FigureCard
          label={t("averageOrder.label")}
          description={t("averageOrder.help")}
          toggleLabel={tFigures("explain", { label: t("averageOrder.label") })}
          value={formatMoney(totals.averageOrderValue)}
        />

        <FigureCard
          label={t("discounts.label")}
          description={t("discounts.help")}
          toggleLabel={tFigures("explain", { label: t("discounts.label") })}
          value={formatMoney(totals.discountAmount)}
        />

        {showProfit && (
          <>
            <FigureCard
              label={t("cost.label")}
              description={t("cost.help")}
              toggleLabel={tFigures("explain", { label: t("cost.label") })}
              value={formatMoney(totals.cost!)}
            />

            <FigureCard
              label={t("profit.label")}
              description={t("profit.help")}
              toggleLabel={tFigures("explain", { label: t("profit.label") })}
              value={formatMoney(totals.profit!)}
              // Margin is null when nothing sold — there is no percentage of
              // zero to state, so the line is simply left off.
              subtitle={hasMargin ? t("margin", { value: Number(totals.margin) / 100 }) : undefined}
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
