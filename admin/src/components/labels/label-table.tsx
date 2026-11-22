"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge, Table, Typography, type Column } from "@store/ui";
import type { ProductSummary } from "@store/shared/types/product";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { localize } from "@/lib/i18n-content";
import { formatDate } from "@/lib/format";
import { ProductPhoto } from "@/components/products/product-photo";
import { NumberedBadge } from "@/components/products/numbered-badge";
import type { LabelTableProps } from "@/types/label";

// Rows are named `label-row-<id>`, as the old cards were.
const TABLE_NAME = "label";
const THUMB_SIZES = "(max-width: 767px) 80px, 64px";

export function LabelTable({
  products,
  meta,
  isLoading,
  isRefreshing,
  selectedIds,
  onToggle,
  onToggleAll,
  onPageChange,
  onPageSizeChange,
}: LabelTableProps) {
  const locale = useLocale();
  const t = useTranslations("labels");

  function renderProduct(product: ProductSummary) {
    const name = localize(product.name, locale);
    const details = [
      product.category ? localize(product.category.name, locale) : null,
      product.hasVariants ? t("row.variants", { count: product.variantCount }) : null,
    ].filter(Boolean);

    return (
      <div className="flex items-start gap-3">
        <ProductPhoto
          product={product}
          alt=""
          className="size-20 shrink-0 rounded-control md:size-16"
          sizes={THUMB_SIZES}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Typography variant="body" weight="medium" as="span">
            {name}
          </Typography>
          {details.length > 0 && (
            <Typography
              variant="small"
              tone="muted"
              as="span"
              className="line-clamp-1"
              data-test-selector="label-details"
            >
              {/* Each part isolated: an Arabic category name would otherwise pull the variant count into its direction. */}
              {details.map((part, index) => (
                <span key={index}>
                  {index > 0 && " · "}
                  <bdi>{part}</bdi>
                </span>
              ))}
            </Typography>
          )}
          {product.isNumbered && <NumberedBadge count={product.numberCount} className="self-start" />}
        </div>
      </div>
    );
  }

  // Informational, never a block: a reprint, or our label over a supplier's code, is always allowed.
  function renderPrinted(product: ProductSummary) {
    if (!product.needsLabel) {
      return (
        <Badge tone="neutral" className="whitespace-nowrap">
          {t("row.supplierBarcode")}
        </Badge>
      );
    }
    if (!product.labelsPrintedAt) {
      return (
        <Badge tone="warning" className="whitespace-nowrap">
          {t("row.neverPrinted")}
        </Badge>
      );
    }
    return (
      <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">
        {formatDate(product.labelsPrintedAt, locale)}
      </Typography>
    );
  }

  const columns: Column<ProductSummary>[] = [
    {
      key: "product",
      header: "labels.table.product",
      primary: true,
      className: "min-w-[13rem] [--cell-max:28rem]",
      render: renderProduct,
    },
    {
      key: "printed",
      header: "labels.table.printed",
      render: renderPrinted,
    },
  ];

  return (
    <Table
      data-testid={TABLE_NAME}
      columns={columns}
      rows={products}
      rowKey={(product) => product.id}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      selection={{
        isSelected: (product) => selectedIds.includes(product.id),
        onToggle: (product) => onToggle(product.id),
        onToggleAll,
        rowLabel: (product) => t("row.select", { name: localize(product.name, locale) }),
        allLabel: t("selectAll"),
      }}
      {...(meta && {
        pagination: {
          "data-testid": "labels-pagination",
          page: meta.page,
          totalPages: Math.max(meta.totalPages, 1),
          perPage: meta.pageSize,
          perPageOptions: PAGE_SIZE_OPTIONS,
          onPageChange,
          onPerPageChange: onPageSizeChange,
        },
      })}
    />
  );
}
