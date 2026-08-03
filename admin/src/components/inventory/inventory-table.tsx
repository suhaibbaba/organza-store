"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import type { InventoryItem } from "@shared/types/inventory";
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
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{name}</p>
              {variantName && <p className="truncate text-xs text-muted-foreground">{variantName}</p>}
            </div>
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
          const stock = row.original.stock;
          const isOut = stock <= 0;
          const isLow = stock > 0 && stock <= threshold;
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
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
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
