"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { QUANTITY_MAX, QUANTITY_MAX_LENGTH, QUANTITY_MIN, clampQuantity } from "@organza/shared/constants/quantity";
import { NumericInput } from "@/components/fields/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  // A screen may narrow the shared 0–999 range, never widen it.
  min?: number;
  max?: number;
  onChange: (quantity: number) => void;
  // Accessible names should name the line, so a screen reader doesn't hear several identical "more" buttons.
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  // Names the stepper `quantity-stepper-<name>`.
  name?: string;
  className?: string;
}

// Typed values clamp on blur to the same bounds the buttons stop at; the draft exists only while editing so "" doesn't snap to the minimum.
export function QuantityStepper({
  value,
  min = QUANTITY_MIN,
  max = QUANTITY_MAX,
  onChange,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  name,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const floor = clampQuantity(min);
  const ceiling = clampQuantity(max, floor);

  function step(next: number) {
    const clamped = clampQuantity(next, floor, ceiling);
    if (clamped !== value) onChange(clamped);
  }

  function commit(raw: string) {
    setDraft(null);
    if (!isNonNegativeIntegerString(raw)) return;
    step(Number(raw));
  }

  return (
    <div className={cn("flex items-center gap-1", className)} data-test-selector={testSelectorFor("quantity-stepper", name)}>
      <button
        type="button"
        onClick={() => step(value - 1)}
        disabled={value <= floor}
        aria-label={decreaseLabel}
        data-test-selector={testSelectorFor("quantity-decrease", name)}
        className="flex size-11 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink transition-colors not-disabled:hover:border-primary-600 not-disabled:hover:bg-inset disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Minus className="size-5" aria-hidden="true" />
      </button>

      <NumericInput
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        maxLength={QUANTITY_MAX_LENGTH}
        aria-label={valueLabel}
        data-test-selector={testSelectorFor("quantity-value", name)}
        className="h-11 w-14 px-0 text-base font-semibold [&_input]:text-center"
      />

      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= ceiling}
        aria-label={increaseLabel}
        data-test-selector={testSelectorFor("quantity-increase", name)}
        className="flex size-11 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink transition-colors not-disabled:hover:border-primary-600 not-disabled:hover:bg-inset disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
