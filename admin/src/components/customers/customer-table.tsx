"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge, Table, Typography, type Column, type TableSort } from "@store/ui";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { SELECTABLE } from "@store/shared/lib/nativeGestures";
import type { Pagination } from "@store/shared/types/common";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import type { CustomerSummary } from "@/types/customer";

interface CustomerTableProps {
  customers: CustomerSummary[];
  meta: Pagination | null;
  isRefreshing: boolean;
  sort: TableSort;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

// Rows are `customers-row-<id>`; what they owe is the figure the shop opens this page for.
export function CustomerTable({
  customers,
  meta,
  isRefreshing,
  sort,
  onPageChange,
  onPageSizeChange,
}: CustomerTableProps) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const columns: Column<CustomerSummary>[] = [
    {
      key: "name",
      header: "customers.table.name",
      sortKey: "name",
      primary: true,
      className: "min-w-[12rem] [--cell-max:22rem]",
      render: (customer) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Link
            href={`/customers/${customer.id}`}
            className="rounded-control text-value font-medium text-ink transition-colors hover:text-primary-700 focus-link"
          >
            {customer.name}
          </Link>
          <Typography variant="small" tone="muted" as="span" dir="ltr" className="tabular-nums" {...SELECTABLE}>
            {customer.phone}
          </Typography>
        </div>
      ),
    },
    {
      key: "kept",
      header: "customers.table.kept",
      render: (customer) =>
        customer.keptPieceCount > 0 ? (
          <Badge tone="warning" icon="package">
            {t("table.keptCount", { count: customer.keptPieceCount })}
          </Badge>
        ) : null,
    },
    {
      key: "lastOrderAt",
      header: "customers.table.lastOrder",
      sortKey: "lastOrderAt",
      hideOnMobile: true,
      render: (customer) => (
        <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">
          {customer.lastOrderAt ? formatDate(customer.lastOrderAt, locale) : "—"}
        </Typography>
      ),
    },
    {
      key: "orders",
      header: "customers.table.orders",
      align: "numeric",
      hideOnMobile: true,
      render: (customer) => (
        <Typography variant="body" as="span" className="tabular-nums">
          {customer.orderCount}
        </Typography>
      ),
    },
    {
      key: "balance",
      header: "customers.table.balance",
      sortKey: "balance",
      align: "numeric",
      render: (customer) =>
        Number(customer.balance) > 0 ? (
          <Typography
            variant="body"
            weight="semibold"
            as="span"
            className="whitespace-nowrap tabular-nums text-danger-700"
          >
            {formatMoney(customer.balance)}
          </Typography>
        ) : (
          <Typography variant="small" tone="muted" as="span">
            {t("table.nothingOwed")}
          </Typography>
        ),
    },
  ];

  return (
    <Table
      data-testid="customers"
      columns={columns}
      rows={customers}
      rowKey={(customer) => customer.id}
      isRefreshing={isRefreshing}
      sort={sort}
      {...(meta && {
        pagination: {
          "data-testid": "customers-pagination",
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
