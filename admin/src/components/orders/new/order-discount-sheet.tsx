"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DISCOUNT_TYPES } from "@shared/constants/order";
import type { DiscountType } from "@shared/types/order";
import { isDiscountValueInRange } from "@/lib/money";
import { isNonNegativeDecimalString } from "@/lib/validation/numeric";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DiscountState } from "@/types/order";

interface OrderDiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // What the discount applies to — the line's own name, or the whole order.
  title: string;
  // The amount being discounted, so it's visible what a percentage is a
  // percentage of.
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
  current: DiscountState;
  onApply: (type: DiscountType | null, value: string | null) => void;
}

function DiscountForm({ current, onApply }: DiscountFormProps) {
  const t = useTranslations("orders.discount");
  const [type, setType] = useState<DiscountType>(current.type ?? "PERCENT");
  const [value, setValue] = useState(current.value ?? "");

  const trimmed = value.trim();
  const isValid = trimmed !== "" && isNonNegativeDecimalString(trimmed) && isDiscountValueInRange(type, trimmed);
  // Only complain about something actually typed — an empty field is where
  // everyone starts, not a mistake.
  const showRangeError = trimmed !== "" && !isValid;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
      <div className="flex flex-col gap-2">
        <Label>{t("typeLabel")}</Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("typeLabel")}>
          {DISCOUNT_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={type === option}
              className={cn(
                "h-12 rounded-lg border text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                type === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-accent"
              )}
            >
              {t(`type.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="order-discount-value">{t(`valueLabel.${type}`)}</Label>
        <NumericInput
          id="order-discount-value"
          allowDecimal
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t(`valuePlaceholder.${type}`)}
          aria-invalid={showRangeError}
          enterKeyHint="done"
          // No autoFocus: opening this sheet used to throw the phone
          // keyboard up over the sheet itself, hiding the type buttons and
          // the Apply button. The keyboard belongs to whoever taps the field.
          className="text-lg"
        />
        {showRangeError && <Alert variant="destructive">{t("invalid")}</Alert>}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" onClick={() => isValid && onApply(type, trimmed)} disabled={!isValid}>
          {t("apply")}
        </Button>
        {current.type && (
          <Button type="button" variant="ghost" onClick={() => onApply(null, null)} className="text-destructive">
            {t("remove")}
          </Button>
        )}
      </div>
    </div>
  );
}
