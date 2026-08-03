"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { InventoryItem } from "@shared/types/inventory";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { StockStepper } from "@/components/inventory/stock-stepper";
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
        cell: ({ row }) => {
          const { stock, trackLowStock } = row.original;
          const isOut = stock <= 0;
          // Opt-in only (Product.trackLowStock) — see InventoryCard.
          const isLow = trackLowStock && stock > 0 && stock <= threshold;
          if (!isOut && !isLow) return null;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                isOut ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {isOut ? t("outOfStock") : t("lowStock")}
            </span>
          );
        },
      },
      {
        id: "stock",
        header: tTable("stock"),
        cell: ({ row }) =>
          canAdjust ? (
            <StockStepper item={row.original} />
          ) : (
            <span className="font-medium text-foreground">{row.original.stock}</span>
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
