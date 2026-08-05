"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { TOAST_SLIDE_MS } from "@/constants/feedback";
import { cn } from "@/lib/utils";
import type { Toast } from "@/types/feedback";

interface ToasterProps {
  toasts: Toast[];
}

// "Are we past hydration yet" never changes after it flips, so there is
// nothing to subscribe to.
const subscribeToNothing = () => () => {};

// Brief confirmations that slide in at the top corner and slide back out.
//
// Deliberately not a dialog: a scan is not a question, and a cashier holding
// a garment in one hand and a phone in the other cannot be asked to dismiss
// something before scanning the next item. These land, are readable at a
// glance, and leave on their own.
//
// They take no taps at all — not even to dismiss. A pill that swallowed a
// tap meant for the button underneath it would be worse than one that is
// simply in the way for two seconds, and there is nothing here to act on.
//
// Rendered into <body> through a portal for two reasons: the selling screen
// sits inside the pull-to-refresh wrapper, which transforms its subtree (a
// transformed ancestor would pin these to it instead of to the viewport),
// and the scanner is a Radix sheet portalled to the body — a toast has to
// come out on top of the camera it is reporting on.
export function Toaster({ toasts }: ToasterProps) {
  // There is no document to portal into while this renders on the server,
  // and the first client render has to match that markup — so the portal
  // opens on the render straight after hydration.
  const isHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  if (!isHydrated) return null;

  return createPortal(
    // The corner the reading direction ends in: top-right in English, top-
    // left in Arabic. `items-end` is flex's own logical end, so the column
    // mirrors with the layout instead of being pinned to a physical side.
    //
    // top is offset by the notch/status-bar inset, never under it. z is above
    // the sheet layer (z-50) on purpose; see the note above.
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.5rem)] z-[70] flex flex-col items-end gap-2 px-3"
      // polite, not assertive: it must not cut across a screen reader
      // half-way through reading the cart out.
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex max-w-[min(20rem,calc(100vw-1.5rem))] items-center gap-2.5 rounded-full border py-2 pe-4 ps-2 text-start shadow-lg",
            // In and out along the writing direction: from beyond the edge
            // the toast sits on, and back out the same way. The *-end
            // utilities flip via :dir(), so nothing here is physical.
            "fill-mode-forwards",
            toast.leaving ? "animate-out fade-out-0 slide-out-to-end" : "animate-in fade-in-0 slide-in-from-end",
            // Both fills are opaque: a toast floats over the top bar and the
            // cart, and a see-through one leaves two lines of text printed
            // on top of each other.
            toast.variant === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-destructive/40 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-950 dark:text-red-100"
          )}
          style={{ animationDuration: `${TOAST_SLIDE_MS}ms` }}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full",
              toast.variant === "success"
                ? "bg-emerald-500 text-white"
                : "bg-destructive text-destructive-foreground"
            )}
            aria-hidden="true"
          >
            {toast.variant === "success" ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}
          </span>

          <span className="min-w-0 truncate text-sm font-semibold">{toast.text}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
