import type { ReactNode } from "react";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";
import type { FigureTone } from "@/types/dashboard";

interface FigureCardProps {
  label: string;
  description?: string;
  toggleLabel: string;
  // Already formatted in the store's currency (rule 14: symbol from Settings).
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: FigureTone;
  // Rendered as `figure-card-<name>` with `figure-card-value-<name>` under it.
  name?: string;
}

// Money someone else holds ("still owed") reads amber so it never looks like takings; the label, not colour, carries the meaning.
const TONE_CLASS: Record<FigureTone, string> = {
  default: "text-ink",
  positive: "text-primary-600",
  warning: "text-warning-700",
};

export function FigureCard({ label, description, toggleLabel, value, subtitle, tone = "default", name }: FigureCardProps) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-card border border-line bg-surface p-[18px_20px] shadow-card"
      data-test-selector={testSelectorFor("figure-card", name)}
    >
      <ExplainedLabel label={label} description={description} toggleLabel={toggleLabel} />
      {/* break-words, not truncate: a clipped amount is worse than a wrapped one. */}
      <p
        className={cn("break-words text-title font-medium tabular-nums", TONE_CLASS[tone])}
        data-test-selector={testSelectorFor("figure-card-value", name)}
      >
        {value}
      </p>
      {subtitle && <p className="mt-1 text-meta text-ink-subtle">{subtitle}</p>}
    </div>
  );
}
