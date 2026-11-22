"use client";

import { useLocale, useTranslations } from "next-intl";
import { Table, Typography, type Column, type TableSort } from "@store/ui";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { SELECTABLE } from "@store/shared/lib/nativeGestures";
import type { Pagination } from "@store/shared/types/common";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import type { SupplierSummary } from "@/types/supplier";

interface SupplierTableProps {
  suppliers: SupplierSummary[];
  meta: Pagination | null;
  isRefreshing: boolean;
  sort: TableSort;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

// Rows are `suppliers-row-<id>`; what the shop owes them is the figure this page is opened for.
export function SupplierTable({
  suppliers,
  meta,
  isRefreshing,
  sort,
  onPageChange,
  onPageSizeChange,
}: SupplierTableProps) {
  const t = useTranslations("suppliers");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const columns: Column<SupplierSummary>[] = [
    {
      key: "name",
      header: "suppliers.table.name",
      sortKey: "name",
      primary: true,
      className: "min-w-[12rem] [--cell-max:22rem]",
      render: (supplier) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Link
            href={`/suppliers/${supplier.id}`}
            className="rounded-control text-value font-medium text-ink transition-colors hover:text-primary-700 focus-link"
          >
            {supplier.name}
          </Link>
          {supplier.phone && (
            <Typography variant="small" tone="muted" as="span" dir="ltr" className="tabular-nums" {...SELECTABLE}>
              {supplier.phone}
            </Typography>
          )}
        </div>
      ),
    },
    {
      key: "lastInvoiceAt",
      header: "suppliers.table.lastInvoice",
      sortKey: "lastInvoiceAt",
      hideOnMobile: true,
      render: (supplier) => (
        <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">
          {supplier.lastInvoiceAt ? formatDate(supplier.lastInvoiceAt, locale) : "—"}
        </Typography>
      ),
    },
    {
      key: "invoices",
      header: "suppliers.table.invoices",
      align: "numeric",
      hideOnMobile: true,
      render: (supplier) => (
        <Typography variant="body" as="span" className="tabular-nums">
          {supplier.invoiceCount}
        </Typography>
      ),
    },
    {
      key: "balance",
      header: "suppliers.table.balance",
      sortKey: "balance",
      align: "numeric",
      render: (supplier) =>
        Number(supplier.balance) > 0 ? (
          <Typography
            variant="body"
            weight="semibold"
            as="span"
            className="whitespace-nowrap tabular-nums text-danger-700"
          >
            {formatMoney(supplier.balance)}
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
      data-testid="suppliers"
      columns={columns}
      rows={suppliers}
      rowKey={(supplier) => supplier.id}
      isRefreshing={isRefreshing}
      sort={sort}
      {...(meta && {
        pagination: {
          "data-testid": "suppliers-pagination",
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
