"use client";

import { useEffect, useRef } from "react";
import {
  SELL_SHORTCUT_CHECKOUT,
  SELL_SHORTCUT_CLEAR,
  SELL_SHORTCUT_FOCUS_SEARCH,
  SELL_SHORTCUT_FOCUS_SEARCH_CODE,
  SELL_SHORTCUT_SCAN,
} from "@/constants/pos";

interface SellShortcuts {
  // Off while a sheet is open: Escape belongs to whichever one it is.
  enabled: boolean;
  onFocusSearch: () => void;
  onScan: () => void;
  onCheckout: () => void;
  onClear: () => void;
}

// Counter-laptop keys, additive only: each is also an on-screen button for the phone.
export function useSellShortcuts({ enabled, onFocusSearch, onScan, onCheckout, onClear }: SellShortcuts) {
  // Latched so the listener attaches once (as in use-hardware-scanner.ts).
  const handlersRef = useRef({ onFocusSearch, onScan, onCheckout, onClear });
  useEffect(() => {
    handlersRef.current = { onFocusSearch, onScan, onCheckout, onClear };
  }, [onFocusSearch, onScan, onCheckout, onClear]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function isTypingInto(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (target.isContentEditable) {
        return true;
      }
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Browser and OS shortcuts stay the browser's and the OS's.
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }

      const handlers = handlersRef.current;
      const typing = isTypingInto(event.target);

      // Only a shortcut where a character has nowhere to go; also matched by key position (Arabic layout types ظ).
      if (event.key === SELL_SHORTCUT_FOCUS_SEARCH || event.code === SELL_SHORTCUT_FOCUS_SEARCH_CODE) {
        if (typing) {
          return;
        }
        // Or it would land in the box it just focused.
        event.preventDefault();
        handlers.onFocusSearch();
        return;
      }

      switch (event.key) {
        // Function keys type nothing, so they work with the cursor still in the search box.
        case SELL_SHORTCUT_SCAN:
          event.preventDefault();
          handlers.onScan();
          return;

        case SELL_SHORTCUT_CHECKOUT:
          event.preventDefault();
          handlers.onCheckout();
          return;

        // Not prevented: a native search field also clears itself with Escape.
        case SELL_SHORTCUT_CLEAR:
          handlers.onClear();
          return;

        default:
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
