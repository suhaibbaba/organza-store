"use client";

import type { ReactNode } from "react";
import { useActiveSegmentInView } from "@/lib/segmented-scroll";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  /** Already translated — every label reaches here through t(). */
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for a screen reader. A t() string, never a literal. */
  label: string;
  /** "lg" for the counter-side controls in sheets, where taps are hurried. */
  size?: "default" | "lg";
  disabled?: boolean;
  className?: string;
}

/**
 * One row of mutually exclusive choices — a filter, a mode, a discount type.
 *
 * The one place the shape of a tab row is decided for everything that isn't a
 * Radix `Tabs` (components/ui/tabs.tsx, which follows the same rules):
 *
 * - each segment is as wide as its own label, never a column of a fixed grid,
 *   because Arabic labels run longer than their English twins and equal
 *   columns break the long ones onto a second line;
 * - labels never wrap, so every segment is the same height and centred;
 * - a row too wide for the phone scrolls sideways, with the chosen segment
 *   scrolled into view, rather than wrapping or truncating.
 *
 * Building a row of toggle buttons by hand is how the wrapping came back the
 * last three times — use this.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "default",
  disabled,
  className,
}: SegmentedControlProps<T>) {
  const rowRef = useActiveSegmentInView<HTMLDivElement>();

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card p-1",
        // No scrollbar across a 44px strip — it is scrolled by thumb.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3 font-medium transition-colors",
              // ring-inset: the row scrolls, so a ring drawn outside the
              // button's box would be clipped at either end of it.
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              // min-w keeps a one-word segment a full-size target all the
              // same; the height is the same for every segment in the row.
              size === "lg" ? "min-h-12 min-w-20 text-base" : "min-h-11 min-w-16 text-sm",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
