"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExplainedLabelProps {
  label: string;
  // Plain language, one or two sentences: what this figure means and what it
  // does NOT mean. Omit it and the (?) simply isn't rendered.
  description?: string;
  // Accessible name for the toggle, e.g. "What does 'Still owed' mean?".
  toggleLabel: string;
  // Rendered at the end of the label's own row — the amount, on the running
  // calculation in the drawer. Keeping it in this row is what makes label and
  // figure share a baseline without any hand-tuned offsets.
  trailing?: ReactNode;
  labelClassName?: string;
  className?: string;
}

// A figure's label with a (?) beside it that expands a plain-language
// explanation INLINE, underneath.
//
// Three deliberate choices, all from CLAUDE.md's "Frontend UX":
//
//   * It is a tap, not a hover. ~95% of use is on a phone, where there is no
//     hover — a tooltip would be unreachable, and on the few devices that do
//     fire one it lands under the finger.
//   * It expands in place rather than floating. A popover has to be measured
//     against the viewport and still clips at the edge of a narrow screen;
//     text in normal flow simply wraps and pushes the card taller, so it can
//     never overflow or be cut off however long the sentence or wide the
//     Arabic.
//   * The tap target is a full 44px even though the ring drawn inside it is
//     small: the ring is what it looks like, the button is what it is.
export function ExplainedLabel({
  label,
  description,
  toggleLabel,
  trailing,
  labelClassName,
  className,
}: ExplainedLabelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex min-h-11 items-center gap-1">
        <p className={cn("min-w-0 text-sm text-muted-foreground", labelClassName)}>{label}</p>

        {description && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={toggleLabel}
            className="-mx-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full border border-current text-[11px] font-semibold leading-none transition-colors",
                open && "bg-foreground text-background"
              )}
            >
              ?
            </span>
          </button>
        )}

        {trailing !== undefined && <div className="ms-auto shrink-0 ps-2">{trailing}</div>}
      </div>

      {description && open && (
        <p id={id} className="mb-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
