"use client";

import { useLocale, useTranslations } from "next-intl";
import { QuantityStepper, Table, type Column } from "@store/ui";
import { resolveStockStatus } from "@store/shared/lib/stock";
import type { InventoryItem } from "@store/shared/types/inventory";
import type { Pagination } from "@store/shared/types/common";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS } from "@store/shared/constants/changeRequest";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { ProductImage } from "@/components/products/product-image";
import { INVENTORY_THUMB_SIZES } from "@/constants/inventory";
import { StockBadge, STOCK_FIGURE_TONES } from "@/components/inventory/stock-badge";
import { PendingChangeBadge } from "@/components/change-requests/pending-change-badge";
import { cn } from "@/lib/utils";
import type { InventoryRow } from "@/types/inventory";

// Rows are named `inventory-row-<id>` by the Table (its data-testid + "-row-" + rowKey).
const TABLE_NAME = "inventory";

interface InventoryTableProps {
  rows: InventoryRow[];
  meta: Pagination | null;
  threshold: number;
  canAdjust: boolean;
  isRefreshing: boolean;
  onStockChange: (item: InventoryItem, next: number) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function InventoryTable({
  rows,
  meta,
  threshold,
  canAdjust,
  isRefreshing,
  onStockChange,
  onPageChange,
  onPageSizeChange,
}: InventoryTableProps) {
  const locale = useLocale();
  const t = useTranslations("inventory");

  function renderStock(row: InventoryRow) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canAdjust ? (
          <QuantityStepper
            name={row.item.id}
            testName="stock"
            value={row.stock}
            onChange={(next) => onStockChange(row.item, next)}
            decreaseLabel={t("stepper.decrease")}
            increaseLabel={t("stepper.increase")}
            valueLabel={t("stepper.quantity")}
            className={cn(
              row.failed && "border-danger-500 ring-2 ring-danger-500/20",
              row.changed && !row.failed && "border-primary-600 ring-2 ring-primary-600/20",
            )}
          />
        ) : (
          <span
            className={cn(
              "text-value tabular-nums",
              STOCK_FIGURE_TONES[
                resolveStockStatus({
                  stock: row.stock,
                  trackLowStock: row.item.trackLowStock,
                  threshold,
                })
              ],
            )}
          >
            {row.stock}
          </span>
        )}
        <StockBadge stock={row.stock} trackLowStock={row.item.trackLowStock} threshold={threshold} />
        <PendingChangeBadge
          changes={row.item.pendingChanges}
          entityType={row.item.type === "variant" ? CHANGE_REQUEST_ENTITIES.VARIANT : CHANGE_REQUEST_ENTITIES.PRODUCT}
          entityId={row.item.id}
          field={
            row.item.type === "variant" ? CHANGE_REQUEST_FIELDS.VARIANT_STOCK : CHANGE_REQUEST_FIELDS.PRODUCT_STOCK
          }
        />
      </div>
    );
  }

  const columns: Column<InventoryRow>[] = [
    {
      key: "item",
      header: "inventory.table.item",
      primary: true,
      render: (row) => {
        const { item } = row;
        const name = localize(item.productName, locale);
        const href = `/products/${item.productId}`;
        // A variant row opens its parent product: variants have no page of their own.
        return (
          <div className="flex items-start gap-3">
            <Link href={href} tabIndex={-1} aria-hidden="true" className="shrink-0">
              <ProductImage
                src={item.thumbnailUrl}
                alt={name}
                className="size-20 rounded-control md:size-16"
                sizes={INVENTORY_THUMB_SIZES}
              />
            </Link>
            <div className="flex min-w-0 flex-col gap-2">
              <Link href={href} className="group self-start rounded-control focus-visible:bg-primary-100">
                <span className="block text-value text-ink transition-colors group-hover:text-primary-700 group-focus-visible:text-primary-900 group-focus-visible:underline">
                  {name}
                </span>
                {item.variantName && (
                  <span className="block text-label text-ink-muted">{localize(item.variantName, locale)}</span>
                )}
              </Link>
              <div className="md:hidden">{renderStock(row)}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "stock",
      header: "inventory.table.stock",
      hideOnMobile: true,
      render: renderStock,
    },
  ];

  return (
    <Table
      data-testid={TABLE_NAME}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.item.id}
      isRefreshing={isRefreshing}
      {...(meta && {
        pagination: {
          "data-testid": "inventory-pagination",
          page: meta.page,
          totalPages: Math.max(meta.totalPages, 1),
          perPage: meta.pageSize,
          perPageOptions: PAGE_SIZE_OPTIONS,
          onPageChange,
          onPerPageChange: onPageSizeChange,
        },
      })}
    />
  );
}
