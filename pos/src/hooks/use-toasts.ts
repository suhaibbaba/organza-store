"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FEEDBACK_TIMEOUT_MS, MAX_VISIBLE_TOASTS, TOAST_SLIDE_MS } from "@/constants/feedback";
import type { FeedbackVariant, Toast } from "@/types/feedback";

export interface ToastQueue {
  // Newest first — a toast that arrives while others are still up appears
  // at the top, where the cashier's eye already is.
  toasts: Toast[];
  // `key` identifies what the message is about (a cart line, an error
  // code). Showing the same key again rewrites that toast in place instead
  // of stacking a near-identical one, so scanning one item six times leaves
  // a single line counting up rather than six shouting past each other.
  show: (variant: FeedbackVariant, text: string, key?: string) => void;
  // Wipes the board — used when the screen is about to change out from
  // under them (a sale being submitted), not by anything the cashier taps:
  // toasts are not dismissible by hand, they simply expire.
  clear: () => void;
}

// The screen's running commentary: what just went into the cart, what
// didn't scan. Every action on the selling screen has to say what happened
// (CLAUDE.md "Clear feedback always"), but nothing here may ever require a
// tap to get rid of — the cashier's hands are full of clothes, and a scan
// that has to be acknowledged stops the queue moving.
//
// So: a couple can be on screen at once (different items do get scanned
// faster than one message can be read), each expires on its own, and the
// oldest is pushed out rather than letting the column grow down over the
// cart it is reporting on.
export function useToasts(): ToastQueue {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Mirrored in a ref because two scans can land in the same tick, and the
  // second has to see what the first did rather than both starting from the
  // same stale array.
  const toastsRef = useRef<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const commit = useCallback((next: Toast[]) => {
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const forget = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const remove = useCallback(
    (id: number) => {
      forget(id);
      commit(toastsRef.current.filter((toast) => toast.id !== id));
    },
    [commit, forget]
  );

  // Time is up: the toast is marked as leaving and stays mounted for the
  // length of the slide, then goes. Without the two steps it would blink out
  // of existence instead of sliding back off the edge it came from.
  const expire = useCallback(
    (id: number) => {
      forget(id);
      commit(toastsRef.current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
      timers.current.set(
        id,
        setTimeout(() => remove(id), TOAST_SLIDE_MS)
      );
    },
    [commit, forget, remove]
  );

  // Starts (or restarts) a toast's life. Restarting matters for a rewritten
  // one: the cashier has only just been told the new number.
  const scheduleExpiry = useCallback(
    (id: number) => {
      forget(id);
      timers.current.set(
        id,
        setTimeout(() => expire(id), FEEDBACK_TIMEOUT_MS)
      );
    },
    [expire, forget]
  );

  const show = useCallback(
    (variant: FeedbackVariant, text: string, key?: string) => {
      const existing = key ? toastsRef.current.find((toast) => toast.key === key) : undefined;

      if (existing) {
        // Rewritten where it already sits, rather than moved to the top —
        // a line jumping around under a thumb is harder to read than one
        // whose number simply changes. `leaving` is cleared in case the news
        // arrived while it was already sliding away.
        commit(
          toastsRef.current.map((toast) =>
            toast.id === existing.id ? { ...toast, variant, text, leaving: false } : toast
          )
        );
        scheduleExpiry(existing.id);
        return;
      }

      nextId.current += 1;
      const id = nextId.current;
      const next = [{ id, key, variant, text }, ...toastsRef.current];
      // Anything past the cap is dropped here rather than left to expire,
      // so its timer goes with it.
      next.slice(MAX_VISIBLE_TOASTS).forEach((dropped) => forget(dropped.id));
      commit(next.slice(0, MAX_VISIBLE_TOASTS));
      scheduleExpiry(id);
    },
    [commit, forget, scheduleExpiry]
  );

  const clear = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    commit([]);
  }, [commit]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return { toasts, show, clear };
}
