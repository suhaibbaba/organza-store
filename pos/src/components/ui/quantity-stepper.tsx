"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { QUANTITY_MAX_LENGTH, clampQuantity } from "@shared/constants/quantity";
import { NumericInput } from "@/components/ui/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { MIN_CART_QUANTITY } from "@/constants/pos";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (quantity: number) => void;
  // What "one less than the minimum" means on this screen. A cart line's
  // floor is one piece, so minus at 1 is not a decrement at all — it is a
  // request to take the line off the sale, and the caller answers it by
  // asking the cashier first. Without it the minus simply stops at the floor.
  onBelowMin?: () => void;
  // Names the line this stepper belongs to, so a screen reader announces
  // "more — Silk Scarf" rather than three identical "more" buttons.
  itemLabel: string;
  className?: string;
}

// Quantity control sized for a thumb: two 44px+ targets either side of a
// field that opens the numeric keypad (CLAUDE.md "Mobile input & device
// specifics" — never <input type="number">, integers only).
//
// The bounds hold whichever way a number arrives: the buttons stop at them,
// and a typed or pasted number is clamped into the same range when the field
// is left, so the box can never carry a quantity the buttons refuse to reach.
//
// The field holds a draft string only while it is actually being edited,
// because clearing it to type "12" passes through "" — reflecting that
// straight back as a number would snap it to 1 under the cashier's finger.
// Once the draft is dropped on blur the field shows the real quantity
// again, so the +/- buttons need nothing kept in sync.
export function QuantityStepper({ value, max, onChange, onBelowMin, itemLabel, className }: QuantityStepperProps) {
  const t = useTranslations("sell.cart");
  const [draft, setDraft] = useState<string | null>(null);

  const floor = clampQuantity(MIN_CART_QUANTITY);
  const ceiling = clampQuantity(max, floor);

  function step(next: number) {
    // Below the floor is never silently swallowed and never silently applied:
    // it is handed to the caller, which is where "remove this line?" lives.
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

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => step(value - 1)}
        // Enabled at the floor only when there is somewhere for it to go —
        // otherwise it is a button that would do nothing.
        disabled={value <= floor && !onBelowMin}
        aria-label={t("decrease", { name: itemLabel })}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground transition-colors not-disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Minus className="size-5" aria-hidden="true" />
      </button>

      <NumericInput
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        maxLength={QUANTITY_MAX_LENGTH}
        aria-label={t("quantity", { name: itemLabel })}
        className="h-11 w-14 px-0 text-center text-base font-semibold"
      />

      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= ceiling}
        aria-label={t("increase", { name: itemLabel })}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground transition-colors not-disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
