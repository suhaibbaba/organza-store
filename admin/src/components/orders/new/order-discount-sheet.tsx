"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DISCOUNT_TYPES } from "@organza/shared/constants/order";
import type { DiscountType } from "@organza/shared/types/order";
import { isDiscountValueInRange, maxDiscountValue } from "@/lib/money";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { DiscountState } from "@/types/order";

interface OrderDiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // What the discount applies to — the line's own name, or the whole order.
  title: string;
  // The amount being discounted, so it's visible what a percentage is a
  // percentage of — and so a flat sum can be held to it.
  baseAmount: string;
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

// A discount at either level: percentage or fixed amount (spec.md
// "Discounts"). Only the (type, value) pair is captured — the money itself is
// worked out by the server, so nothing here can be talked into a total the
// backend disagrees with.
export function OrderDiscountSheet({
  open,
  onOpenChange,
  title,
  baseAmount,
  current,
  onApply,
}: OrderDiscountSheetProps) {
  const t = useTranslations("orders.discount");
  const tCommon = useTranslations("common");
  const formatMoney = useMoneyFormatter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { name: title, amount: formatMoney(baseAmount) })}
          </p>
        </SheetHeader>

        {/* The form lives in its own component so its fields are created
            fresh each time the sheet opens: reopening must show what is
            currently applied, not what was last typed and abandoned. */}
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
      </SheetContent>
    </Sheet>
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
  // Whole numbers only, on both sides of the toggle (CLAUDE.md "Mobile input
  // & device specifics"): this is keyed in on a phone keypad, where a stray
  // "." is a mis-key rather than an intention.
  const isValid =
    trimmed !== "" && isNonNegativeIntegerString(trimmed) && isDiscountValueInRange(type, trimmed, baseAmount);
  // Only complain about something actually typed — an empty field is where
  // everyone starts, not a mistake.
  const showRangeError = trimmed !== "" && !isValid;
  const max = maxDiscountValue(type, baseAmount);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
      <div className="flex flex-col gap-2">
        <Label>{t("typeLabel")}</Label>
        {/* Two segments the width of what they say, not two halves of the
            sheet: "مبلغ ثابت (₪)" is a good deal longer than "نسبة مئوية"
            and an equal-width grid broke it over two lines. */}
        <SegmentedControl
          size="lg"
          label={t("typeLabel")}
          value={type}
          onChange={setType}
          options={DISCOUNT_TYPES.map((option) => ({
            value: option,
            // The fixed-amount option names the shop's currency, from
            // Settings — "Fixed amount" alone left the two options saying
            // nothing about which one deals in money.
            label: option === "AMOUNT" && currency ? t("type.AMOUNT_currency", { currency }) : t(`type.${option}`),
          }))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="order-discount-value">
          {type === "AMOUNT" && currency ? t("valueLabel.AMOUNT_currency", { currency }) : t(`valueLabel.${type}`)}
        </Label>
        <NumericInput
          id="order-discount-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // A whole percentage can only ever be three digits, and a flat sum
          // can only ever be as long as the amount it comes off.
          maxLength={String(Math.max(max, 1)).length}
          placeholder={t(`valuePlaceholder.${type}`)}
          aria-invalid={showRangeError}
          enterKeyHint="done"
          // No autoFocus: opening this sheet used to throw the phone
          // keyboard up over the sheet itself, hiding the type buttons and
          // the Apply button. The keyboard belongs to whoever taps the field.
          className="text-lg"
        />
        {showRangeError && (
          <Alert variant="destructive">
            {type === "PERCENT" ? t("invalid.PERCENT", { max }) : t("invalid.AMOUNT", { max: formatMoney(baseAmount) })}
          </Alert>
        )}
      </div>

      {/* Apply stays the primary button; Remove is destructive, because
          undoing a discount somebody was promised is not a neutral act — and
          it is absent entirely when there is nothing to remove. Written after
          Remove so the row reads Remove → Apply once there is width for a
          row, putting the primary action at the end of it in both reading
          directions. */}
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {current.type && (
          <Button
            type="button"
            variant="destructive"
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
