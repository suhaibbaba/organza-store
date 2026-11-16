import type { ReactNode } from "react";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";
import type { FigureTone } from "@/types/dashboard";

interface FigureCardProps {
  label: string;
  description?: string;
  toggleLabel: string;
  // Already formatted, in the store's currency (CLAUDE.md rule 14 — the
  // symbol comes from Settings, never from here).
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: FigureTone;
  // Which figure this is — "gross-profit", "orders-count". Rendered as
  // `figure-card-<name>` with the number under it (CLAUDE.md "Test
  // selectors"), so a query about a figure can name it.
  name?: string;
}

// Money the shop HOLDS reads in the brand colour; money someone else is
// holding reads amber, because "still owed" is the figure that needs chasing
// and it must not look like takings. Never colour alone: the label says which
// is which, the tone only reinforces it.
const TONE_CLASS: Record<FigureTone, string> = {
  default: "text-foreground",
  positive: "text-primary",
  warning: "text-amber-600 dark:text-amber-400",
};

// One figure, on a card. The number is the point of the card, so it is the
// biggest thing on it — readable at arm's length, which is how someone checks
// the day's takings while serving.
export function FigureCard({ label, description, toggleLabel, value, subtitle, tone = "default", name }: FigureCardProps) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm"
      data-test-selector={testSelectorFor("figure-card", name)}
    >
      <ExplainedLabel label={label} description={description} toggleLabel={toggleLabel} />
      {/* break-words, not truncate: a long figure in a narrow column has to
          wrap rather than be silently cut in half — a clipped amount is worse
          than an ugly one. tabular-nums keeps the digits in step. */}
      <p
        className={cn("break-words text-xl font-bold tabular-nums sm:text-2xl", TONE_CLASS[tone])}
        data-test-selector={testSelectorFor("figure-card-value", name)}
      >
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
