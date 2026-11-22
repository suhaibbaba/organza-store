"use client";

import { useLocale, useTranslations } from "next-intl";
import { FileText, History } from "lucide-react";
import { Badge, EmptyState, MenuItem, RowMenu, Table, Typography, useConfirm, useToast, type Column } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { useSession } from "@/components/providers/session-provider";
import { DetailCard } from "@/components/layout/detail-card";
import { useDeleteSupplierInvoiceMutation } from "@/hooks/use-suppliers";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { errorMessageKey } from "@/lib/error-message-key";
import { formatDate, formatDateTime } from "@/lib/format";
import type { SupplierDetail, SupplierInvoiceRow } from "@/types/supplier";

function invoiceLabel(invoice: { invoiceNumber: string | null }, fallback: string): string {
  return invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : fallback;
}

interface SupplierInvoicesProps {
  supplier: SupplierDetail;
  onEdit: (invoice: SupplierInvoiceRow) => void;
  onPay: (invoice: SupplierInvoiceRow) => void;
}

// Each invoice with what is paid and what is left; rows are `supplier-invoices-row-<id>`.
export function SupplierInvoices({ supplier, onEdit, onPay }: SupplierInvoicesProps) {
  const t = useTranslations("suppliers.detail.invoices");
  const locale = useLocale();
  const { user } = useSession();
  const toast = useToast();
  const formatMoney = useMoneyFormatter();
  const remove = useDeleteSupplierInvoiceMutation(supplier.id);
  const { confirm, dialog } = useConfirm("supplier-invoice-delete-confirm");
  const canManage = can(user, "supplier.manage");
  const canPay = can(user, "supplier.pay");

  function requestDelete(invoice: SupplierInvoiceRow) {
    confirm({
      title: "suppliers.detail.invoices.deleteTitle",
      titleValues: { name: invoiceLabel(invoice, formatDate(invoice.invoiceDate, locale)) },
      consequences: [t("deleteConsequence")],
      confirmLabel: "suppliers.detail.invoices.deleteAction",
      onConfirm: async () => {
        try {
          await remove.mutateAsync(invoice.id);
          toast.success("suppliers.detail.invoices.deleted");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  const columns: Column<SupplierInvoiceRow>[] = [
    {
      key: "invoice",
      header: "suppliers.detail.invoices.invoice",
      primary: true,
      className: "min-w-[11rem] [--cell-max:18rem]",
      render: (invoice) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Typography variant="body" weight="medium" as="span" className="whitespace-nowrap tabular-nums">
            {formatDate(invoice.invoiceDate, locale)}
          </Typography>
          <Typography variant="small" tone="muted" as="span" dir="ltr" className="tabular-nums">
            {invoiceLabel(invoice, t("noNumber"))}
          </Typography>
          {invoice.note && (
            <Typography variant="small" tone="muted" as="span" className="line-clamp-2 break-words">
              {invoice.note}
            </Typography>
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: "suppliers.detail.invoices.total",
      align: "numeric",
      render: (invoice) => (
        <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">
          {formatMoney(invoice.total)}
        </Typography>
      ),
    },
    {
      key: "paid",
      header: "suppliers.detail.invoices.paid",
      align: "numeric",
      hideOnMobile: true,
      render: (invoice) => (
        <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums text-success-700">
          {formatMoney(invoice.paidAmount)}
        </Typography>
      ),
    },
    {
      key: "balance",
      header: "suppliers.detail.invoices.balance",
      align: "numeric",
      render: (invoice) =>
        Number(invoice.balance) > 0 ? (
          <div className="flex flex-col items-end gap-1">
            <Typography
              variant="body"
              weight="semibold"
              as="span"
              className="whitespace-nowrap tabular-nums text-danger-700"
            >
              {formatMoney(invoice.balance)}
            </Typography>
            {Number(invoice.paidAmount) > 0 && <Badge tone="warning">{t("partial")}</Badge>}
          </div>
        ) : (
          <Badge tone="success" icon="check">
            {t("paidOff")}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "suppliers.detail.invoices.actions",
      actions: true,
      besideTitleOnMobile: true,
      className: "align-top",
      render: (invoice) => {
        const payable = canPay && Number(invoice.balance) > 0;
        const deletable = canManage && invoice.paymentCount === 0;
        if (!payable && !canManage) {
          return null;
        }
        return (
          <RowMenu data-testid={`supplier-invoice-menu-${invoice.id}`} label={t("menuLabel")}>
            {payable && (
              <MenuItem icon="wallet" data-testid="supplier-invoice-menu-pay" onSelect={() => onPay(invoice)}>
                {t("pay")}
              </MenuItem>
            )}
            {canManage && (
              <MenuItem icon="edit" data-testid="supplier-invoice-menu-edit" onSelect={() => onEdit(invoice)}>
                {t("edit")}
              </MenuItem>
            )}
            {deletable && (
              <MenuItem
                icon="error"
                tone="danger"
                data-testid="supplier-invoice-menu-delete"
                onSelect={() => requestDelete(invoice)}
              >
                {t("delete")}
              </MenuItem>
            )}
          </RowMenu>
        );
      },
    },
  ];

  return (
    <DetailCard icon={FileText} title={t("title", { count: supplier.invoices.length })} data-testid="supplier-invoices">
      {supplier.invoices.length === 0 ? (
        <EmptyState
          data-testid="supplier-invoices-empty"
          icon="receipt"
          title="suppliers.detail.invoices.emptyTitle"
          hint="suppliers.detail.invoices.emptyHint"
        />
      ) : (
        <Table
          data-testid="supplier-invoices"
          columns={columns}
          rows={supplier.invoices}
          rowKey={(invoice) => invoice.id}
        />
      )}
      {dialog}
    </DetailCard>
  );
}

// Every payment, newest first, with whether it left the till.
export function SupplierPayments({ supplier }: { supplier: SupplierDetail }) {
  const t = useTranslations("suppliers.detail.payments");
  const tInvoices = useTranslations("suppliers.detail.invoices");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <DetailCard icon={History} title={t("title")} data-testid="supplier-payments">
      {supplier.payments.length === 0 ? (
        <Typography variant="small" tone="muted">
          {t("none")}
        </Typography>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
          {supplier.payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-start justify-between gap-3 px-3 py-2.5"
              data-test-selector={testSelectorFor("supplier-payment", payment.id)}
            >
              <div className="flex min-w-0 flex-col items-start gap-0.5">
                <Typography variant="small" tone="muted" as="span">
                  {formatDateTime(payment.paidAt, locale)}
                  {payment.paidBy ? ` · ${payment.paidBy.name}` : ""}
                </Typography>
                <Typography variant="small" as="span">
                  {tInvoices("invoice")}{" "}
                  <bdi dir="ltr" className="tabular-nums">
                    {invoiceLabel(payment, tInvoices("noNumber"))}
                  </bdi>
                  {" · "}
                  <bdi className="tabular-nums">{formatDate(payment.invoiceDate, locale)}</bdi>
                </Typography>
                <Badge tone={payment.fromDrawer ? "warning" : "neutral"}>
                  {payment.fromDrawer ? t("fromDrawer") : t("notFromDrawer")}
                </Badge>
                {payment.note && (
                  <Typography variant="small" tone="muted" as="span" className="break-words">
                    {payment.note}
                  </Typography>
                )}
              </div>
              <Typography variant="body" weight="medium" as="span" dir="ltr" className="shrink-0 tabular-nums">
                {formatMoney(payment.amount)}
              </Typography>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}
