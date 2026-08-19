"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import type { ProductVariantTypeRef } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { cn } from "@/lib/utils";

interface VariantListProps {
  variants: Variant[];
  // Needed to name the type each value belongs to: a variant only references
  // the option value (CLAUDE.md rule 2), while the type name lives on the
  // product, so "أحمر" alone can't say whether it's a colour, size or number.
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

  // Each variant is a photo, a couple of values and two figures — never a
  // screen's worth. Two across from the large-tablet width up, so a product
  // with a dozen sizes is taken in rather than scrolled through; one column
  // on a phone, unchanged.
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {variants.map((variant) => {
        const name = localize(variant.name, locale);
        const outOfStock = variant.stock <= 0;
        const showCost = variant.resolvedCost !== undefined;
        // Each value paired with its variant type, so the row reads as
        // "اللون / أحمر" instead of a bare "أحمر" — same information the edit
        // screen shows, just quieter here.
        const groups = variant.values.map((value) => ({
          id: value.id,
          typeName: typeNameById.get(value.variantTypeId) ?? "",
          value: localize(value.value, locale),
          // What this value means on THIS product (spec.md "Notes on a
          // product's options") — "طول البنطلون ٩٥ سم" under the S it
          // explains, so a note is never separated from the value it belongs
          // to. Empty for almost every value, and nothing is rendered then:
          // no gap, no placeholder, no shift.
          note: localize(value.note, locale),
        }));

        return (
          <div
            key={variant.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            data-test-selector={testSelectorFor("variant-row", variant.id)}
          >
            <ProductImage
              src={variant.images[0]?.thumbnailUrl}
              alt={name}
              className="size-14 shrink-0 rounded-lg"
              sizes="56px"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                {groups.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-1">
                    {groups.map((group) => (
                      <div key={group.id} className="min-w-0">
                        {group.typeName && (
                          <p className="truncate text-[0.6875rem] leading-tight text-muted-foreground">
                            {group.typeName}
                          </p>
                        )}
                        <p className="truncate text-sm font-medium text-foreground">{group.value}</p>
                        {group.note && (
                          <p className="line-clamp-2 text-xs leading-tight text-muted-foreground">{group.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                )}
                <StatusBadge isActive={variant.isActive} />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{variant.sku}</p>
              {/* The code a scan at the counter matches, and whose it is: a
                  size carrying the supplier's own tag needs no label of ours. */}
              {variant.barcode && (
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {variant.barcode}
                  {variant.barcodeSource === BARCODE_SOURCE.SUPPLIER && (
                    <span dir="auto" className="ms-2 font-medium">
                      {t("barcodeSupplierShort")}
                    </span>
                  )}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-foreground">
                  {formatMoney(variant.resolvedPrice, currency, locale)}
                  {showCost && variant.resolvedCost && (
                    <span className="ms-2 text-xs font-normal text-muted-foreground">
                      {t("cost")}: {formatMoney(variant.resolvedCost, currency, locale)}
                    </span>
                  )}
                </span>
                <span className={cn("text-xs font-medium", outOfStock ? "text-destructive" : "text-muted-foreground")}>
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
