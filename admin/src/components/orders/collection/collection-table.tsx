"use client";

import { useLocale, useTranslations } from "next-intl";
import { Table, Typography, type Column } from "@store/ui";
import type { OrderSummary } from "@organza/shared/types/order";
import { PAGE_SIZE_OPTIONS } from "@organza/shared/constants/pagination";
import { formatDate, formatTime } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useOrderRowMenu } from "@/components/orders/order-row-menu";
import { OrderPhotos, OrderTitle } from "@/components/orders/order-cells";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { CollectionTableProps } from "@/types/order";

// Rows keep their old names: `collection-order-row-<id>`.
const TABLE_NAME = "collection-order";

export function CollectionTable({
  orders,
  meta,
  isRefreshing,
  selectedIds,
  sort,
  onToggle,
  onToggleAll,
  onPageChange,
  onPageSizeChange,
}: CollectionTableProps) {
  const locale = useLocale();
  const t = useTranslations("orders.collection");
  const formatMoney = useMoneyFormatter();
  const menu = useOrderRowMenu();

  const owed = (order: OrderSummary) => order.outstanding ?? order.total;

  const columns: Column<OrderSummary>[] = [
    {
      key: "order",
      header: "orders.table.orderNumber",
      primary: true,
      sortKey: "orderNumber",
      className: "min-w-[13rem] [--cell-max:22rem]",
      // The customer's name is how a courier's sheet is matched against the list.
      render: (order) => <OrderTitle order={order} subtitle={order.customerName} />,
    },
    { key: "photos", header: "orders.table.photos", hideOnMobile: true, render: (order) => <OrderPhotos order={order} /> },
    {
      key: "status",
      header: "orders.table.status",
      render: (order) => <OrderStatusBadge status={order.status} className="whitespace-nowrap" />,
    },
    {
      key: "createdAt",
      header: "orders.table.date",
      sortKey: "createdAt",
      render: (order) => (
        <div className="flex flex-col whitespace-nowrap tabular-nums">
          <Typography variant="body" as="span">
            {formatDate(order.createdAt, locale)}
          </Typography>
          <Typography variant="small" tone="muted" as="span">
            {formatTime(order.createdAt, locale)}
          </Typography>
        </div>
      ),
    },
    {
      key: "owed",
      header: "orders.collection.table.owed",
      sortKey: "total",
      align: "numeric",
      render: (order) => (
        <Typography variant="body" weight="semibold" as="span" className="whitespace-nowrap tabular-nums">
          {formatMoney(owed(order))}
        </Typography>
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
        selection={{
          isSelected: (order) => selectedIds.includes(order.id),
          onToggle: (order) => onToggle(order.id),
          onToggleAll,
          rowLabel: (order) => t("selectOrder", { number: String(order.orderNumber), amount: formatMoney(owed(order)) }),
          allLabel: t("actions.selectAllLabel"),
        }}
        {...(meta && {
          pagination: {
            "data-testid": "collection-pagination",
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
