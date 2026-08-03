import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { InventoryItem } from "@shared/types/inventory";
import { localize } from "@/lib/i18n-content";
import { StockStepper } from "@/components/inventory/stock-stepper";
import { cn } from "@/lib/utils";

interface InventoryCardProps {
  item: InventoryItem;
  threshold: number;
  canAdjust: boolean;
}

export function InventoryCard({ item, threshold, canAdjust }: InventoryCardProps) {
  const locale = useLocale();
  const t = useTranslations("inventory.card");
  const productName = localize(item.productName, locale);
  const variantName = item.variantName ? localize(item.variantName, locale) : null;
  const isOut = item.stock <= 0;
  const isLow = item.stock > 0 && item.stock <= threshold;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{productName}</p>
          {variantName && <p className="truncate text-xs text-muted-foreground">{variantName}</p>}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.sku ?? t("noSku")}</p>
        </div>
        {(isOut || isLow) && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              isOut ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {isOut ? t("outOfStock") : t("lowStock")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">{t("stockLabel")}</span>
        {canAdjust ? (
          <StockStepper item={item} />
        ) : (
          <span
            className={cn(
              "text-base font-semibold",
              isOut ? "text-destructive" : isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"
            )}
          >
            {item.stock}
          </span>
        )}
      </div>
    </div>
  );
}
