"use client";

import { useLocale, useTranslations } from "next-intl";
import { Skeleton, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { useSupplierPaymentPreviewQuery } from "@/hooks/use-suppliers";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatDate } from "@/lib/format";
import { SUPPLIER_PAYMENT_PREVIEW_DEBOUNCE_MS } from "@/constants/suppliers";

interface SupplierPaymentPreviewProps {
  supplierId: string;
  amount: string;
  invoiceId: string | null;
}

// The backend decides the split (oldest invoice first); this only shows it before the payment is saved.
export function SupplierPaymentPreview({ supplierId, amount, invoiceId }: SupplierPaymentPreviewProps) {
  const t = useTranslations("suppliers.payment.preview");
  const tInvoices = useTranslations("suppliers.detail.invoices");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const settled = useDebouncedValue(amount, SUPPLIER_PAYMENT_PREVIEW_DEBOUNCE_MS);
  const preview = useSupplierPaymentPreviewQuery(supplierId, settled || null, invoiceId);

  return (
    <div
      className="flex flex-col gap-2 rounded-panel border border-line p-3"
      data-test-selector="supplier-payment-preview"
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
              key={allocation.invoiceId}
              className="flex items-center justify-between gap-3"
              data-test-selector={testSelectorFor("supplier-payment-allocation", allocation.invoiceId)}
            >
              <Typography variant="body" as="span">
                <bdi dir="ltr" className="tabular-nums">
                  {allocation.invoiceNumber ? `#${allocation.invoiceNumber}` : tInvoices("noNumber")}
                </bdi>
                <Typography variant="small" tone="muted" as="span" className="ms-2">
                  <bdi className="tabular-nums">{formatDate(allocation.invoiceDate, locale)}</bdi>
                  {" · "}
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
