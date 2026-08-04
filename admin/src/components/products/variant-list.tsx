"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProductVariantTypeRef } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
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

  return (
    <div className="flex flex-col gap-2">
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
        }));

        return (
          <div key={variant.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                )}
                <StatusBadge isActive={variant.isActive} />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{variant.sku}</p>
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
