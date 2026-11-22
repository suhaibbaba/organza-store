"use client";

import { useLocale, useTranslations } from "next-intl";
import { PackageCheck } from "lucide-react";
import { SegmentedControl, Table, Typography, type Column } from "@store/ui";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { SOLD_ITEMS_SORTS } from "@store/shared/constants/report";
import { DetailCard } from "@/components/layout/detail-card";
import { ProductImage } from "@/components/products/product-image";
import { Link } from "@/i18n/navigation";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { REPORT_THUMB_SIZES } from "@/constants/reports";
import type { TopSeller } from "@/types/report";
import type { SoldItemsTableProps } from "@/types/sales";

function itemKey(item: TopSeller): string {
  return `${item.productId ?? "none"}-${item.variantId ?? "none"}`;
}

// Every product/variant that left the shop in the range, net of returns; profit only when the API sent it.
export function SoldItemsTable({
  items,
  meta,
  isRefreshing,
  sortBy,
  onSortChange,
  onPageChange,
  onPageSizeChange,
}: SoldItemsTableProps) {
  const t = useTranslations("sales.items");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const showProfit = items.some((item) => item.profit !== undefined);

  function renderProduct(item: TopSeller) {
    const name = localize(item.name, locale);
    const photo = (
      <ProductImage
        src={item.thumbnailUrl}
        alt=""
        className="size-16 rounded-control md:size-12"
        sizes={REPORT_THUMB_SIZES}
      />
    );

    return (
      <div className="flex items-start gap-3">
        {/* A removed product keeps its snapshot line but has no page to open. */}
        {item.productId ? (
          <Link href={`/products/${item.productId}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
            {photo}
          </Link>
        ) : (
          <span className="shrink-0">{photo}</span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          {item.productId ? (
            <Link
              href={`/products/${item.productId}`}
              className="self-start rounded-control text-value text-ink transition-colors hover:text-primary-700 focus-link"
            >
              {name}
            </Link>
          ) : (
            <Typography variant="body" as="span">
              {name}
            </Typography>
          )}
          {item.variantName && (
            <Typography variant="small" tone="muted" as="span">
              {localize(item.variantName, locale)}
            </Typography>
          )}
          {item.sku && (
            <Typography variant="small" tone="muted" as="span" className="tabular-nums" dir="ltr">
              {item.sku}
            </Typography>
          )}
        </div>
      </div>
    );
  }

  const columns: Column<TopSeller>[] = [
    {
      key: "product",
      header: "sales.items.product",
      primary: true,
      className: "min-w-[14rem] [--cell-max:28rem]",
      render: renderProduct,
    },
    {
      key: "quantity",
      header: "sales.items.quantity",
      align: "numeric",
      render: (item) => (
        <Typography variant="body" weight="semibold" as="span" className="tabular-nums">
          {item.quantity}
        </Typography>
      ),
    },
    {
      key: "revenue",
      header: "sales.items.revenue",
      align: "numeric",
      render: (item) => <span className="whitespace-nowrap tabular-nums">{formatMoney(item.revenue)}</span>,
    },
    ...(showProfit
      ? [
          {
            key: "profit",
            header: "sales.items.profit",
            align: "numeric",
            render: (item: TopSeller) => (
              <span className="whitespace-nowrap tabular-nums">{item.profit ? formatMoney(item.profit) : ""}</span>
            ),
          } satisfies Column<TopSeller>,
        ]
      : []),
  ];

  return (
    <DetailCard
      icon={PackageCheck}
      title={meta ? t("titleCount", { count: meta.total }) : t("title")}
      data-testid="sales-items"
      action={
        <SegmentedControl
          data-testid="sales-items-sort"
          label={t("sortLabel")}
          options={SOLD_ITEMS_SORTS.map((value) => ({ value, label: t(`sort.${value}`) }))}
          value={sortBy}
          onChange={onSortChange}
        />
      }
    >
      <Table
        data-testid="sales-item"
        columns={columns}
        rows={items}
        rowKey={itemKey}
        isRefreshing={isRefreshing}
        {...(meta && {
          pagination: {
            "data-testid": "sales-items-pagination",
            page: meta.page,
            totalPages: Math.max(meta.totalPages, 1),
            perPage: meta.pageSize,
            perPageOptions: PAGE_SIZE_OPTIONS,
            onPageChange,
            onPerPageChange: onPageSizeChange,
          },
        })}
      />
    </DetailCard>
  );
}
