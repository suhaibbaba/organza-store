import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { resolveStockStatus } from "@organza/shared/lib/stock";
import type { InventoryItem } from "@organza/shared/types/inventory";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { StockBadge, STOCK_FIGURE_TONES } from "@/components/inventory/stock-badge";
import { StockStepper } from "@/components/inventory/stock-stepper";
import { PendingChangeBadge } from "@/components/change-requests/pending-change-badge";
import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS } from "@organza/shared/constants/changeRequest";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
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
  // The row's effective quantity, so the badge moves with +/- presses before the round trip.
  const status = resolveStockStatus({ stock, trackLowStock: item.trackLowStock, threshold });

  return (
    <div
      className="relative flex flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card transition-colors has-[a:active]:bg-inset"
      data-test-selector={testSelectorFor("inventory-card", item.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* The link's ::after makes the whole card one tap target; the stepper sits above it (z-10). */}
          <Link
            href={`/products/${item.productId}`}
            className="block rounded-control after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <span className="flex items-center gap-1">
              <span className="truncate text-label font-medium text-ink">{productName}</span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
            </span>
            {variantName && <span className="block truncate text-meta text-ink-muted">{variantName}</span>}
          </Link>
          <p className="mt-0.5 truncate text-meta text-ink-muted">{item.sku ?? t("noSku")}</p>
        </div>
        <StockBadge stock={stock} trackLowStock={item.trackLowStock} threshold={threshold} className="shrink-0" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <span className="flex flex-wrap items-center gap-2 text-meta text-ink-muted">
          {t("stockLabel")}
          {/* A pending request marks the figure as spoken for, so two people don't edit it (spec.md approvals). */}
          <PendingChangeBadge
            changes={item.pendingChanges}
            entityType={item.type === "variant" ? CHANGE_REQUEST_ENTITIES.VARIANT : CHANGE_REQUEST_ENTITIES.PRODUCT}
            entityId={item.id}
            field={item.type === "variant" ? CHANGE_REQUEST_FIELDS.VARIANT_STOCK : CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}
          />
        </span>
        {canAdjust ? (
          <div className="relative z-10">
            <StockStepper item={item} stock={stock} edit={row.edit} onChange={onStockChange} />
          </div>
        ) : (
          <span className={cn("text-value font-semibold", STOCK_FIGURE_TONES[status])}>{stock}</span>
        )}
      </div>

      {/* Kept on screen after the user's own edit moved it outside the filter, so the list can be worked down. */}
      {row.isOutsideFilter && (
        <p className="border-t border-dashed border-line pt-2 text-meta text-ink-muted">
          {t("outsideFilter")}
        </p>
      )}
    </div>
  );
}
