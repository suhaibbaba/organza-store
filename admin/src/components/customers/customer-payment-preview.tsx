"use client";

import { useTranslations } from "next-intl";
import { Skeleton, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { useCustomerPaymentPreviewQuery } from "@/hooks/use-customers";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { CUSTOMER_PAYMENT_PREVIEW_DEBOUNCE_MS } from "@/constants/customers";

// The backend decides the split (oldest order first); this only shows it before the payment is saved.
export function CustomerPaymentPreview({ customerId, amount }: { customerId: string; amount: string }) {
  const t = useTranslations("customers.payment.preview");
  const tCard = useTranslations("orders.card");
  const formatMoney = useMoneyFormatter();
  const settled = useDebouncedValue(amount, CUSTOMER_PAYMENT_PREVIEW_DEBOUNCE_MS);
  const preview = useCustomerPaymentPreviewQuery(customerId, settled || null);

  return (
    <div
      className="flex flex-col gap-2 rounded-panel border border-line p-3"
      data-test-selector="customer-payment-preview"
    >
      <Typography variant="label" as="span">
        {t("title")}
      </Typography>
      {preview.isFetching || !preview.data ? (
        <Skeleton className="h-12 rounded-control" />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {preview.data.allocations.map((allocation) => (
            <li
              key={allocation.orderId}
              className="flex items-center justify-between gap-3"
              data-test-selector={testSelectorFor("customer-payment-allocation", allocation.orderId)}
            >
              <Typography variant="body" as="span">
                {tCard("orderNumber", { number: String(allocation.orderNumber) })}
                <Typography variant="small" tone="muted" as="span" className="ms-2">
                  {Number(allocation.balanceAfter) > 0
                    ? t("leftOn", { amount: formatMoney(allocation.balanceAfter) })
                    : t("paidOff")}
                </Typography>
              </Typography>
              <Typography variant="body" weight="medium" as="span" className="shrink-0 tabular-nums">
                {formatMoney(allocation.amount)}
              </Typography>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
