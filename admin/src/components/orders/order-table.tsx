"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { ChevronRight } from "lucide-react";
import type { OrderSummary } from "@organza/shared/types/order";
import { isOrderCollectable } from "@organza/shared/lib/orders";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTypeBadge } from "@/components/orders/order-type-badge";
import { QuickSaleBadge } from "@/components/orders/quick-sale-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";

// Desktop-only view of the same orders the cards show on a phone.
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
            {/* ::after stretches the link over its whole cell. */}
            <Link
              href={`/orders/${row.original.id}`}
              className="flex min-w-0 items-center gap-2 rounded-control group after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="font-medium text-ink transition-colors group-hover:text-primary-700">
                {t("orderNumber", { number: String(row.original.orderNumber) })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
            </Link>
            {/* Beside the number, not in Channel: a gift is not a channel, it changes what the total means. */}
            <OrderTypeBadge type={row.original.type} />
            {/* Typed at the counter, so its cost may still be missing (spec.md "Quick sell"). */}
            {row.original.hasQuickSale && <QuickSaleBadge />}
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
        // A cancelled or returned sale owes nothing, so it shows no payment state.
        cell: ({ row }) =>
          isOrderCollectable(row.original.status) ? (
            <PaymentStatusBadge status={row.original.paymentStatus} />
          ) : (
            <span className="text-ink-muted">{tTable("noPayment")}</span>
          ),
      },
      {
        id: "customer",
        header: tTable("customer"),
        cell: ({ row }) => (
          <span className="text-ink-muted">{row.original.customerName ?? tTable("noCustomer")}</span>
        ),
      },
      {
        id: "createdAt",
        header: tTable("date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-ink-muted">
            {formatDateTime(row.original.createdAt, locale)}
          </span>
        ),
      },
      {
        id: "total",
        header: tTable("total"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-ink">{formatMoney(row.original.total)}</span>
        ),
      },
    ],
    [locale, t, tTable, formatMoney]
  );

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card" data-test-selector="orders-table">
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
              className="border-t border-line transition-colors hover:bg-row-hover"
              data-test-selector={testSelectorFor("orders-row", row.original.id)}
            >
              {/* `relative` scopes the number link's stretched ::after to its own cell. */}
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
