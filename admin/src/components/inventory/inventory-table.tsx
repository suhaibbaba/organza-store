"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
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

interface InventoryTableProps {
  rows: InventoryRow[];
  threshold: number;
  canAdjust: boolean;
  onStockChange: (item: InventoryItem, next: number) => void;
}

export function InventoryTable({ rows, threshold, canAdjust, onStockChange }: InventoryTableProps) {
  const locale = useLocale();
  const t = useTranslations("inventory.card");
  const tTable = useTranslations("inventory.table");

  const columns = useMemo<ColumnDef<InventoryRow>[]>(
    () => [
      {
        id: "item",
        header: tTable("item"),
        cell: ({ row }) => {
          const { item } = row.original;
          const name = localize(item.productName, locale);
          const variantName = item.variantName ? localize(item.variantName, locale) : null;
          return (
            // A variant row opens its parent product: variants have no page of their own.
            <Link
              href={`/products/${item.productId}`}
              className="flex min-w-0 items-center gap-2 rounded-control after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{name}</span>
                {variantName && <span className="block truncate text-meta text-ink-muted">{variantName}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          );
        },
      },
      {
        id: "sku",
        header: tTable("sku"),
        cell: ({ row }) => <span className="text-ink-muted">{row.original.item.sku ?? t("noSku")}</span>,
      },
      {
        id: "status",
        header: tTable("status"),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <StockBadge
              stock={row.original.stock}
              trackLowStock={row.original.item.trackLowStock}
              threshold={threshold}
            />
            {/* Kept on screen after the user's own edit moved it outside the filter. */}
            {row.original.isOutsideFilter && (
              <span className="text-meta text-ink-muted">{t("outsideFilter")}</span>
            )}
          </span>
        ),
      },
      {
        id: "stock",
        header: tTable("stock"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            {canAdjust ? (
              <StockStepper
                item={row.original.item}
                stock={row.original.stock}
                edit={row.original.edit}
                onChange={onStockChange}
              />
            ) : (
              <span
                className={cn(
                  "font-medium",
                  STOCK_FIGURE_TONES[
                    resolveStockStatus({
                      stock: row.original.stock,
                      trackLowStock: row.original.item.trackLowStock,
                      threshold,
                    })
                  ]
                )}
              >
                {row.original.stock}
              </span>
            )}
            <PendingChangeBadge
              changes={row.original.item.pendingChanges}
              entityType={
                row.original.item.type === "variant"
                  ? CHANGE_REQUEST_ENTITIES.VARIANT
                  : CHANGE_REQUEST_ENTITIES.PRODUCT
              }
              entityId={row.original.item.id}
              field={
                row.original.item.type === "variant"
                  ? CHANGE_REQUEST_FIELDS.VARIANT_STOCK
                  : CHANGE_REQUEST_FIELDS.PRODUCT_STOCK
              }
            />
          </div>
        ),
      },
    ],
    [locale, threshold, canAdjust, onStockChange, t, tTable]
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card" data-test-selector="inventory-table">
      <table className="w-full text-label">
        <thead className="bg-table-head text-ink-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 text-start font-medium">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-t border-line hover:bg-row-hover"
              data-test-selector={testSelectorFor("inventory-row", row.original.item.id)}
            >
              {/* `relative` keeps the item link's ::after inside its cell, off the stepper. */}
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="relative px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
