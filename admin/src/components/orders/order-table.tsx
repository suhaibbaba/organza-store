"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import type { OrderSummary } from "@shared/types/order";
import { isOrderCollectable } from "@shared/lib/orders";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";

// Desktop-only view of the same orders the cards show on a phone. Same data,
// same order, same tap targets — just laid out across a wider screen.
export function OrderTable({ orders }: { orders: OrderSummary[] }) {
  const locale = useLocale();
  const t = useTranslations("orders.card");
  const tTable = useTranslations("orders.table");
  const formatMoney = useMoneyFormatter();

  const columns = useMemo<ColumnDef<OrderSummary>[]>(
    () => [
      {
        id: "orderNumber",
        header: tTable("orderNumber"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* ::after stretches the link over its whole cell, so the number
                column is clickable end to end. */}
            <Link
              href={`/orders/${row.original.id}`}
              className="flex min-w-0 items-center gap-2 rounded-md after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-foreground">
                {t("orderNumber", { number: String(row.original.orderNumber) })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
            </Link>
            {/* Beside the number rather than in the Channel column: a gift is
                not a channel (it is a STORE order like any counter sale), and
                what it changes is what the row's total means. Renders nothing
                for an ordinary sale. */}
            <OrderTypeBadge type={row.original.type} />
          </div>
        ),
      },
      {
        id: "channel",
        header: tTable("channel"),
        cell: ({ row }) => <OrderChannelBadge channel={row.original.channel} />,
      },
      {
        id: "status",
        header: tTable("status"),
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: "paymentStatus",
        header: tTable("payment"),
        // A cancelled or returned sale owes nothing, so it shows no payment
        // state rather than a debt that doesn't exist.
        cell: ({ row }) =>
          isOrderCollectable(row.original.status) ? (
            <PaymentStatusBadge status={row.original.paymentStatus} />
          ) : (
            <span className="text-muted-foreground">{tTable("noPayment")}</span>
          ),
      },
      {
        id: "customer",
        header: tTable("customer"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.customerName ?? tTable("noCustomer")}</span>
        ),
      },
      {
        id: "createdAt",
        header: tTable("date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.createdAt, locale)}
          </span>
        ),
      },
      {
        id: "total",
        header: tTable("total"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">{formatMoney(row.original.total)}</span>
        ),
      },
    ],
    [locale, t, tTable, formatMoney]
  );

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });

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
              {/* `relative` scopes the number link's stretched ::after to its
                  own cell. */}
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
