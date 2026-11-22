"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Button, Typography } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { Order } from "@store/shared/types/order";
import { useSession } from "@/components/providers/session-provider";
import { RecordPaymentModal } from "@/components/customers/record-payment-modal";
import { useRecordOrderPaymentMutation } from "@/hooks/use-customers";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// A credit sale: total, paid, still owed, every payment (refunds negative), and taking another one.
export function OrderCreditPayments({ order }: { order: Order }) {
  const t = useTranslations("orders.detail.credit");
  const locale = useLocale();
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();
  const mutation = useRecordOrderPaymentMutation(order.id);
  const [paying, setPaying] = useState(false);

  const owing = Number(order.balance) > 0;
  const canPay = owing && can(user, "order.recordPayment") && order.status !== "CANCELLED";

  const figures = [
    { key: "total", value: order.total },
    { key: "paid", value: order.paidAmount },
    { key: "balance", value: order.balance },
  ] as const;

  return (
    <div className="flex flex-col gap-3" data-test-selector="order-credit">
      <dl className="grid grid-cols-3 gap-2 rounded-panel bg-sunken px-3 py-3 text-center">
        {figures.map((figure) => (
          <div key={figure.key} className="flex min-w-0 flex-col gap-0.5">
            <Typography as="dt" variant="small" tone="muted">
              {t(figure.key)}
            </Typography>
            <Typography
              as="dd"
              variant="body"
              weight="medium"
              className={cn("break-words tabular-nums", figure.key === "balance" && owing && "text-danger-700")}
              data-test-selector={testSelectorFor("order-credit", figure.key)}
            >
              {formatMoney(figure.value)}
            </Typography>
          </div>
        ))}
      </dl>

      {order.customerId && (
        <Link
          href={`/customers/${order.customerId}`}
          className="self-start rounded-control text-value text-primary-700 transition-colors hover:text-primary-900 focus-link"
          data-test-selector="order-credit-customer"
        >
          {t("customerAccount", { name: order.customerName ?? "" })}
        </Link>
      )}

      {order.payments.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
          {order.payments.map((payment) => {
            const refund = Number(payment.amount) < 0;
            return (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
                data-test-selector={testSelectorFor("order-payment", payment.id)}
              >
                <div className="flex min-w-0 flex-col">
                  <Typography variant="body" as="span">
                    {refund ? t("refund") : t("payment")}
                  </Typography>
                  <Typography variant="small" tone="muted" as="span">
                    {formatDateTime(payment.receivedAt, locale)}
                    {payment.receivedBy ? ` · ${payment.receivedBy.name}` : ""}
                  </Typography>
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
      ) : (
        <Typography variant="small" tone="muted">
          {t("noPayments")}
        </Typography>
      )}

      {canPay && (
        <Button
          className="w-full"
          data-test-selector="order-record-payment"
          icon={<Wallet className="size-4" aria-hidden="true" />}
          onClick={() => setPaying(true)}
        >
          {t("recordPayment")}
        </Button>
      )}
      {!owing && order.status !== "CANCELLED" && (
        <Typography variant="small" tone="success">
          {t("paidOff")}
        </Typography>
      )}

      <RecordPaymentModal
        open={paying}
        onClose={() => setPaying(false)}
        balance={order.balance}
        title="orders.detail.credit.modalTitle"
        titleValues={{ number: order.orderNumber }}
        description="orders.detail.credit.modalDescription"
        onSave={(input) => mutation.mutateAsync(input)}
      />
    </div>
  );
}
