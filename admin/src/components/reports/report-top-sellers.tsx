"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { SegmentedControl, Table, Typography, type Column } from "@store/ui";
import { DetailCard } from "@/components/layout/detail-card";
import { ProductImage } from "@/components/products/product-image";
import { Link } from "@/i18n/navigation";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { REPORT_THUMB_SIZES, TOP_SELLER_RANKINGS } from "@/constants/reports";
import type { ReportTopSellersProps, TopSeller, TopSellerRanking } from "@/types/report";

function sellerKey(seller: TopSeller): string {
  return `${seller.productId ?? "none"}-${seller.variantId ?? "none"}`;
}

export function ReportTopSellers({ byRevenue, byQuantity }: ReportTopSellersProps) {
  const t = useTranslations("reports.topSellers");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const [ranking, setRanking] = useState<TopSellerRanking>("revenue");
  const sellers = ranking === "revenue" ? byRevenue : byQuantity;
  const showProfit = sellers.some((seller) => seller.profit !== undefined);

  function renderProduct(seller: TopSeller) {
    const name = localize(seller.name, locale);
    const rank = sellers.indexOf(seller) + 1;
    const photo = (
      <ProductImage
        src={seller.thumbnailUrl}
        alt=""
        className="size-16 rounded-control md:size-12"
        sizes={REPORT_THUMB_SIZES}
      />
    );

    return (
      <div className="flex items-start gap-3">
        <Typography variant="body" tone="muted" as="span" className="w-4 shrink-0 pt-1 tabular-nums">
          {rank}
        </Typography>
        {/* A removed product keeps its snapshot line but has no page to open. */}
        {seller.productId ? (
          <Link href={`/products/${seller.productId}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
            {photo}
          </Link>
        ) : (
          <span className="shrink-0">{photo}</span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          {seller.productId ? (
            <Link
              href={`/products/${seller.productId}`}
              className="self-start rounded-control text-value text-ink transition-colors hover:text-primary-700 focus-link"
            >
              {name}
            </Link>
          ) : (
            <Typography variant="body" as="span">
              {name}
            </Typography>
          )}
          {seller.variantName && (
            <Typography variant="small" tone="muted" as="span">
              {localize(seller.variantName, locale)}
            </Typography>
          )}
        </div>
      </div>
    );
  }

  const columns: Column<TopSeller>[] = [
    {
      key: "product",
      header: "reports.table.product",
      primary: true,
      className: "min-w-[14rem] [--cell-max:24rem]",
      render: renderProduct,
    },
    {
      key: "quantity",
      header: "reports.table.quantity",
      align: "numeric",
      render: (seller) => seller.quantity,
    },
    {
      key: "revenue",
      header: "reports.table.revenue",
      align: "numeric",
      render: (seller) => (
        <Typography variant="body" weight="semibold" as="span" className="whitespace-nowrap">
          {formatMoney(seller.revenue)}
        </Typography>
      ),
    },
    ...(showProfit
      ? [
          {
            key: "profit",
            header: "reports.table.profit",
            align: "numeric",
            render: (seller: TopSeller) => (
              <span className="whitespace-nowrap">{seller.profit ? formatMoney(seller.profit) : ""}</span>
            ),
          } satisfies Column<TopSeller>,
        ]
      : []),
  ];

  return (
    <DetailCard
      icon={Trophy}
      title={t("title")}
      data-testid="report-top-sellers"
      action={
        <SegmentedControl
          data-testid="report-top-ranking"
          label={t("title")}
          options={TOP_SELLER_RANKINGS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          value={ranking}
          onChange={setRanking}
        />
      }
    >
      {sellers.length === 0 ? (
        <Typography variant="body" tone="muted" as="p">
          {t("empty")}
        </Typography>
      ) : (
        <Table data-testid="report-top-seller" columns={columns} rows={sellers} rowKey={sellerKey} />
      )}
    </DetailCard>
  );
}
