"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
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

interface InventoryTableProps {
  items: InventoryItem[];
  threshold: number;
  canAdjust: boolean;
}

export function InventoryTable({ items, threshold, canAdjust }: InventoryTableProps) {
  const locale = useLocale();
  const t = useTranslations("inventory.card");
  const tTable = useTranslations("inventory.table");

  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      {
        id: "item",
        header: tTable("item"),
        cell: ({ row }) => {
          const item = row.original;
          const name = localize(item.productName, locale);
          const variantName = item.variantName ? localize(item.variantName, locale) : null;
          return (
            // ::after stretches the link over its whole cell, so the item
            // column is clickable end to end. A variant row opens its parent
            // product — variants have no page of their own.
            <Link
              href={`/products/${item.productId}`}
              className="flex min-w-0 items-center gap-2 rounded-md after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{name}</span>
                {variantName && <span className="block truncate text-xs text-muted-foreground">{variantName}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          );
        },
      },
      {
        id: "sku",
        header: tTable("sku"),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.sku ?? t("noSku")}</span>,
      },
      {
        id: "status",
        header: tTable("status"),
        cell: ({ row }) => (
          <StockBadge
            stock={row.original.stock}
            trackLowStock={row.original.trackLowStock}
            threshold={threshold}
          />
        ),
      },
      {
        id: "stock",
        header: tTable("stock"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            {canAdjust ? (
              <StockStepper item={row.original} />
            ) : (
              // The figure takes the status colour, so the number and the
              // badge beside it never disagree.
              <span
                className={cn(
                  "font-medium",
                  STOCK_FIGURE_TONES[
                    resolveStockStatus({
                      stock: row.original.stock,
                      trackLowStock: row.original.trackLowStock,
                      threshold,
                    })
                  ]
                )}
              >
                {row.original.stock}
              </span>
            )}
            {/* Same rule as the mobile card: a figure somebody has asked to
                change is spoken for, not wrong. */}
            <PendingChangeBadge
              changes={row.original.pendingChanges}
              entityType={
                row.original.type === "variant"
                  ? CHANGE_REQUEST_ENTITIES.VARIANT
                  : CHANGE_REQUEST_ENTITIES.PRODUCT
              }
              entityId={row.original.id}
              field={
                row.original.type === "variant"
                  ? CHANGE_REQUEST_FIELDS.VARIANT_STOCK
                  : CHANGE_REQUEST_FIELDS.PRODUCT_STOCK
              }
            />
          </div>
        ),
      },
    ],
    [locale, threshold, canAdjust, t, tTable]
  );

  const table = useReactTable({ data: items, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-secondary-foreground">
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
            <tr key={row.id} className="border-t border-border">
              {/* `relative` scopes the item link's stretched ::after to its own
                  cell, so it never covers the stock stepper. */}
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
