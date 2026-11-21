"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TabPanel, Tabs, Widget } from "@store/ui";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { TOP_SELLER_RANKING_TABS } from "@/constants/reports";
import type { TopSeller, TopSellerRanking } from "@/types/report";

// Each figure is a labelled pair under the name, so "1,240" is never read as the quantity.
function SellerRow({ seller, rank }: { seller: TopSeller; rank: number }) {
  const t = useTranslations("reports.topSellers");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const name = localize(seller.name, locale);
  const variantName = seller.variantName ? localize(seller.variantName, locale) : null;

  return (
    <li className="flex flex-col gap-2 rounded-panel border border-line p-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">
          <span className="text-ink-muted">{rank}. </span>
          {name}
        </p>
        {variantName && <p className="truncate text-label text-ink-muted">{variantName}</p>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-label">
        <span className="font-semibold tabular-nums text-ink">
          {t("revenue", { amount: formatMoney(seller.revenue) })}
        </span>
        <span className="tabular-nums text-ink-muted">{t("quantity", { count: seller.quantity })}</span>
        {seller.profit !== undefined && (
          <span className="tabular-nums text-ink-muted">{t("profit", { amount: formatMoney(seller.profit) })}</span>
        )}
      </div>
    </li>
  );
}

function SellerList({ sellers }: { sellers: TopSeller[] }) {
  const t = useTranslations("reports.topSellers");

  if (sellers.length === 0) {
    return <p className="py-6 text-center text-label text-ink-muted">{t("empty")}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {sellers.map((seller, index) => (
        <SellerRow
          key={`${seller.productId ?? "none"}-${seller.variantId ?? "none"}`}
          seller={seller}
          rank={index + 1}
        />
      ))}
    </ul>
  );
}

interface ReportTopSellersProps {
  byRevenue: TopSeller[];
  byQuantity: TopSeller[];
}

export function ReportTopSellers({ byRevenue, byQuantity }: ReportTopSellersProps) {
  const t = useTranslations("reports.topSellers");
  const [ranking, setRanking] = useState<TopSellerRanking>("revenue");

  return (
    <Widget title={t("title")}>
      <div className="mt-3 flex flex-col gap-3">
        <Tabs tabs={TOP_SELLER_RANKING_TABS} value={ranking} onChange={setRanking} label="reports.topSellers.title" />
        <TabPanel id={ranking}>
          <SellerList sellers={ranking === "revenue" ? byRevenue : byQuantity} />
        </TabPanel>
      </div>
    </Widget>
  );
}
