"use client";

import { useCallback, useMemo, useRef } from "react";
import { useToast } from "@store/ui";
import { FEEDBACK_TIMEOUT_MS } from "@/constants/feedback";
import type { FeedbackVariant } from "@/types/feedback";

type Values = Record<string, string | number>;

export interface ToastQueue {
  // `messageKey` is a full message key; `key` names what the toast is about, so the same news is not repeated while it is still up.
  show: (variant: FeedbackVariant, messageKey: string, values?: Values, key?: string) => void;
  // Forgets what is on screen, so the next message is always shown (a sale being submitted).
  clear: () => void;
}

// The selling screen's running commentary over @store/ui's toasts; nothing here ever needs a tap to dismiss.
export function useToasts(): ToastQueue {
  const toast = useToast();
  const recent = useRef(new Map<string, { signature: string; at: number }>());

  const show = useCallback(
    (variant: FeedbackVariant, messageKey: string, values?: Values, key?: string) => {
      if (key) {
        const signature = `${variant}|${messageKey}|${JSON.stringify(values ?? {})}`;
        const now = Date.now();
        const last = recent.current.get(key);
        // A tag lying under the camera is one problem, not five.
        if (last && last.signature === signature && now - last.at < FEEDBACK_TIMEOUT_MS) {
          return;
        }
        recent.current.set(key, { signature, at: now });
      }

      if (variant === "success") {
        toast.success(messageKey, values);
      } else {
        toast.error(messageKey, values);
      }
    },
    [toast],
  );

  const clear = useCallback(() => recent.current.clear(), []);

  return useMemo(() => ({ show, clear }), [show, clear]);
}
