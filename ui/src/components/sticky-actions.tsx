import type { JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface StickyActionsProps extends TestIdProps {
  readonly visible: boolean;
  readonly label: string;
  readonly message: ReactNode;
  readonly children: ReactNode;
  readonly tone?: "warning" | "primary" | undefined;
  readonly size?: "sm" | "md" | undefined;
  readonly className?: string | undefined;
}

// A floating glass pill of page actions over the bottom edge, above the phone's bottom nav (--bottom-bar-inset) where there is one.
export function StickyActions({
  visible,
  label,
  message,
  children,
  tone = "warning",
  size = "sm",
  className,
  "data-testid": testId,
}: StickyActionsProps): JSX.Element {
  const part = parts("sticky-actions", testId);
  const dot = tone === "warning" ? "bg-warning-500" : "bg-primary-600";

  return (
    <>
      {visible && <div {...part("spacer")} aria-hidden="true" className="h-24" />}
      <div
        {...part()}
        role="region"
        aria-label={label}
        data-state={visible ? "open" : "closed"}
        inert={!visible}
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-[var(--bottom-bar-inset,0px)] z-40 flex justify-center",
          "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-6",
          className,
        )}
      >
        <div
          {...part("glass")}
          className={cn(
            // Phones: a card with the message on its own line and the actions sharing the row under it; sm+: one pill.
            "pointer-events-auto relative isolate flex w-full flex-col gap-2 overflow-hidden rounded-card p-2.5",
            "sm:flex-row sm:items-center sm:rounded-pill sm:p-1.5 sm:ps-4",
            size === "md" ? "max-w-xl" : "max-w-(--field-max)",
            "border border-surface/80 bg-surface/90 shadow-glass",
            "supports-[backdrop-filter]:bg-surface/10",
            "supports-[backdrop-filter]:backdrop-blur-sm supports-[backdrop-filter]:backdrop-saturate-180 supports-[backdrop-filter]:backdrop-brightness-105",
            "transition-[translate,opacity,scale] duration-500",
            visible
              ? "translate-y-0 scale-100 opacity-100 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              : "translate-y-[calc(100%+1.5rem)] scale-90 opacity-0 ease-[cubic-bezier(0.32,0.72,0,1)]",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-l from-primary-100/40 via-transparent to-primary-50/30"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 rounded-b-[50%] bg-gradient-to-b from-surface/70 via-surface/15 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-surface to-transparent"
          />

          <div {...part("message")} className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 text-label sm:px-0">
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              <span className={cn("absolute inset-0 rounded-pill opacity-60 motion-safe:animate-ping", dot)} />
              <span className={cn("relative size-2 rounded-pill", dot)} />
            </span>
            <span className="min-w-0 font-medium text-ink sm:truncate">{message}</span>
          </div>
          <div {...part("actions")} className="flex shrink-0 gap-2 *:flex-1 sm:*:flex-none">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

// The quiet glass button that sits before the main action in the pill.
export const STICKY_SECONDARY_CLASS =
  "rounded-pill border border-surface/70 bg-surface/40 text-ink hover:bg-surface/70";
export const STICKY_PRIMARY_CLASS = "rounded-pill px-4 shadow-pill ring-1 ring-surface/30 ring-inset";
