"use client";

import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";
import { Alert, Badge, Typography } from "@store/ui";
import { DetailCard } from "@/components/layout/detail-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { cn } from "@/lib/utils";
import type { ReportProfitStatementProps, StatementRowProps } from "@/types/report";

const SIGNS = { minus: "−", equals: "=" } as const;

function StatementRow({ label, amount, sign, emphasis, name }: StatementRowProps) {
  const formatMoney = useMoneyFormatter();
  const isTotal = emphasis === "total";

  return (
    <div
      data-test-selector={`report-statement-${name}`}
      className={cn(
        "flex items-baseline gap-3 py-2.5",
        emphasis === "subtotal" && "border-t border-line",
        isTotal && "-mx-3 mt-1 rounded-control bg-primary-50 px-3",
      )}
    >
      <Typography variant="body" tone="muted" as="span" aria-hidden="true" className="w-3 shrink-0 text-center">
        {sign ? SIGNS[sign] : ""}
      </Typography>
      <Typography variant="body" weight={emphasis ? "semibold" : "regular"} as="span" className="min-w-0 flex-1">
        {label}
      </Typography>
      {/* A loss keeps its minus before the number in Arabic too. */}
      <Typography
        variant={isTotal ? "h2" : "body"}
        weight={emphasis ? "semibold" : "regular"}
        as="span"
        className="shrink-0 tabular-nums"
        dir={Number(amount) < 0 ? "ltr" : undefined}
      >
        {formatMoney(amount)}
      </Typography>
    </div>
  );
}

// Adds down to net profit, then again for money received only: a good month and a paid-for month differ.
export function ReportProfitStatement({ profit }: ReportProfitStatementProps) {
  const t = useTranslations("reports.statement");
  const tTotals = useTranslations("reports.totals");

  return (
    <DetailCard
      icon={Calculator}
      title={t("title")}
      data-testid="report-profit"
      action={
        profit.netMargin !== null && (
          <Badge tone={Number(profit.netMargin) < 0 ? "danger" : "success"} data-testid="report-profit-margin">
            {t("margin", { value: Number(profit.netMargin) / 100 })}
          </Badge>
        )
      }
    >
      <Typography variant="small" tone="muted" as="p">
        {t("help")}
      </Typography>

      <div className="flex flex-col">
        <StatementRow name="sold" label={t("sold")} amount={profit.sold} />
        <StatementRow name="cogs" label={t("cogs")} amount={profit.cogs} sign="minus" />
        <StatementRow name="gross" label={t("gross")} amount={profit.grossProfit} sign="equals" emphasis="subtotal" />
        <StatementRow name="expenses" label={t("expenses")} amount={profit.expenses} sign="minus" />
        <StatementRow name="gifts" label={t("gifts")} amount={profit.giftCost} sign="minus" />
        <StatementRow name="net" label={t("net")} amount={profit.netProfit} sign="equals" emphasis="total" />
      </div>

      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <Typography variant="h4" as="h3">
          {t("receivedTitle")}
        </Typography>
        <Typography variant="small" tone="muted" as="p">
          {t("receivedHint")}
        </Typography>
        <div className="flex flex-col">
          <StatementRow name="received" label={t("receivedSold")} amount={profit.received} />
          <StatementRow name="received-cogs" label={t("receivedCogs")} amount={profit.receivedCogs} sign="minus" />
          <StatementRow
            name="received-gross"
            label={t("receivedGross")}
            amount={profit.receivedGrossProfit}
            sign="equals"
            emphasis="subtotal"
          />
          <StatementRow name="received-overheads" label={t("overheads")} amount={profit.overheads} sign="minus" />
          <StatementRow
            name="received-net"
            label={t("receivedNet")}
            amount={profit.receivedNetProfit}
            sign="equals"
            emphasis="total"
          />
        </div>
      </div>

      {/* Profit is only as honest as the costs behind it. */}
      {profit.missingCostItems > 0 && (
        <Alert tone="warning" data-testid="report-missing-cost">
          {tTotals("missingCost", { count: profit.missingCostItems })}
        </Alert>
      )}
    </DetailCard>
  );
}
