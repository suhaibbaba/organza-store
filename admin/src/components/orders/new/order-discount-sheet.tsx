"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Drawer, FormField, SegmentedControl, Typography } from "@store/ui";
import { DISCOUNT_TYPES } from "@store/shared/constants/order";
import type { DiscountType } from "@store/shared/types/order";
import { isDiscountValueInRange, maxDiscountValue } from "@/lib/money";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { NumericInput } from "@/components/fields/numeric-input";
import type { DiscountState } from "@/types/order";

interface OrderDiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // What the discount applies to: the line's own name, or the whole order.
  title: string;
  // The amount being discounted, so a percentage has a base and a flat sum can be held to it.
  baseAmount: string;
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

// Only the (type, value) pair is captured; the server works out the money (spec.md "Discounts").
export function OrderDiscountSheet({
  open,
  onOpenChange,
  title,
  baseAmount,
  current,
  onApply,
}: OrderDiscountSheetProps) {
  const t = useTranslations("orders.discount");
  const formatMoney = useMoneyFormatter();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      descriptionKey="orders.discount.title"
      data-testid="sheet-order-discount"
    >
      <div className="flex flex-col gap-4">
        <Typography variant="small" tone="muted">
          {t("subtitle", { name: title, amount: formatMoney(baseAmount) })}
        </Typography>

        {/* Mounted only while open, so reopening shows what is applied, not an abandoned edit. */}
        {open && (
          <DiscountForm
            baseAmount={baseAmount}
            current={current}
            onApply={(type, value) => {
              onApply(type, value);
              onOpenChange(false);
            }}
          />
        )}
      </div>
    </Drawer>
  );
}

interface DiscountFormProps {
  baseAmount: string;
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

function DiscountForm({ baseAmount, current, onApply }: DiscountFormProps) {
  const t = useTranslations("orders.discount");
  const currency = useCurrencySymbol();
  const formatMoney = useMoneyFormatter();
  const [type, setType] = useState<DiscountType>(current.type ?? "PERCENT");
  const [value, setValue] = useState(current.value ?? "");

  const trimmed = value.trim();
  // Whole numbers only on both sides: a stray "." on a phone keypad is a mis-key.
  const isValid =
    trimmed !== "" && isNonNegativeIntegerString(trimmed) && isDiscountValueInRange(type, trimmed, baseAmount);
  const showRangeError = trimmed !== "" && !isValid;
  const max = maxDiscountValue(type, baseAmount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Typography variant="small" weight="medium" as="span">{t("typeLabel")}</Typography>
        <SegmentedControl
          data-testid="segmented"
          label={t("typeLabel")}
          value={type}
          onChange={setType}
          options={DISCOUNT_TYPES.map((option) => ({
            value: option,
            // The fixed-amount option names the shop's currency, from Settings.
            label: option === "AMOUNT" && currency ? t("type.AMOUNT_currency", { currency }) : t(`type.${option}`),
          }))}
        />
      </div>

      <FormField
        label={`orders.discount.valueLabel.${type === "AMOUNT" && currency ? "AMOUNT_currency" : type}`}
        labelValues={{ currency }}
        htmlFor="order-discount-value"
      >
        <NumericInput
          id="order-discount-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // A whole percentage is at most three digits; a flat sum at most as long as the amount it comes off.
          maxLength={String(Math.max(max, 1)).length}
          placeholder={t(`valuePlaceholder.${type}`)}
          aria-invalid={showRangeError}
          enterKeyHint="done"
          // No autoFocus: the phone keyboard would cover the type buttons and Apply.
          className="text-heading"
        />
        {showRangeError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {type === "PERCENT" ? t("invalid.PERCENT", { max }) : t("invalid.AMOUNT", { max: formatMoney(baseAmount) })}
          </Alert>
        )}
      </FormField>
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {current.type && (
          <Button
            type="button"
            variant="danger"
            onClick={() => onApply(null, null)}
            className="w-full sm:w-auto"
          >
            {t("remove")}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => isValid && onApply(type, trimmed)}
          disabled={!isValid}
          className="w-full sm:w-auto"
        >
          {t("apply")}
        </Button>
      </div>
    </div>
  );
}
