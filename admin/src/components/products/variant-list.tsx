"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Variant } from "@shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { cn } from "@/lib/utils";

interface VariantListProps {
  variants: Variant[];
  currency: string;
}

export function VariantList({ variants, currency }: VariantListProps) {
  const locale = useLocale();
  const t = useTranslations("products.detail");

  return (
    <div className="flex flex-col gap-2">
      {variants.map((variant) => {
        const name = localize(variant.name, locale);
        const outOfStock = variant.stock <= 0;
        const showCost = variant.resolvedCost !== undefined;

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
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
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
