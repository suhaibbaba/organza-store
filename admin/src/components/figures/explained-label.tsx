"use client";

import type { ReactNode } from "react";
import { InfoTip } from "@store/ui";
import { cn } from "@/lib/utils";

interface ExplainedLabelProps {
  label: string;
  // What the figure means and does NOT mean; omitted ⇒ no info icon.
  description?: string;
  toggleLabel: string;
  // Sits in the label's own row so label and amount share a baseline.
  trailing?: ReactNode;
  labelClassName?: string;
  rowClassName?: string;
  className?: string;
}

// The explanation opens in a tooltip beside the label (hover, focus or tap), never pushing the card's layout.
export function ExplainedLabel({
  label,
  description,
  toggleLabel,
  trailing,
  labelClassName,
  rowClassName,
  className,
}: ExplainedLabelProps) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className={cn("flex min-h-11 items-center gap-1.5", rowClassName)}>
        <p className={cn("min-w-0 text-label text-ink-muted", labelClassName)}>{label}</p>

        {description && <InfoTip label={toggleLabel}>{description}</InfoTip>}

        {trailing !== undefined && <div className="ms-auto shrink-0 ps-2">{trailing}</div>}
      </div>
    </div>
  );
}
