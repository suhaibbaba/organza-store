"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { NumericInput } from "@/components/ui/numeric-input";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (quantity: number) => void;
  // Accessible names, passed in rather than read from a fixed namespace, so
  // the same control serves the order builder and the returns sheet. Each
  // should already name the line it belongs to, so a screen reader announces
  // "more — Silk Scarf" rather than several identical "more" buttons.
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  className?: string;
}

// Quantity control sized for a thumb: two 44px+ targets either side of a
// field that opens the numeric keypad (CLAUDE.md "Mobile input & device
// specifics" — never <input type="number">, integers only).
//
// The field holds a draft string only while it is actually being edited,
// because clearing it to type "12" passes through "" — reflecting that
// straight back as a number would snap it to the minimum under the user's
// finger. Once the draft is dropped on blur the field shows the real quantity
// again, so the +/- buttons need nothing kept in sync.
export function QuantityStepper({
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    setDraft(null);
    if (!isNonNegativeIntegerString(raw)) return;
    const clamped = Math.min(Math.max(Number(raw), min), Math.max(min, max));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={decreaseLabel}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Minus className="size-5" aria-hidden="true" />
      </button>

      <NumericInput
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        aria-label={valueLabel}
        className="h-11 w-14 px-0 text-center text-base font-semibold"
      />

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={increaseLabel}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input text-foreground transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
