"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DISCOUNT_TYPES } from "@shared/constants/order";
import type { DiscountType } from "@shared/types/order";
import { isDiscountValueInRange, maxDiscountValue } from "@/lib/money";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { DiscountState } from "@/types/cart";

interface DiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // What the discount applies to — the line's own name, or the whole sale.
  title: string;
  // The amount being discounted, so the cashier can see what a percentage
  // is a percentage of — and so a flat sum can be held to it.
  baseAmount: string;
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

// A discount at either level: percentage or fixed amount (spec.md
// "Discounts"). Only the (type, value) pair is captured — the money itself
// is worked out by the server, so nothing here can be talked into a total
// the backend disagrees with.
export function DiscountSheet({ open, onOpenChange, title, baseAmount, current, onApply }: DiscountSheetProps) {
  const t = useTranslations("sell.discount");
  const tCommon = useTranslations("common");
  const formatMoney = useMoneyFormatter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Two options and one number: a small modal on a laptop, and the
          same full-width bottom sheet as ever on a phone. */}
      <SheetContent compact closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("subtitle", { name: title, amount: formatMoney(baseAmount) })}</SheetDescription>
        </SheetHeader>

        {/* The form lives in its own component so its fields are created
            fresh each time the sheet opens: reopening must show what is
            currently applied, not what was last typed and abandoned. */}
        <DiscountForm
          baseAmount={baseAmount}
          current={current}
          onApply={(type, value) => {
            onApply(type, value);
            onOpenChange(false);
          }}
        />
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
  const t = useTranslations("sell.discount");
  const currency = useCurrencySymbol();
  const formatMoney = useMoneyFormatter();
  const [type, setType] = useState<DiscountType>(current.type ?? "PERCENT");
  const [value, setValue] = useState(current.value ?? "");

  const trimmed = value.trim();
  // Whole numbers only, on both sides of the toggle (CLAUDE.md "Mobile input
  // & device specifics"): a discount is keyed in at a counter on a phone
  // keypad, and a stray "." there is a mis-key, not an intention.
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
        {/* Two words wide, not half the screen each — and each the width of
            its own label, so "مبلغ ثابت (₪)" stays on one line instead of
            breaking in half against the shorter option beside it. */}
        <SegmentedControl
          size="lg"
          label={t("typeLabel")}
          value={type}
          onChange={setType}
          options={DISCOUNT_TYPES.map((option) => ({
            value: option,
            // The fixed-amount option names the shop's currency, from
            // Settings — "Amount" alone left the two options telling the
            // cashier nothing about which one deals in money.
            label: option === "AMOUNT" && currency ? t("type.AMOUNT_currency", { currency }) : t(`type.${option}`),
          }))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pos-discount-value">
          {type === "AMOUNT" && currency ? t("valueLabel.AMOUNT_currency", { currency }) : t(`valueLabel.${type}`)}
        </Label>
        <NumericInput
          id="pos-discount-value"
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
          // the Apply button the cashier came here to press. The keyboard
          // belongs to whoever taps the field.
          className="text-lg sm:max-w-40"
        />
        {showRangeError && (
          <Alert variant="destructive">
            {type === "PERCENT" ? t("invalid.PERCENT", { max }) : t("invalid.AMOUNT", { max: formatMoney(baseAmount) })}
          </Alert>
        )}
      </div>

      {/* Side by side and only as wide as they need to be on a laptop; still
          stacked and full width under a thumb. Apply stays the primary
          button; Remove is destructive, because undoing a discount in front
          of a customer who was promised one is not a neutral act — and it is
          absent entirely when there is nothing to remove. */}
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
        {/* Written after Remove so the row reads Remove → Apply on a wide
            screen, putting the primary action at the end of the row in both
            directions; `flex-col-reverse` puts it back on top when the two
            stack under a thumb. */}
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
