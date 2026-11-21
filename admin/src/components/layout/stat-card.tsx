"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { testSelectorFor } from "@store/shared/lib/testSelector";
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
  // A tinted tile beside the label, in the figure's tone.
  icon?: LucideIcon;
  className?: string;
  style?: CSSProperties;
}

const TONE_CLASS: Record<StatCardTone, string> = {
  default: "text-ink",
  success: "text-success-700",
  warning: "text-warning-700",
};

const ICON_TILE_CLASS: Record<StatCardTone, string> = {
  default: "bg-primary-100 text-primary-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
};

// The (?) expands inline rather than hovering: ~95% of use is on a phone.
export function StatCard({
  label,
  value,
  hint,
  tooltip,
  tone = "default",
  name,
  icon: Icon,
  className,
  style,
}: StatCardProps) {
  const tFigures = useTranslations("figures");

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-card border border-line bg-surface p-[18px_20px] shadow-card",
        className,
      )}
      style={style}
      data-test-selector={testSelectorFor("stat-card", name)}
    >
      <div className="flex items-start gap-3">
        <ExplainedLabel
          className="min-w-0 flex-1"
          label={label}
          description={tooltip}
          toggleLabel={tFigures("explain", { label })}
          rowClassName="justify-between gap-2"
        />
        {Icon && (
          <span
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-panel", ICON_TILE_CLASS[tone])}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
        )}
      </div>

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
