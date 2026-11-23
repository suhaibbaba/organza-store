"use client";

import { useTranslations } from "next-intl";
import { RadioGroup, Spinner, Typography } from "@store/ui";
import { EXCHANGE_SETTLEMENTS_CUSTOMER_PAYS, EXCHANGE_SETTLEMENTS_SHOP_PAYS } from "@store/shared/constants/order";
import type { ExchangeSettlement } from "@store/shared/types/order";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { differenceAmount } from "@/lib/order-exchange";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/customer";
import type { ExchangeSide } from "@/types/order";

interface ExchangeSettlementProps {
  // null until pieces are chosen and the server has priced them.
  credit: string | null;
  isCreditLoading: boolean;
  newTotal: string;
  differenceCents: number;
  side: ExchangeSide;
  settlement: ExchangeSettlement;
  onSettlementChange: (settlement: ExchangeSettlement) => void;
  canDebt: boolean;
  // The original sale's customer, who owes a DEBT unless another is picked.
  originalCustomerName: string | null;
  debtCustomer: Customer | null;
  onDebtCustomerChange: (customer: Customer | null) => void;
  showErrors: boolean;
}

// Returned value, new total, the difference and who pays it — then how it was settled.
export function ExchangeSettlementFields({
  credit,
  isCreditLoading,
  newTotal,
  differenceCents,
  side,
  settlement,
  onSettlementChange,
  canDebt,
  originalCustomerName,
  debtCustomer,
  onDebtCustomerChange,
  showErrors,
}: ExchangeSettlementProps) {
  const t = useTranslations("orders.exchange.settlement");
  const formatMoney = useMoneyFormatter();
  const amount = formatMoney(differenceAmount(differenceCents));

  const choices = (
    side === "customer" ? EXCHANGE_SETTLEMENTS_CUSTOMER_PAYS : side === "shop" ? EXCHANGE_SETTLEMENTS_SHOP_PAYS : []
  ).filter((choice) => choice !== "DEBT" || canDebt);

  const figures = [
    { key: "returned", value: credit === null ? null : formatMoney(credit) },
    { key: "newTotal", value: formatMoney(newTotal) },
  ];

  return (
    <div className="flex flex-col gap-4" data-test-selector="exchange-settlement">
      <dl className="flex flex-col gap-2">
        {figures.map((figure) => (
          <div key={figure.key} className="flex items-center justify-between gap-3">
            <Typography variant="small" tone="muted" as="dt">
              {t(figure.key)}
            </Typography>
            <Typography
              variant="small"
              as="dd"
              className="tabular-nums"
              data-test-selector={`exchange-figure-${figure.key}`}
            >
              {isCreditLoading && figure.key === "returned" ? <Spinner /> : (figure.value ?? "—")}
            </Typography>
          </div>
        ))}
      </dl>

      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-panel px-4 py-3",
          side === "shop" ? "bg-warning-50" : "bg-primary-50",
        )}
        data-test-selector="exchange-difference"
      >
        <Typography variant="small" weight="semibold" as="span">
          {t(`side.${side}`)}
        </Typography>
        <Typography variant="h2" weight="bold" as="span" className="tabular-nums">
          {amount}
        </Typography>
      </div>

      {credit !== null && choices.length > 0 && (
        <RadioGroup
          data-testid="exchange-settlement-choice"
          label={t("label")}
          value={settlement}
          onChange={onSettlementChange}
          options={choices.map((choice) => ({
            value: choice,
            label: t(`options.${choice}.label`),
            description: t(`options.${choice}.description`, { amount }),
          }))}
        />
      )}

      {credit !== null && side === "customer" && settlement === "DEBT" && (
        <div className="flex flex-col gap-1.5">
          <Typography variant="label" as="span">
            {t("debtCustomer")}
          </Typography>
          {originalCustomerName && !debtCustomer ? (
            <Typography variant="small" tone="muted" as="p" data-test-selector="exchange-debt-original-customer">
              {t("debtOriginalCustomer", { name: originalCustomerName })}
            </Typography>
          ) : (
            <>
              <CustomerPicker value={debtCustomer} onChange={onDebtCustomerChange} />
              {showErrors && !debtCustomer && (
                <Typography
                  variant="caption"
                  tone="error"
                  role="alert"
                  data-test-selector="field-error-exchange-debt-customer"
                >
                  {t("debtCustomerRequired")}
                </Typography>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
