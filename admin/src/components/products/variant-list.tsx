"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Table, type Column } from "@store/ui";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import type { ProductVariantTypeRef } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { SELECTABLE } from "@organza/shared/lib/nativeGestures";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { cn } from "@/lib/utils";

interface VariantListProps {
  variants: Variant[];
  // A variant only references its option value (rule 2); the type name lives on the product.
  variantTypes: ProductVariantTypeRef[];
  currency: string;
}

export function VariantList({ variants, variantTypes, currency }: VariantListProps) {
  const locale = useLocale();
  const t = useTranslations("products.detail");

  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of variantTypes) map.set(type.id, localize(type.name, locale));
    return map;
  }, [variantTypes, locale]);

  const columns: readonly Column<Variant>[] = [
    {
      key: "variant",
      header: "products.detail.variantsTitle",
      primary: true,
      render: (variant) => {
        const name = localize(variant.name, locale);
        return (
          <span className="flex min-w-0 items-center gap-3">
            <ProductImage
              src={variant.images[0]?.thumbnailUrl}
              alt={name}
              className="size-10 shrink-0 rounded-control"
              sizes="40px"
            />
            <span className="flex min-w-0 flex-wrap gap-x-4 gap-y-0.5">
              {variant.values.length === 0 ? (
                <span className="truncate font-medium text-ink">{name}</span>
              ) : (
                variant.values.map((value) => {
                  const note = localize(value.note, locale);
                  return (
                    <span key={value.id} className="min-w-0">
                      <span className="block truncate text-meta text-ink-muted">
                        {typeNameById.get(value.variantTypeId) ?? ""}
                      </span>
                      <span className="block truncate font-medium text-ink">{localize(value.value, locale)}</span>
                      {note && <span className="block line-clamp-2 text-meta text-ink-muted">{note}</span>}
                    </span>
                  );
                })
              )}
            </span>
          </span>
        );
      },
    },
    {
      key: "sku",
      header: "products.detail.variantSku",
      render: (variant) => (
        <span dir="ltr" className="tabular-nums" {...SELECTABLE}>
          {variant.sku}
        </span>
      ),
    },
    {
      key: "barcode",
      header: "products.detail.barcode",
      hideOnMobile: true,
      render: (variant) =>
        variant.barcode ? (
          <span className="flex flex-col items-start">
            <span dir="ltr" className="tabular-nums" {...SELECTABLE}>
              {variant.barcode}
            </span>
            {variant.barcodeSource === BARCODE_SOURCE.SUPPLIER && (
              <span className="text-meta text-ink-muted">{t("barcodeSupplierShort")}</span>
            )}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "price",
      header: "products.detail.variantPrice",
      align: "numeric",
      render: (variant) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{formatMoney(variant.resolvedPrice, currency, locale)}</span>
          {/* Cost reaches this screen for an Admin only (rule 19). */}
          {variant.resolvedCost && (
            <span className="text-meta text-ink-muted">
              {t("cost")}: {formatMoney(variant.resolvedCost, currency, locale)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "stock",
      header: "products.detail.variantStock",
      align: "numeric",
      render: (variant) => (
        <span className={cn("tabular-nums", variant.stock <= 0 ? "font-medium text-danger-600" : "text-ink")}>
          {variant.stock}
        </span>
      ),
    },
    {
      key: "status",
      header: "products.detail.variantStatus",
      besideTitleOnMobile: true,
      render: (variant) => <StatusBadge isActive={variant.isActive} />,
    },
  ];

  return <Table data-testid="variant" columns={columns} rows={variants} rowKey={(variant) => variant.id} />;
}
