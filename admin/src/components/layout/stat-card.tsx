"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ExplainedLabel } from "@/components/figures/explained-label";
import { Link } from "@/i18n/navigation";
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
  // Makes the whole card open this page; the (?) stays its own button above the link.
  href?: string;
  // What the link opens, for screen readers ("Open today's sales").
  linkLabel?: string;
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

// Compact and flat: icon, label and (?) on one line (stacked on phones), the figure under it.
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
  href,
  linkLabel,
}: StatCardProps) {
  const tFigures = useTranslations("figures");

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-panel border border-line bg-surface p-4",
        href &&
          "relative cursor-pointer transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-card has-[a:focus-visible]:border-primary-300",
        className,
      )}
      style={style}
      data-test-selector={testSelectorFor("stat-card", name)}
    >
      {/* Wraps rather than a container query (iOS 15 has none): a narrow card puts the label under the icon. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
        {Icon && (
          <span
            className={cn("grid size-8 shrink-0 place-items-center rounded-control", ICON_TILE_CLASS[tone])}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
        )}
        <ExplainedLabel
          className={cn("min-w-[8rem] flex-1", href && "[&_button]:relative [&_button]:z-10")}
          rowClassName="min-h-8"
          labelClassName="text-meta font-medium"
          label={label}
          description={tooltip}
          toggleLabel={tFigures("explain", { label })}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        {/* break-words, not truncate: a clipped amount is worse than an ugly one. */}
        <p
          className={cn("break-words text-title font-semibold tracking-tight tabular-nums", TONE_CLASS[tone])}
          data-test-selector={testSelectorFor("stat-card-value", name)}
        >
          {href ? (
            <Link
              href={href}
              aria-label={linkLabel}
              className="rounded-control focus-link after:absolute after:inset-0 after:rounded-panel after:content-['']"
            >
              {value}
            </Link>
          ) : (
            value
          )}
        </p>
        {hint && <p className="text-meta text-ink-subtle">{hint}</p>}
      </div>
    </div>
  );
}
