"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { CHART_COLORS } from "@/constants/reports";
import type { TopSeller } from "@/types/report";

// Best sellers as a ranked list rather than a chart: on a phone, five names
// with their numbers beside them are read faster than five bars that still
// need labels — and long Arabic product names have room to breathe. The bar
// under each row is a proportional cue, not the data itself.
function SellerRow({ seller, rank, share }: { seller: TopSeller; rank: number; share: number }) {
  const t = useTranslations("reports.topSellers");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const name = localize(seller.name, locale);
  const variantName = seller.variantName ? localize(seller.variantName, locale) : null;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            <span className="text-muted-foreground">{rank}. </span>
            {name}
          </p>
          {variantName && <p className="truncate text-sm text-muted-foreground">{variantName}</p>}
        </div>
        <p className="shrink-0 font-semibold text-foreground">{formatMoney(seller.revenue)}</p>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{t("quantity", { count: seller.quantity })}</span>
        {seller.profit !== undefined && <span>{t("profit", { amount: formatMoney(seller.profit) })}</span>}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(share, 2)}%`, backgroundColor: CHART_COLORS.revenue }}
        />
      </div>
    </li>
  );
}

function SellerList({ sellers, by }: { sellers: TopSeller[]; by: "revenue" | "quantity" }) {
  const t = useTranslations("reports.topSellers");

  if (sellers.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const max = Math.max(...sellers.map((seller) => (by === "revenue" ? Number(seller.revenue) : seller.quantity)), 1);

  return (
    <ul className="flex flex-col gap-2">
      {sellers.map((seller, index) => {
        const value = by === "revenue" ? Number(seller.revenue) : seller.quantity;
        return (
          <SellerRow
            key={`${seller.productId ?? "none"}-${seller.variantId ?? "none"}`}
            seller={seller}
            rank={index + 1}
            share={(value / max) * 100}
          />
        );
      })}
    </ul>
  );
}

interface ReportTopSellersProps {
  byRevenue: TopSeller[];
  byQuantity: TopSeller[];
}

export function ReportTopSellers({ byRevenue, byQuantity }: ReportTopSellersProps) {
  const t = useTranslations("reports.topSellers");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="revenue">
          <TabsList className="w-full">
            <TabsTrigger value="revenue">{t("byRevenue")}</TabsTrigger>
            <TabsTrigger value="quantity">{t("byQuantity")}</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue">
            <SellerList sellers={byRevenue} by="revenue" />
          </TabsContent>
          <TabsContent value="quantity">
            <SellerList sellers={byQuantity} by="quantity" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
