"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { ProductSummary } from "@shared/types/product";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { NumberedBadge } from "@/components/products/numbered-badge";
import { cn } from "@/lib/utils";

interface ProductTableProps {
  products: ProductSummary[];
  currency: string;
}

export function ProductTable({ products, currency }: ProductTableProps) {
  const locale = useLocale();
  const t = useTranslations("products");
  const tTable = useTranslations("products.table");

  const columns = useMemo<ColumnDef<ProductSummary>[]>(
    () => [
      {
        id: "product",
        header: tTable("product"),
        cell: ({ row }) => {
          const product = row.original;
          const name = localize(product.name, locale);
          return (
            <div className="flex items-center gap-3">
              <ProductImage src={product.image?.thumbnailUrl} alt={name} className="size-11 shrink-0 rounded-md" sizes="44px" />
              <span className="truncate font-medium text-foreground">{name}</span>
              {product.isNumbered && <NumberedBadge count={product.numberCount} />}
            </div>
          );
        },
      },
      {
        id: "sku",
        header: tTable("sku"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.sku ?? t("card.multipleSkus")}</span>
        ),
      },
      {
        id: "price",
        header: tTable("price"),
        cell: ({ row }) => formatMoney(row.original.basePrice, currency, locale),
      },
      {
        id: "stock",
        header: tTable("stock"),
        cell: ({ row }) => {
          const stock = row.original.stock;
          return (
            <span className={cn("font-medium", stock <= 0 ? "text-destructive" : "text-foreground")}>{stock}</span>
          );
        },
      },
      {
        id: "status",
        header: tTable("status"),
        cell: ({ row }) => <StatusBadge isActive={row.original.isActive} />,
      },
    ],
    [locale, currency, t, tTable]
  );

  const table = useReactTable({ data: products, columns, getCoreRowModel: getCoreRowModel() });

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
                <td key={cell.id} className="px-4 py-3">
                  {cell.column.id === "product" ? (
                    <Link href={`/products/${row.original.id}`} className="block hover:underline">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  ) : (
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
