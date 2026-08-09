import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { resolveStockStatus } from "@shared/lib/stock";
import type { InventoryItem } from "@shared/types/inventory";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { StockBadge, STOCK_FIGURE_TONES } from "@/components/inventory/stock-badge";
import { StockStepper } from "@/components/inventory/stock-stepper";
import { PendingChangeBadge } from "@/components/change-requests/pending-change-badge";
import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS } from "@shared/constants/changeRequest";
import { cn } from "@/lib/utils";
import type { InventoryRow } from "@/types/inventory";

interface InventoryCardProps {
  row: InventoryRow;
  threshold: number;
  canAdjust: boolean;
  onStockChange: (item: InventoryItem, next: number) => void;
}

export function InventoryCard({ row, threshold, canAdjust, onStockChange }: InventoryCardProps) {
  const locale = useLocale();
  const t = useTranslations("inventory.card");
  const { item, stock } = row;
  const productName = localize(item.productName, locale);
  const variantName = item.variantName ? localize(item.variantName, locale) : null;
  // Read from the row's effective quantity, not the server's: the badge and
  // its colour move with the +/- presses instead of waiting for a round trip.
  const status = resolveStockStatus({ stock, trackLowStock: item.trackLowStock, threshold });

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
        <StockBadge stock={stock} trackLowStock={item.trackLowStock} threshold={threshold} className="shrink-0" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t("stockLabel")}
          {/* A quantity somebody has asked to change is spoken for, not
              wrong — saying so here stops two people editing the same figure
              (spec.md "Employee change approvals"). */}
          <PendingChangeBadge
            changes={item.pendingChanges}
            entityType={item.type === "variant" ? CHANGE_REQUEST_ENTITIES.VARIANT : CHANGE_REQUEST_ENTITIES.PRODUCT}
            entityId={item.id}
            field={item.type === "variant" ? CHANGE_REQUEST_FIELDS.VARIANT_STOCK : CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}
          />
        </span>
        {canAdjust ? (
          // Lifted above the card-wide link so +/- and the quantity field stay
          // their own tap targets instead of navigating.
          <div className="relative z-10">
            <StockStepper item={item} stock={stock} edit={row.edit} onChange={onStockChange} />
          </div>
        ) : (
          // The figure takes the status colour, so the number and the badge
          // above it never disagree.
          <span className={cn("text-base font-semibold", STOCK_FIGURE_TONES[status])}>{stock}</span>
        )}
      </div>

      {/* Held on screen on purpose: the user's own edit took it outside the
          filter they are working under, and pulling the row away the instant
          it saved is what made this screen impossible to work down. */}
      {row.isOutsideFilter && (
        <p className="border-t border-dashed border-border pt-2 text-xs text-muted-foreground">
          {t("outsideFilter")}
        </p>
      )}
    </div>
  );
}
