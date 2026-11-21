"use client";

import { useLocale } from "next-intl";
import { Table, type Column, type TableSort, Typography } from "@store/ui";
import type { OrderSummary } from "@store/shared/types/order";
import type { Pagination } from "@store/shared/types/common";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { isOrderCollectable } from "@store/shared/lib/orders";
import { formatDate, formatTime } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useOrderRowMenu } from "@/components/orders/order-row-menu";
import { OrderPhotos, OrderTitle } from "@/components/orders/order-cells";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";

// Rows are named `orders-row-<id>` by the Table (its data-testid + "-row-" + rowKey).
const TABLE_NAME = "orders";

interface OrderTableProps {
  orders: OrderSummary[];
  meta: Pagination | null;
  isRefreshing: boolean;
  sort: TableSort;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function OrderTable({ orders, meta, isRefreshing, sort, onPageChange, onPageSizeChange }: OrderTableProps) {
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const menu = useOrderRowMenu();

  const columns: Column<OrderSummary>[] = [
    {
      key: "order",
      header: "orders.table.orderNumber",
      primary: true,
      sortKey: "orderNumber",
      // Two lines of piece names need more room than the Table's default cell cap.
      className: "min-w-[13rem] [--cell-max:22rem]",
      render: (order) => <OrderTitle order={order} />,
    },
    {
      key: "photos",
      header: "orders.table.photos",
      hideOnMobile: true,
      render: (order) => <OrderPhotos order={order} />,
    },
    {
      key: "status",
      header: "orders.table.status",
      render: (order) => <OrderStatusBadge status={order.status} className="whitespace-nowrap" />,
    },
    {
      key: "payment",
      header: "orders.table.payment",
      // A cancelled or returned sale owes nothing, so it carries no payment state.
      render: (order) =>
        isOrderCollectable(order.status) ? (
          <PaymentStatusBadge status={order.paymentStatus} className="whitespace-nowrap" />
        ) : null,
    },
    {
      key: "createdAt",
      header: "orders.table.date",
      sortKey: "createdAt",
      render: (order) => (
        <div className="flex flex-col whitespace-nowrap tabular-nums">
          <Typography variant="body" as="span">{formatDate(order.createdAt, locale)}</Typography>
          <Typography variant="small" tone="muted" as="span">{formatTime(order.createdAt, locale)}</Typography>
        </div>
      ),
    },
    {
      key: "total",
      header: "orders.table.total",
      sortKey: "total",
      align: "numeric",
      render: (order) => (
        <Typography variant="body" weight="medium" as="span" className="whitespace-nowrap tabular-nums">{formatMoney(order.total)}</Typography>
      ),
    },
    {
      key: "actions",
      header: "orders.table.actions",
      actions: true,
      besideTitleOnMobile: true,
      align: "end",
      className: "align-top",
      render: menu.renderMenu,
    },
  ];

  return (
    <>
      <Table
        data-testid={TABLE_NAME}
        columns={columns}
        rows={orders}
        rowKey={(order) => order.id}
        isRefreshing={isRefreshing}
        sort={sort}
        {...(meta && {
          pagination: {
            "data-testid": "orders-pagination",
            page: meta.page,
            totalPages: Math.max(meta.totalPages, 1),
            perPage: meta.pageSize,
            perPageOptions: PAGE_SIZE_OPTIONS,
            onPageChange,
            onPerPageChange: onPageSizeChange,
          },
        })}
      />
      {menu.dialog}
    </>
  );
}
