"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { QUANTITY_MAX_LENGTH, clampQuantity } from "@store/shared/constants/quantity";
import { NumericInput } from "@/components/fields/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (quantity: number) => void;
  // Minus at the floor asks to take the line off the sale; without it the minus stops at the floor.
  onBelowMin?: () => void;
  // Names the line for screen readers ("more — Silk Scarf").
  itemLabel: string;
  // Rendered as `pos-quantity-stepper-<name>`.
  name?: string;
  // "compact" is the cart line's single outlined box; each button keeps a 44px touch area via `hit-area`.
  size?: "default" | "compact";
  className?: string;
}

// A typed quantity is a draft until blur (clearing to type "12" passes through ""), then clamped to the buttons' range.
export function QuantityStepper({
  value,
  max,
  onChange,
  onBelowMin,
  itemLabel,
  name,
  size = "default",
  className,
}: QuantityStepperProps) {
  const t = useTranslations("sell.cart");
  const [draft, setDraft] = useState<string | null>(null);

  const floor = clampQuantity(MIN_CART_QUANTITY);
  const ceiling = clampQuantity(max, floor);

  function step(next: number) {
    // Below the floor goes to the caller, which is where "remove this line?" lives.
    if (next < floor) {
      onBelowMin?.();
      return;
    }
    const clamped = clampQuantity(next, floor, ceiling);
    if (clamped !== value) onChange(clamped);
  }

  function commit(raw: string) {
    setDraft(null);
    if (!isNonNegativeIntegerString(raw)) return;
    step(Number(raw));
  }

  const compact = size === "compact";
  const buttonClass = compact
    ? "hit-area flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink transition-colors not-disabled:hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:bg-primary-200 focus-visible:text-primary-900"
    : "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control border border-line-strong bg-surface text-ink transition-colors not-disabled:hover:bg-inset disabled:cursor-not-allowed disabled:opacity-40 focus-visible:bg-neutral-200 focus-visible:text-ink";
  const iconClass = compact ? "size-4" : "size-5";

  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "rounded-control border border-line bg-surface" : "gap-1",
        className
      )}
      data-test-selector={testSelectorFor("pos-quantity-stepper", name)}
    >
      <button
        type="button"
        onClick={() => step(value - 1)}
        disabled={value <= floor && !onBelowMin}
        aria-label={t("decrease", { name: itemLabel })}
        data-test-selector={testSelectorFor("pos-quantity-decrease", name)}
        className={buttonClass}
      >
        <Minus className={iconClass} aria-hidden="true" />
      </button>

      <NumericInput
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        maxLength={QUANTITY_MAX_LENGTH}
        aria-label={t("quantity", { name: itemLabel })}
        data-test-selector={testSelectorFor("pos-quantity-value", name)}
        className={
          compact
            ? "h-10 w-9 rounded-none border-0 bg-transparent px-0 shadow-none [&_input]:text-center! [&_input]:font-semibold"
            : "h-11 w-14 px-0 [&_input]:text-center! [&_input]:font-semibold"
        }
      />

      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= ceiling}
        aria-label={t("increase", { name: itemLabel })}
        data-test-selector={testSelectorFor("pos-quantity-increase", name)}
        className={buttonClass}
      >
        <Plus className={iconClass} aria-hidden="true" />
      </button>
    </div>
  );
}
