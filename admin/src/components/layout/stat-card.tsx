"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";
import type { StatCardTone } from "@/types/layout";

interface StatCardProps {
  label: string;
  // Already formatted; money in the Settings currency (rule 14).
  value: ReactNode;
  hint?: ReactNode;
  // What the figure means and does not mean; omit for no (?).
  tooltip?: string;
  tone?: StatCardTone;
  // Rendered as `stat-card-<name>`, with `stat-card-value-<name>` for the figure.
  name?: string;
  className?: string;
}

const TONE_CLASS: Record<StatCardTone, string> = {
  default: "text-ink",
  success: "text-success-700",
  warning: "text-warning-700",
};

// The (?) expands inline rather than hovering: ~95% of use is on a phone.
export function StatCard({ label, value, hint, tooltip, tone = "default", name, className }: StatCardProps) {
  const tFigures = useTranslations("figures");

  return (
    <div
      className={cn("flex min-w-0 flex-col rounded-card border border-line bg-surface p-[18px_20px] shadow-card", className)}
      data-test-selector={testSelectorFor("stat-card", name)}
    >
      <ExplainedLabel
        label={label}
        description={tooltip}
        toggleLabel={tFigures("explain", { label })}
        rowClassName="justify-between gap-2"
      />

      {/* break-words, not truncate: a clipped amount is worse than an ugly one. */}
      <p
        className={cn("mt-2 break-words text-title font-medium tabular-nums", TONE_CLASS[tone])}
        data-test-selector={testSelectorFor("stat-card-value", name)}
      >
        {value}
      </p>

      {hint && <p className="mt-[7px] text-meta text-ink-subtle">{hint}</p>}
    </div>
  );
}
