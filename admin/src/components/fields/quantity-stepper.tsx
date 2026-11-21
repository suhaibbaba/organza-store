"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { QUANTITY_MAX, QUANTITY_MAX_LENGTH, QUANTITY_MIN, clampQuantity } from "@organza/shared/constants/quantity";
import { FIELD_TEXT, FieldDivider, fieldShell } from "@store/ui";
import { sanitizeNumeric } from "@/components/fields/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (quantity: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  name?: string;
  testName?: string;
  className?: string;
}

export function QuantityStepper({
  value,
  min = QUANTITY_MIN,
  max = QUANTITY_MAX,
  onChange,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  name,
  testName = "quantity",
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

  const button =
    "flex size-8 shrink-0 items-center justify-center rounded-chip text-ink-muted transition-colors not-disabled:hover:bg-inset not-disabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

  return (
    <div
      className={cn(fieldShell({}), "w-36 gap-1 px-1", className)}
      data-test-selector={testSelectorFor(`${testName}-stepper`, name)}
    >
      <button
        type="button"
        onClick={() => step(value - 1)}
        disabled={value <= floor}
        aria-label={decreaseLabel}
        data-test-selector={testSelectorFor(`${testName}-decrease`, name)}
        className={button}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <FieldDivider />
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        value={draft ?? String(value)}
        onChange={(event) => setDraft(sanitizeNumeric(event.target.value, false))}
        onBlur={(event) => commit(event.target.value)}
        maxLength={QUANTITY_MAX_LENGTH}
        aria-label={valueLabel}
        data-test-selector={testSelectorFor(`${testName}-value`, name)}
        className={cn(FIELD_TEXT, "text-center tabular-nums")}
      />
      <FieldDivider />
      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= ceiling}
        aria-label={increaseLabel}
        data-test-selector={testSelectorFor(`${testName}-increase`, name)}
        className={button}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
