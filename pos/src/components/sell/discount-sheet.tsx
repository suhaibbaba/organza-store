"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, SegmentedControl } from "@store/ui";
import { DISCOUNT_TYPES } from "@organza/shared/constants/order";
import type { DiscountType } from "@organza/shared/types/order";
import { isDiscountValueInRange, maxDiscountValue } from "@/lib/money";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { NumericInput } from "@/components/fields/numeric-input";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { SHEET_ACTION, SHEET_SEGMENTED } from "@/components/sell/sheet-styles";
import type { DiscountState } from "@/types/cart";

interface DiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The line's own name, or the whole sale.
  title: string;
  // What a percentage is a percentage of, and what a flat sum is held to.
  baseAmount: string;
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

// Only the (type, value) pair is captured; the server works out the money (spec.md "Discounts").
export function DiscountSheet({ open, onOpenChange, title, baseAmount, current, onApply }: DiscountSheetProps) {
  const t = useTranslations("sell.discount");
  const formatMoney = useMoneyFormatter();

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="discount"
      compact
      title={t("title")}
      description={t("subtitle", { name: title, amount: formatMoney(baseAmount) })}
    >
      {/* Its own component so reopening shows what is applied, not what was last typed and abandoned. */}
      <DiscountForm
        baseAmount={baseAmount}
        current={current}
        onApply={(type, value) => {
          onApply(type, value);
          onOpenChange(false);
        }}
      />
    </BottomSheet>
  );
}

interface DiscountFormProps {
  baseAmount: string;
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

function DiscountForm({ baseAmount, current, onApply }: DiscountFormProps) {
  const t = useTranslations("sell.discount");
  const currency = useCurrencySymbol();
  const formatMoney = useMoneyFormatter();
  const [type, setType] = useState<DiscountType>(current.type ?? "PERCENT");
  const [value, setValue] = useState(current.value ?? "");

  const trimmed = value.trim();
  // Whole numbers only on both sides: a stray "." on a counter keypad is a mis-key.
  const isValid =
    trimmed !== "" && isNonNegativeIntegerString(trimmed) && isDiscountValueInRange(type, trimmed, baseAmount);
  const showRangeError = trimmed !== "" && !isValid;
  const max = maxDiscountValue(type, baseAmount);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
      <div className="flex flex-col gap-2">
        <p className="text-label font-medium text-ink">{t("typeLabel")}</p>
        <SegmentedControl
          data-testid="pos-segmented"
          label={t("typeLabel")}
          value={type}
          onChange={setType}
          className={SHEET_SEGMENTED}
          options={DISCOUNT_TYPES.map((option) => ({
            value: option,
            label: option === "AMOUNT" && currency ? t("type.AMOUNT_currency", { currency }) : t(`type.${option}`),
          }))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pos-discount-value" className="text-label text-ink">
          {type === "AMOUNT" && currency ? t("valueLabel.AMOUNT_currency", { currency }) : t(`valueLabel.${type}`)}
        </label>
        {/* No autoFocus: the phone keyboard would cover the type buttons and Apply. */}
        <NumericInput
          id="pos-discount-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={String(Math.max(max, 1)).length}
          placeholder={t(`valuePlaceholder.${type}`)}
          aria-invalid={showRangeError}
          enterKeyHint="done"
          className="h-12 text-lg sm:max-w-40"
        />
        {showRangeError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {type === "PERCENT" ? t("invalid.PERCENT", { max }) : t("invalid.AMOUNT", { max: formatMoney(baseAmount) })}
          </Alert>
        )}
      </div>

      {/* Remove is danger (undoing a promised discount is not neutral); Apply ends the row in both directions. */}
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {current.type && (
          <Button
            type="button"
            variant="danger"
            onClick={() => onApply(null, null)}
            data-testid="pos-discount-remove"
            className={`${SHEET_ACTION} w-full sm:w-auto`}
          >
            {t("remove")}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => isValid && onApply(type, trimmed)}
          data-testid="pos-discount-apply"
          disabled={!isValid}
          className={`${SHEET_ACTION} w-full sm:w-auto`}
        >
          {t("apply")}
        </Button>
      </div>
    </div>
  );
}
