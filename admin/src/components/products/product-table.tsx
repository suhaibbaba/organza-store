"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Table, type Column } from "@store/ui";
import type { ProductSummary } from "@organza/shared/types/product";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { NumberedBadge } from "@/components/products/numbered-badge";
import { IncompleteBadge } from "@/components/products/incomplete-badge";
import { cn } from "@/lib/utils";

interface ProductTableProps {
  products: ProductSummary[];
  currency: string;
}

// Rows are named `products-row-<id>` by the Table itself (its data-testid + "-row-" + rowKey).
const TABLE_NAME = "products";

export function ProductTable({ products, currency }: ProductTableProps) {
  const locale = useLocale();
  const t = useTranslations("products");

  const columns = useMemo<Column<ProductSummary>[]>(
    () => [
      {
        key: "product",
        header: "products.table.product",
        primary: true,
        render: (product) => {
          const name = localize(product.name, locale);
          return (
            <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
              <Link
                href={`/products/${product.id}`}
                className="group inline-flex min-w-0 max-w-full items-start gap-3 rounded-control focus-visible:bg-primary-100"
              >
                <ProductImage
                  src={product.image?.thumbnailUrl}
                  alt={name}
                  className="size-11 shrink-0 rounded-chip"
                  sizes="44px"
                />
                <span className="min-w-0 font-medium text-ink transition-colors group-hover:text-primary-700 group-focus-visible:text-primary-900 group-focus-visible:underline">{name}</span>
              </Link>
              {product.needsCompleting && <IncompleteBadge />}
              {product.isNumbered && <NumberedBadge count={product.numberCount} />}
            </div>
          );
        },
      },
      {
        key: "sku",
        header: "products.table.sku",
        render: (product) => <span className="text-ink-muted">{product.sku ?? t("card.multipleSkus")}</span>,
      },
      {
        key: "price",
        header: "products.table.price",
        align: "numeric",
        render: (product) => formatMoney(product.basePrice, currency, locale),
      },
      {
        key: "stock",
        header: "products.table.stock",
        align: "numeric",
        render: (product) => (
          <span className={cn("font-medium", product.stock <= 0 ? "text-danger-600" : "text-ink")}>
            {product.stock}
          </span>
        ),
      },
      {
        key: "status",
        header: "products.table.status",
        render: (product) => <StatusBadge isActive={product.isActive} />,
      },
    ],
    [locale, currency, t]
  );

  return (
    <div data-test-selector="products-table">
      <Table data-testid={TABLE_NAME} columns={columns} rows={products} rowKey={(product) => product.id} />
    </div>
  );
}
