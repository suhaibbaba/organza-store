"use client";

import { useLocale, useTranslations } from "next-intl";
import { Drawer, Typography } from "@store/ui";
import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

interface VariantPickerSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onPick: (product: Product, variant: Variant) => void;
}

// A variant-bearing parent is not purchasable (backend: ORDER_VARIANT_REQUIRED), so a variant is always asked for.
export function VariantPickerSheet({ product, onOpenChange, onPick }: VariantPickerSheetProps) {
  const t = useTranslations("orders.new.picker");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <Drawer
      open={product !== null}
      onOpenChange={onOpenChange}
      title={product ? localize(product.name, locale) : ""}
      descriptionKey="orders.new.picker.subtitle"
      data-testid="sheet-variant-picker"
    >
      {product && (
        <div className="flex flex-col gap-3">
          <Typography variant="small" tone="muted">{t("subtitle")}</Typography>

          <ul className="flex flex-col gap-2">
            {product.variants.map((variant) => {
              const soldOut = variant.stock <= 0;
              const name = localize(variant.name, locale);

              return (
                <li key={variant.id}>
                  <button
                    type="button"
                    // Sold-out variants stay visible but can't be picked: seeing a size is finished beats wondering if it was ever stocked.
                    disabled={soldOut}
                    onClick={() => {
                      onPick(product, variant);
                      onOpenChange(false);
                    }}
                    className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-panel border border-line bg-surface p-3 text-start transition-colors not-disabled:hover:bg-row-hover focus-visible:bg-inset disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <Typography variant="h3" as="span" className="block truncate">{name}</Typography>
                      <Typography variant="caption" tone="muted" className="block truncate" dir="ltr">
                        {variant.sku}
                      </Typography>
                    </span>
                    <Typography variant="small" tone="muted" as="span" className="shrink-0">
                      {soldOut ? t("soldOut") : formatMoney(variant.resolvedPrice)}
                    </Typography>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
