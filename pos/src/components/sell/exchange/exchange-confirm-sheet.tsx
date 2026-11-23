"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { Alert, Button, RadioGroup, Typography } from "@store/ui";
import type { ExchangeSettlement } from "@store/shared/types/order";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { CustomerPicker, type PickedCustomer } from "@/components/sell/customer-picker";
import { EXCHANGE_DEFAULT_SETTLEMENT } from "@/constants/exchange";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { exchangeDifferenceCents, exchangeSide, settlementsFor } from "@/lib/exchange";
import { fromCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ExchangeDraft } from "@/types/exchange";

interface ExchangeConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ExchangeDraft;
  credit: string;
  cartTotal: string;
  // order.sellOnCredit: without it the difference cannot be left owing.
  canCredit: boolean;
  isSubmitting: boolean;
  errorCode: string | null;
  onConfirm: (settlement: ExchangeSettlement, customerId: string | undefined) => void;
}

// The last step: how much changes hands, which way, and how it was settled.
export function ExchangeConfirmSheet(props: ExchangeConfirmSheetProps) {
  // Mounted only while open, so every exchange starts on the default settlement.
  return props.open ? <ExchangeConfirmForm {...props} /> : null;
}

function ExchangeConfirmForm({
  open,
  onOpenChange,
  draft,
  credit,
  cartTotal,
  canCredit,
  isSubmitting,
  errorCode,
  onConfirm,
}: ExchangeConfirmSheetProps) {
  const t = useTranslations("sell.exchange");
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();

  const differenceCents = exchangeDifferenceCents(cartTotal, credit);
  const side = exchangeSide(differenceCents);
  const options = settlementsFor(side, canCredit);
  const amount = formatMoney(fromCents(Math.abs(differenceCents)));
  const [settlement, setSettlement] = useState<ExchangeSettlement>(EXCHANGE_DEFAULT_SETTLEMENT[side]);
  const original = draft.order;
  // The debt lands on the original sale's customer unless another is picked.
  const [customer, setCustomer] = useState<PickedCustomer | null>(
    original.customerId && original.customerName && original.customerPhone
      ? { id: original.customerId, name: original.customerName, phone: original.customerPhone }
      : null,
  );
  const [submitted, setSubmitted] = useState(false);
  const isDebt = settlement === "DEBT";

  function confirm() {
    setSubmitted(true);
    if (isDebt && !customer) {
      return;
    }
    onConfirm(settlement, isDebt ? customer?.id : undefined);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="exchange-confirm"
      className="mx-auto max-h-[92dvh] max-w-3xl tab:border-x"
      headerClassName="pb-0"
      title={
        <span className="flex items-center gap-2">
          <Repeat className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
          {t("confirmTitle", { number: original.orderNumber })}
        </span>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4 [&>*]:shrink-0">
        <dl className="flex flex-col gap-2 rounded-panel border border-line p-4">
          <div className="flex items-center justify-between">
            <Typography as="dt" variant="small" tone="muted">
              {t("newTotal")}
            </Typography>
            <Typography as="dd" variant="small" weight="semibold" className="tabular-nums">
              {formatMoney(cartTotal)}
            </Typography>
          </div>
          <div className="flex items-center justify-between">
            <Typography as="dt" variant="small" tone="muted">
              {t("returnedValue")}
            </Typography>
            <Typography as="dd" variant="small" weight="semibold" tone="success" className="tabular-nums">
              {formatMoney(credit)}
            </Typography>
          </div>
          <div
            className={cn(
              "mt-1 flex items-center justify-between gap-3 rounded-control px-3.5 py-2.5",
              side === "shop" ? "bg-warning-50" : "bg-primary-50",
            )}
          >
            <Typography as="dt" variant="body" weight="bold">
              {t(`side.${side}`)}
            </Typography>
            <Typography
              as="dd"
              variant="h2"
              weight="bold"
              className="tabular-nums"
              data-test-selector="pos-exchange-confirm-difference"
            >
              {amount}
            </Typography>
          </div>
        </dl>

        {side === "even" ? (
          <Typography variant="small" tone="muted">
            {t("evenHint")}
          </Typography>
        ) : (
          <RadioGroup<ExchangeSettlement>
            label={t("settlementLabel")}
            value={settlement}
            onChange={setSettlement}
            options={options.map((option) => ({
              value: option,
              label: t(`settlement.${option}.label`, { amount }),
              description: t(`settlement.${option}.hint`, { amount }),
            }))}
            data-testid="pos-exchange-settlement"
          />
        )}

        {isDebt && <CustomerPicker value={customer} onChange={setCustomer} showRequired={submitted} name="exchange" />}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line px-5 pt-4">
        {errorCode && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(errorCode)}
          </Alert>
        )}
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            data-testid="pos-exchange-confirm-cancel"
            disabled={isSubmitting}
            className="min-w-28 flex-1"
          >
            {t("back")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            data-testid="pos-exchange-confirm"
            isLoading={isSubmitting}
            icon={<Repeat aria-hidden="true" />}
            className="min-w-0 flex-1"
          >
            {isSubmitting ? t("saving") : t("confirm")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
