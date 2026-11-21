"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExplainedLabelProps {
  label: string;
  // What the figure means and does NOT mean; omitted ⇒ no (?).
  description?: string;
  toggleLabel: string;
  // Sits in the label's own row so label and amount share a baseline.
  trailing?: ReactNode;
  labelClassName?: string;
  rowClassName?: string;
  className?: string;
}

// A tap (not hover) expands the explanation inline, so it never clips on a phone; the 44px target is the button, the small ring is only its look.
export function ExplainedLabel({
  label,
  description,
  toggleLabel,
  trailing,
  labelClassName,
  rowClassName,
  className,
}: ExplainedLabelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className={cn("flex min-h-11 items-center gap-1", rowClassName)}>
        <p className={cn("min-w-0 text-label text-ink-muted", labelClassName)}>{label}</p>

        {description && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={toggleLabel}
            className="-mx-1 inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-muted focus-visible:bg-neutral-200 focus-visible:text-ink"
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-pill border border-current text-[11px] font-semibold leading-none transition-colors",
                open && "bg-ink text-ink-inverse"
              )}
            >
              ?
            </span>
          </button>
        )}

        {trailing !== undefined && <div className="ms-auto shrink-0 ps-2">{trailing}</div>}
      </div>

      {description && open && (
        <p id={id} className="mb-1 text-meta leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
    </div>
  );
}
