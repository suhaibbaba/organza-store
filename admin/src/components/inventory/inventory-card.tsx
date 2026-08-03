import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { InventoryItem } from "@shared/types/inventory";
import { Link } from "@/i18n/navigation";
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
  // Low-stock alerts are opt-in per product (Product.trackLowStock): most
  // pieces are one-offs sitting at stock = 1, so badging every small quantity
  // would bury the products that actually need restocking.
  const isLow = item.trackLowStock && item.stock > 0 && item.stock <= threshold;

  return (
    <div className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors has-[a:active]:bg-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* The link's ::after covers the whole card, so the entire card is
              one big tap target. The stock stepper sits above it (z-10) and
              keeps its own taps. */}
          <Link
            href={`/products/${item.productId}`}
            className="block rounded-md after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-1">
              <span className="truncate text-sm font-medium text-foreground">{productName}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
            </span>
            {variantName && <span className="block truncate text-xs text-muted-foreground">{variantName}</span>}
          </Link>
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
          // Lifted above the card-wide link so +/- and the quantity field stay
          // their own tap targets instead of navigating.
          <div className="relative z-10">
            <StockStepper item={item} />
          </div>
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
