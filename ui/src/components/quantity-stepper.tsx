"use client";

import { useState, type JSX } from "react";
import { Minus, Plus } from "lucide-react";
import { FIELD_TEXT, FieldDivider, fieldShell } from "@ui/components/field";
import { cn } from "@ui/lib/cn";

export interface QuantityStepperProps {
  readonly value: number;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly onChange: (quantity: number) => void;
  // Minus at the floor hands over to the caller (take the line off) instead of stopping there.
  readonly onBelowMin?: (() => void) | undefined;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly valueLabel: string;
  // Parts are named `<testName>-stepper|decrease|value|increase-<name>`.
  readonly name?: string | undefined;
  readonly testName?: string | undefined;
  // "lg" is the till's 44px touch size.
  readonly size?: "md" | "lg" | undefined;
  readonly className?: string | undefined;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 999;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function selector(family: string, name: string | undefined): { "data-testid": string; "data-test-selector": string } {
  const suffix = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const value = suffix ? `${family}-${suffix}` : family;
  return { "data-testid": value, "data-test-selector": value };
}

// A typed quantity is a draft until blur (clearing to type "12" passes through ""), then clamped to the buttons' range.
export function QuantityStepper({
  value,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  onChange,
  onBelowMin,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  name,
  testName = "quantity",
  size = "md",
  className,
}: QuantityStepperProps): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const floor = Math.max(DEFAULT_MIN, min);
  const ceiling = Math.max(floor, max);

  function step(next: number): void {
    if (next < floor && onBelowMin) {
      onBelowMin();
      return;
    }
    const clamped = clamp(next, floor, ceiling);
    if (clamped !== value) {
      onChange(clamped);
    }
  }

  function commit(raw: string): void {
    setDraft(null);
    if (/^\d+$/.test(raw.trim())) {
      step(Number(raw));
    }
  }

  const large = size === "lg";
  const button = cn(
    "flex shrink-0 cursor-pointer items-center justify-center rounded-chip text-ink-muted transition-colors",
    "not-disabled:hover:bg-inset not-disabled:hover:text-ink focus-visible:bg-neutral-200 focus-visible:text-ink",
    "disabled:cursor-not-allowed disabled:opacity-40",
    large ? "size-9" : "size-8",
  );

  return (
    <div
      data-part="quantity-stepper"
      {...selector(`${testName}-stepper`, name)}
      className={cn(fieldShell({}), "gap-1 px-1", large ? "h-11 w-36" : "w-36", className)}
    >
      <button
        type="button"
        onClick={() => step(value - 1)}
        disabled={value <= floor && !onBelowMin}
        aria-label={decreaseLabel}
        {...selector(`${testName}-decrease`, name)}
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
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        maxLength={String(ceiling).length}
        aria-label={valueLabel}
        {...selector(`${testName}-value`, name)}
        className={cn(FIELD_TEXT, "min-w-0 text-center tabular-nums")}
      />
      <FieldDivider />
      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={value >= ceiling}
        aria-label={increaseLabel}
        {...selector(`${testName}-increase`, name)}
        className={button}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
