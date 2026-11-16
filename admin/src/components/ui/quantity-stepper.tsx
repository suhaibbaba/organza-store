"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { QUANTITY_MAX, QUANTITY_MAX_LENGTH, QUANTITY_MIN, clampQuantity } from "@organza/shared/constants/quantity";
import { NumericInput } from "@/components/ui/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  // Each screen may narrow the shared 0–999 range — never widen it: a return
  // can't exceed what is outstanding, an order line can't be zero pieces.
  min?: number;
  max?: number;
  onChange: (quantity: number) => void;
  // Accessible names, passed in rather than read from a fixed namespace, so
  // the same control serves the order builder, the returns sheet and the
  // label counts. Each should already name the line it belongs to, so a
  // screen reader announces "more — Silk Scarf" rather than several identical
  // "more" buttons.
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  // Which line this stepper belongs to, for its name in the DOM
  // (`quantity-stepper-<name>` — CLAUDE.md "Test selectors"). A screen with
  // one stepper may leave it out.
  name?: string;
  className?: string;
}

// Quantity control sized for a thumb: two 44px+ targets either side of a
// field that opens the numeric keypad (CLAUDE.md "Mobile input & device
// specifics" — never <input type="number">, integers only).
//
// The bounds hold whichever way a number arrives. The buttons stop at them
// and go disabled there; a typed or pasted number is clamped into the same
// range when the field is left, so "1200" in a box that tops out at 999 is
// worth exactly what pressing + until it stopped would have been. The digit
// cap on the field means a fourth digit cannot even be typed.
//
// The field holds a draft string only while it is actually being edited,
// because clearing it to type "12" passes through "" — reflecting that
// straight back as a number would snap it to the minimum under the user's
// finger. Once the draft is dropped on blur the field shows the real quantity
// again, so the +/- buttons need nothing kept in sync.
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
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground transition-colors not-disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        className="h-11 w-14 px-0 text-center text-base font-semibold"
      />

      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= ceiling}
        aria-label={increaseLabel}
        data-test-selector={testSelectorFor("quantity-increase", name)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground transition-colors not-disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
