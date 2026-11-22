"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { History, Package, ReceiptText } from "lucide-react";
import { Button, EmptyState, Table, Typography, useConfirm, useToast, type Column } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { useSession } from "@/components/providers/session-provider";
import { DetailCard } from "@/components/layout/detail-card";
import { ProductImage } from "@/components/products/product-image";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/orders/payment-status-badge";
import { useHandOverItemsMutation } from "@/hooks/use-customers";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Link } from "@/i18n/navigation";
import { errorMessageKey } from "@/lib/error-message-key";
import { formatDate, formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { ORDER_THUMB_SIZES } from "@/constants/orders";
import type { CustomerDetail, CustomerKeptPiece, CustomerOrderRow } from "@/types/customer";

// Pieces sold on credit and still waiting in the shop for this customer.
export function CustomerKeptPieces({ customer }: { customer: CustomerDetail }) {
  const t = useTranslations("customers.detail.kept");
  const locale = useLocale();
  const { user } = useSession();
  const toast = useToast();
  const mutation = useHandOverItemsMutation();
  const { confirm, dialog } = useConfirm("customer-handover-confirm");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const canHandOver = can(user, "order.markHandedOver");

  function requestHandOver(piece: CustomerKeptPiece) {
    confirm({
      title: "orders.detail.handover.confirmTitle",
      titleValues: { name: localize(piece.name, locale) },
      consequences: [t("confirmConsequence")],
      confirmLabel: "orders.detail.handover.confirmAction",
      tone: "primary",
      onConfirm: async () => {
        setPendingId(piece.orderItemId);
        try {
          await mutation.mutateAsync({ orderId: piece.orderId, itemIds: [piece.orderItemId] });
          toast.success("orders.detail.handover.done");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        } finally {
          setPendingId(null);
        }
      },
    });
  }

  if (customer.keptPieces.length === 0) {
    return null;
  }

  return (
    <DetailCard icon={Package} title={t("title", { count: customer.keptPieces.length })} data-testid="customer-kept">
      <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
        {customer.keptPieces.map((piece) => {
          const name = localize(piece.name, locale);
          return (
            <li
              key={piece.orderItemId}
              className="flex flex-wrap items-center gap-3 px-3 py-3"
              data-test-selector={testSelectorFor("customer-kept-piece", piece.orderItemId)}
            >
              <ProductImage
                src={piece.thumbnailUrl}
                alt={name}
                className="size-14 shrink-0 rounded-control"
                sizes={ORDER_THUMB_SIZES}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Typography variant="body" as="span" className="break-words">
                  {name}
                  {piece.quantity > 1 ? ` ×${piece.quantity}` : ""}
                </Typography>
                {piece.variantName && (
                  <Typography variant="small" tone="muted" as="span">
                    {localize(piece.variantName, locale)}
                  </Typography>
                )}
                <Link
                  href={`/orders/${piece.orderId}`}
                  className="self-start rounded-control text-meta text-primary-700 transition-colors hover:text-primary-900 focus-link"
                >
                  {t("fromOrder", { number: piece.orderNumber, date: formatDate(piece.soldAt, locale) })}
                </Link>
              </div>
              {canHandOver && (
                <Button
                  variant="secondary"
                  data-test-selector={testSelectorFor("customer-hand-over", piece.orderItemId)}
                  isLoading={pendingId === piece.orderItemId}
                  disabled={pendingId !== null}
                  onClick={() => requestHandOver(piece)}
                >
                  {t("action")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {dialog}
    </DetailCard>
  );
}

export function CustomerOrders({ customer }: { customer: CustomerDetail }) {
  const t = useTranslations("customers.detail.orders");
  const tCard = useTranslations("orders.card");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const columns: Column<CustomerOrderRow>[] = [
    {
      key: "number",
      header: "customers.detail.orders.number",
      primary: true,
      className: "min-w-[9rem]",
      render: (order) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Link
            href={`/orders/${order.id}`}
            className="whitespace-nowrap rounded-control text-value font-medium text-ink transition-colors hover:text-primary-700 focus-link"
          >
            {tCard("orderNumber", { number: String(order.orderNumber) })}
          </Link>
          <Typography variant="small" tone="muted" as="span" className="whitespace-nowrap tabular-nums">
            {formatDate(order.createdAt, locale)}
          </Typography>
        </div>
      ),
    },
    {
      key: "status",
      header: "customers.detail.orders.status",
      render: (order) => (
        <div className="flex flex-wrap gap-1.5">
          <OrderStatusBadge status={order.status} />
          {order.status !== "CANCELLED" && order.status !== "RETURNED" && (
            <PaymentStatusBadge status={order.paymentStatus} />
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: "customers.detail.orders.total",
      align: "numeric",
      render: (order) => (
        <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">
          {formatMoney(order.total)}
        </Typography>
      ),
    },
    {
      key: "balance",
      header: "customers.detail.orders.balance",
      align: "numeric",
      render: (order) => (
        <Typography
          variant="body"
          weight="medium"
          as="span"
          className={cn(
            "whitespace-nowrap tabular-nums",
            Number(order.balance) > 0 ? "text-danger-700" : "text-ink-muted",
          )}
        >
          {formatMoney(order.balance)}
        </Typography>
      ),
    },
  ];

  return (
    <DetailCard icon={ReceiptText} title={t("title")} data-testid="customer-orders">
      {customer.orders.length === 0 ? (
        <EmptyState data-testid="customer-orders-empty" icon="receipt" title="customers.detail.orders.emptyTitle" />
      ) : (
        <Table data-testid="customer-order" columns={columns} rows={customer.orders} rowKey={(order) => order.id} />
      )}
    </DetailCard>
  );
}

export function CustomerPayments({ customer }: { customer: CustomerDetail }) {
  const t = useTranslations("customers.detail.payments");
  const tCard = useTranslations("orders.card");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return (
    <DetailCard icon={History} title={t("title")} data-testid="customer-payments">
      {customer.payments.length === 0 ? (
        <Typography variant="small" tone="muted">
          {t("none")}
        </Typography>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
          {customer.payments.map((payment) => {
            const refund = Number(payment.amount) < 0;
            return (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
                data-test-selector={testSelectorFor("customer-payment", payment.id)}
              >
                <div className="flex min-w-0 flex-col">
                  <Typography variant="body" as="span">
                    {refund ? t("refund") : t("payment")}
                  </Typography>
                  <Typography variant="small" tone="muted" as="span">
                    {formatDateTime(payment.receivedAt, locale)}
                    {payment.receivedBy ? ` · ${payment.receivedBy.name}` : ""}
                  </Typography>
                  <Link
                    href={`/orders/${payment.orderId}`}
                    className="self-start rounded-control text-meta text-primary-700 transition-colors hover:text-primary-900 focus-link"
                  >
                    {tCard("orderNumber", { number: String(payment.orderNumber) })}
                  </Link>
                  {payment.note && (
                    <Typography variant="small" tone="muted" as="span" className="break-words">
                      {payment.note}
                    </Typography>
                  )}
                </div>
                <Typography
                  variant="body"
                  weight="medium"
                  as="span"
                  dir="ltr"
                  className={cn("shrink-0 tabular-nums", refund ? "text-danger-700" : "text-success-700")}
                >
                  {formatMoney(payment.amount)}
                </Typography>
              </li>
            );
          })}
        </ul>
      )}
    </DetailCard>
  );
}
