"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface VariantPickerSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onPick: (product: Product, variant: Variant) => void;
}

// Which variant is being ordered. A variant-bearing product's parent is not
// purchasable — it owns neither the price nor the stock — so this is asked
// whenever a search result lands on one (the backend refuses the parent with
// ORDER_VARIANT_REQUIRED).
export function VariantPickerSheet({ product, onOpenChange, onPick }: VariantPickerSheetProps) {
  const t = useTranslations("orders.new.picker");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        {product && (
          <>
            <SheetHeader>
              <SheetTitle>{localize(product.name, locale)}</SheetTitle>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </SheetHeader>

            <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto px-5 pb-5">
              {product.variants.map((variant) => {
                const soldOut = variant.stock <= 0;
                const name = localize(variant.name, locale);

                return (
                  <li key={variant.id}>
                    <button
                      type="button"
                      // Sold-out variants stay visible but can't be picked —
                      // seeing that a size exists and is finished beats
                      // wondering whether it was ever stocked.
                      disabled={soldOut}
                      onClick={() => {
                        onPick(product, variant);
                        onOpenChange(false);
                      }}
                      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors not-disabled:hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium">{name}</span>
                        <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                          {variant.sku}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {soldOut ? t("soldOut") : formatMoney(variant.resolvedPrice)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
