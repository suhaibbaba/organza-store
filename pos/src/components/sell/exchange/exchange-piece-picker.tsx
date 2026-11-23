"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, QuantityStepper, Spinner, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { Order, OrderItem } from "@store/shared/types/order";
import { ProductThumb } from "@/components/sell/product-thumb";
import { SELL_CART_THUMB_SIZES } from "@/constants/images";
import { useExchangePreview, useOrderDetail } from "@/hooks/use-exchange-order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { isExchangeable, returnableQuantity, returnedPieceCount, unitPaid } from "@/lib/exchange";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { ExchangeDraft, ExchangeReturnLine } from "@/types/exchange";

interface ExchangePiecePickerProps {
  orderId: string;
  initialReturns: readonly ExchangeReturnLine[];
  onBack: () => void;
  onConfirm: (draft: ExchangeDraft) => void;
}

function toReturnLine(item: OrderItem, quantity: number): ExchangeReturnLine {
  return {
    orderItemId: item.id,
    quantity,
    name: item.name,
    variantName: item.variantName,
    thumbnailUrl: item.thumbnailUrl,
  };
}

// Step two: how many of each piece the customer brought back, and what they carry over as the backend counts it.
export function ExchangePiecePicker({ orderId, initialReturns, onBack, onConfirm }: ExchangePiecePickerProps) {
  const t = useTranslations("sell.exchange");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();
  const detail = useOrderDetail(orderId);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialReturns.map((line) => [line.orderItemId, line.quantity])),
  );

  const order: Order | undefined = detail.data;
  const returns = order
    ? order.items
        .filter((item) => (quantities[item.id] ?? 0) > 0)
        .map((item) => toReturnLine(item, Math.min(quantities[item.id], returnableQuantity(item))))
    : [];
  const preview = useExchangePreview(order ? order.id : null, returns);
  const previewError = preview.error
    ? preview.error instanceof ApiError
      ? preview.error.code
      : ERROR_CODES.INTERNAL
    : null;
  const count = returnedPieceCount(returns);
  const canContinue =
    order !== undefined && count > 0 && preview.credit !== null && !preview.isFetching && !previewError;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 [&>*]:shrink-0">
        <Button
          type="button"
          variant="quiet"
          onClick={onBack}
          icon={<ArrowLeft className="rtl:rotate-180" aria-hidden="true" />}
          data-testid="pos-exchange-back"
          className="self-start px-0"
        >
          {t("otherSale")}
        </Button>

        {detail.isPending ? (
          <Spinner />
        ) : detail.isError || !order ? (
          <Alert tone="danger">
            {translateError(detail.error instanceof ApiError ? detail.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <Typography variant="body" weight="semibold" className="tabular-nums">
                {t("orderNumber", { number: order.orderNumber })}
              </Typography>
              <Typography variant="small" tone="muted">
                {order.customerName
                  ? t("whenWho", { when: formatDateTime(order.createdAt, locale), name: order.customerName })
                  : formatDateTime(order.createdAt, locale)}
              </Typography>
            </div>

            {!isExchangeable(order) && (
              <Alert tone="warning">{translateError(ERROR_CODES.ORDER_NOT_EXCHANGEABLE)}</Alert>
            )}

            <Typography as="h3" variant="small" weight="medium">
              {t("piecesTitle")}
            </Typography>
            <ul
              className="flex flex-col divide-y divide-line rounded-panel border border-line"
              data-test-selector="pos-exchange-pieces"
            >
              {order.items.map((item) => {
                const left = returnableQuantity(item);
                const name = localize(item.name, locale);
                const variantName = item.variantName ? localize(item.variantName, locale) : null;
                const fullName = variantName ? `${name} — ${variantName}` : name;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-3"
                    data-test-selector={testSelectorFor("pos-exchange-piece", item.id)}
                  >
                    <ProductThumb
                      src={item.thumbnailUrl}
                      alt={name}
                      sizes={SELL_CART_THUMB_SIZES}
                      className="size-14 rounded-photo"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Typography variant="small" weight="semibold" className="break-words">
                        {name}
                      </Typography>
                      {variantName && (
                        <Typography variant="caption" tone="muted">
                          {variantName}
                        </Typography>
                      )}
                      <Typography variant="caption" tone="muted" className="tabular-nums">
                        {left > 0
                          ? t("paidEach", { amount: formatMoney(unitPaid(order, item)), count: left })
                          : t("alreadyBack")}
                      </Typography>
                    </div>
                    {left > 0 && (
                      <QuantityStepper
                        name={item.id}
                        testName="pos-exchange-quantity"
                        size="lg"
                        value={Math.min(quantities[item.id] ?? 0, left)}
                        min={0}
                        max={left}
                        onChange={(quantity) => setQuantities((current) => ({ ...current, [item.id]: quantity }))}
                        decreaseLabel={t("decrease", { name: fullName })}
                        increaseLabel={t("increase", { name: fullName })}
                        valueLabel={t("quantity", { name: fullName })}
                        className="w-36 shrink-0"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line px-5 pb-5 pt-4">
        {previewError && <Alert tone="danger">{translateError(previewError)}</Alert>}
        <div className="flex items-center justify-between gap-3 rounded-control bg-primary-50 px-3.5 py-2.5">
          <Typography as="span" variant="body" weight="bold" tone="brand">
            {t("creditLabel", { count })}
          </Typography>
          <Typography
            as="span"
            variant="h2"
            weight="bold"
            className="tabular-nums"
            data-test-selector="pos-exchange-credit"
          >
            {preview.credit !== null ? formatMoney(preview.credit) : formatMoney(0)}
          </Typography>
        </div>
        <Button
          type="button"
          onClick={() => order && onConfirm({ order, returns })}
          disabled={!canContinue}
          isLoading={preview.isFetching}
          data-testid="pos-exchange-continue"
          className="w-full"
        >
          {t("continue")}
        </Button>
      </div>
    </>
  );
}
