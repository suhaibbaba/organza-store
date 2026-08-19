"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";
import type { StatCardTone } from "@/types/layout";

interface StatCardProps {
  label: string;
  // Already formatted, in the store's currency where it is money (CLAUDE.md
  // rule 14 — the symbol comes from Settings, never from here).
  value: ReactNode;
  hint?: ReactNode;
  // Plain language, one or two sentences: what this figure means and what it
  // does NOT mean. Omit it and no (?) is rendered.
  tooltip?: string;
  tone?: StatCardTone;
  // Which figure this is — "sales-total", "orders-count". Rendered as
  // `stat-card-<name>` with the figure itself under it, because "the third
  // box" is not a description of a number somebody is querying.
  name?: string;
  className?: string;
}

const TONE_CLASS: Record<StatCardTone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
};

// One figure, on a card: the label with its (?) explanation, the number, and
// an optional line of context under it.
//
// The explanation is the app's existing ExplainedLabel — a 44px tap target
// that expands the sentence inline rather than a hover tooltip, because ~95%
// of use is on a phone where there is no hover and a floating bubble clips at
// the edge of a narrow screen. The accessible name is the same `figures.explain`
// sentence every figure in the app already uses.
//
// No fixed height: an Arabic label that wraps to two lines makes the card
// taller, it does not get clipped.
export function StatCard({ label, value, hint, tooltip, tone = "default", name, className }: StatCardProps) {
  const tFigures = useTranslations("figures");

  return (
    <div
      className={cn("flex min-w-0 flex-col rounded-lg bg-muted/40 p-4", className)}
      data-test-selector={testSelectorFor("stat-card", name)}
    >
      <ExplainedLabel
        label={label}
        description={tooltip}
        toggleLabel={tFigures("explain", { label })}
        // The (?) sits in the card's corner rather than tight against the
        // label — `justify-between`, so it mirrors in Arabic on its own.
        rowClassName="justify-between gap-2"
      />

      {/* break-words, not truncate: a long figure in a narrow column has to
          wrap rather than be silently cut in half — a clipped amount is worse
          than an ugly one. tabular-nums keeps the digits in step. */}
      <p
        className={cn("mt-1.5 break-words text-2xl font-medium tabular-nums", TONE_CLASS[tone])}
        data-test-selector={testSelectorFor("stat-card-value", name)}
      >
        {value}
      </p>

      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
