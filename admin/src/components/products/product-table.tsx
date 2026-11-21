"use client";

import { useLocale, useTranslations } from "next-intl";
import { Table, Typography, type Column } from "@store/ui";
import type { ProductSummary } from "@organza/shared/types/product";
import { PAGE_SIZE_OPTIONS } from "@organza/shared/constants/pagination";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ProductImage } from "@/components/products/product-image";
import { ProductPhoto } from "@/components/products/product-photo";
import { StatusBadge } from "@/components/products/status-badge";
import { NumberedBadge } from "@/components/products/numbered-badge";
import { IncompleteBadge } from "@/components/products/incomplete-badge";
import { useProductRowMenu } from "@/components/products/product-row-menu";
import type { ProductTableProps } from "@/types/product";

// Rows are named `products-row-<id>` by the Table (its data-testid + "-row-" + rowKey).
const TABLE_NAME = "products";
const THUMB_SIZES = "(max-width: 767px) 80px, 64px";
const VARIANT_THUMB_SIZES = "32px";

export function ProductTable({ products, meta, isLoading, isRefreshing, sort, onPageChange, onPageSizeChange }: ProductTableProps) {
  const locale = useLocale();
  const t = useTranslations("products");
  const formatMoney = useMoneyFormatter();
  const menu = useProductRowMenu();

  function renderProduct(product: ProductSummary) {
    const name = localize(product.name, locale);
    const href = `/products/${product.id}`;
    const details = [
      product.category ? localize(product.category.name, locale) : t("table.noCategory"),
      product.hasVariants ? t("table.variants", { count: product.variantCount }) : null,
    ].filter(Boolean);

    return (
      <div className="flex items-start gap-3">
        {/* Many pieces share a name, so the photo is how the shop tells them apart. */}
        <Link href={href} tabIndex={-1} aria-hidden="true" className="shrink-0" data-test-selector="product-photo">
          <ProductPhoto product={product} alt={name} className="size-20 rounded-control md:size-16" sizes={THUMB_SIZES} />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={href}
            className="rounded-control text-value font-medium text-ink transition-colors hover:text-primary-700 focus-link"
          >
            {name}
          </Link>
          <Typography variant="small" tone="muted" as="span" className="line-clamp-1" data-test-selector="product-details">
            {details.join(" · ")}
          </Typography>
          {product.variantImages.length > 0 && (
            <div className="flex items-center gap-1" data-test-selector="product-variant-photos">
              {product.variantImages.map((image) => (
                <ProductImage key={image.id} src={image.thumbnailUrl} alt="" className="size-8 rounded-chip" sizes={VARIANT_THUMB_SIZES} />
              ))}
            </div>
          )}
          {(product.needsCompleting || product.isNumbered) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {product.needsCompleting && <IncompleteBadge />}
              {product.isNumbered && <NumberedBadge count={product.numberCount} />}
            </div>
          )}
        </div>
      </div>
    );
  }

  const columns: Column<ProductSummary>[] = [
    {
      key: "product",
      header: "products.table.product",
      primary: true,
      sortKey: "slug",
      className: "min-w-[16rem] [--cell-max:26rem]",
      render: renderProduct,
    },
    {
      key: "price",
      header: "products.table.price",
      sortKey: "basePrice",
      align: "numeric",
      render: (product) => (
        <div className="flex flex-col whitespace-nowrap tabular-nums">
          <Typography variant="body" weight="medium" as="span">
            {formatMoney(product.basePrice)}
          </Typography>
          {product.compareAtPrice && (
            <Typography variant="small" tone="muted" as="span" className="line-through">
              {formatMoney(product.compareAtPrice)}
            </Typography>
          )}
        </div>
      ),
    },
    {
      key: "stock",
      header: "products.table.stock",
      sortKey: "stock",
      align: "numeric",
      render: (product) => (
        <Typography
          variant="body"
          weight="medium"
          as="span"
          className={cn("tabular-nums", product.stock <= 0 && "text-danger-600")}
        >
          {product.stock}
        </Typography>
      ),
    },
    {
      key: "status",
      header: "products.table.status",
      render: (product) => <StatusBadge isActive={product.isActive} />,
    },
    ...(menu.hasMenu
      ? [
          {
            key: "actions",
            header: "products.table.actions",
            actions: true,
            besideTitleOnMobile: true,
            align: "end",
            className: "align-top",
            render: menu.renderMenu,
          } satisfies Column<ProductSummary>,
        ]
      : []),
  ];

  return (
    <>
      <Table
        data-testid={TABLE_NAME}
        columns={columns}
        rows={products}
        rowKey={(product) => product.id}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        sort={sort}
        {...(meta && {
          pagination: {
            "data-testid": "products-pagination",
            page: meta.page,
            totalPages: Math.max(meta.totalPages, 1),
            perPage: meta.pageSize,
            perPageOptions: PAGE_SIZE_OPTIONS,
            onPageChange,
            onPerPageChange: onPageSizeChange,
          },
        })}
      />
      {menu.dialog}
    </>
  );
}
