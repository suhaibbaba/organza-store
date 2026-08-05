"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast } from "@/types/feedback";

interface ToasterProps {
  toasts: Toast[];
  // Where the screen currently has room to spare. "bottom" floats just above
  // the checkout bar, clear of the search box and of whatever was just added
  // at the top of the cart; "top" is for when a sheet has taken over the
  // bottom of the screen and the strip above it is all that is left.
  placement: "top" | "bottom";
}

// "Are we past hydration yet" never changes after it flips, so there is
// nothing to subscribe to.
const subscribeToNothing = () => () => {};

// Brief confirmations that float over whatever is on screen.
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
export function Toaster({ toasts, placement }: ToasterProps) {
  // There is no document to portal into while this renders on the server,
  // and the first client render has to match that markup — so the portal
  // opens on the render straight after hydration.
  const isHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  if (!isHydrated) return null;

  const atBottom = placement === "bottom";

  return createPortal(
    // Centred, because a centred column is identical in both writing
    // directions and leaves nothing to mirror for RTL. z is above the sheet
    // layer (z-50) on purpose; see the note above.
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4",
        atBottom
          ? // Column grows upwards from just above the checkout bar, newest
            // nearest the bottom — closest to where the cashier is looking.
            "bottom-[calc(var(--checkout-bar-height)+0.75rem)] flex-col-reverse"
          : "top-[calc(var(--top-bar-inset)+0.5rem)]"
      )}
      // polite, not assertive: it must not cut across a screen reader
      // half-way through reading the cart out.
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex w-full max-w-sm items-center gap-2.5 rounded-full border px-3 py-2 text-start shadow-lg",
            "animate-in fade-in-0 duration-200",
            atBottom ? "slide-in-from-bottom-2" : "slide-in-from-top-2",
            // Both fills are opaque: a toast floats over the search box and
            // the cart, and a see-through one leaves two lines of text
            // printed on top of each other.
            toast.variant === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-destructive/40 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-950 dark:text-red-100"
          )}
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

          <span className="min-w-0 flex-1 text-sm font-semibold">{toast.text}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
