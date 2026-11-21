"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import type { ProductVariantTypeRef } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
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

  // variantTypeId -> translated type name (e.g. "اللون", "المقاس", "الأرقام").
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of variantTypes) map.set(type.id, localize(type.name, locale));
    return map;
  }, [variantTypes, locale]);

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {variants.map((variant) => {
        const name = localize(variant.name, locale);
        const outOfStock = variant.stock <= 0;
        const showCost = variant.resolvedCost !== undefined;
        const groups = variant.values.map((value) => ({
          id: value.id,
          typeName: typeNameById.get(value.variantTypeId) ?? "",
          value: localize(value.value, locale),
          // What this value means on THIS product (spec.md "Notes on a product's options").
          note: localize(value.note, locale),
        }));

        return (
          <div
            key={variant.id}
            className="flex items-center gap-3 rounded-panel border border-line bg-surface p-3"
            data-test-selector={testSelectorFor("variant-row", variant.id)}
          >
            <ProductImage
              src={variant.images[0]?.thumbnailUrl}
              alt={name}
              className="size-14 shrink-0 rounded-control"
              sizes="56px"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                {groups.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-1">
                    {groups.map((group) => (
                      <div key={group.id} className="min-w-0">
                        {group.typeName && (
                          <p className="truncate text-micro text-ink-muted">
                            {group.typeName}
                          </p>
                        )}
                        <p className="truncate text-label font-medium text-ink">{group.value}</p>
                        {group.note && (
                          <p className="line-clamp-2 text-micro text-ink-muted">{group.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="truncate text-label font-medium text-ink">{name}</p>
                )}
                <StatusBadge isActive={variant.isActive} />
              </div>
              <p className="mt-0.5 truncate text-micro text-ink-muted" {...SELECTABLE}>
                {variant.sku}
              </p>
              {variant.barcode && (
                <p className="truncate text-micro text-ink-muted" dir="ltr" {...SELECTABLE}>
                  {variant.barcode}
                  {variant.barcodeSource === BARCODE_SOURCE.SUPPLIER && (
                    <span dir="auto" className="ms-2 font-medium">
                      {t("barcodeSupplierShort")}
                    </span>
                  )}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-label font-semibold text-ink">
                  {formatMoney(variant.resolvedPrice, currency, locale)}
                  {showCost && variant.resolvedCost && (
                    <span className="ms-2 text-micro font-normal text-ink-muted">
                      {t("cost")}: {formatMoney(variant.resolvedCost, currency, locale)}
                    </span>
                  )}
                </span>
                <span className={cn("text-micro font-medium", outOfStock ? "text-danger-600" : "text-ink-muted")}>
                  {t("variantStock")}: {variant.stock}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
