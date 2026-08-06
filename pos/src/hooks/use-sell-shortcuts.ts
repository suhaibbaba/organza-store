"use client";

import { useEffect, useRef } from "react";
import {
  SELL_SHORTCUT_CHECKOUT,
  SELL_SHORTCUT_CLEAR,
  SELL_SHORTCUT_FOCUS_SEARCH,
  SELL_SHORTCUT_SCAN,
} from "@/constants/pos";

interface SellShortcuts {
  // Off while a sheet has the screen: those answer their own keys, and
  // Escape in particular belongs to whichever one is open.
  enabled: boolean;
  onFocusSearch: () => void;
  onScan: () => void;
  onCheckout: () => void;
  onClear: () => void;
}

// Keyboard for the counter laptop.
//
// Additive, and only that: every one of these is also a button on the screen,
// because the same screen is used all day on a phone where there is no
// keyboard at all, and a touch monitor is planned for the counter itself.
// Nothing here is the only way to do anything.
//
// The four are the four things a sale is made of — find it, scan it, take the
// money, start again — and they are listed on screen in the counter panel so
// nobody has to be told about them.
export function useSellShortcuts({ enabled, onFocusSearch, onScan, onCheckout, onClear }: SellShortcuts) {
  // Latched, so the listener is attached once rather than rebuilt whenever
  // the cart changes — see the same note in use-hardware-scanner.ts.
  const handlersRef = useRef({ onFocusSearch, onScan, onCheckout, onClear });
  useEffect(() => {
    handlersRef.current = { onFocusSearch, onScan, onCheckout, onClear };
  }, [onFocusSearch, onScan, onCheckout, onClear]);

  useEffect(() => {
    if (!enabled) return;

    function isTypingInto(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Browser and OS shortcuts stay the browser's and the OS's.
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;

      const handlers = handlersRef.current;
      const typing = isTypingInto(event.target);

      switch (event.key) {
        // A character, so it is only a shortcut where a character has nowhere
        // to go. In a field it is a "/", as it must be.
        case SELL_SHORTCUT_FOCUS_SEARCH:
          if (typing) return;
          // Or it would land in the box it just focused.
          event.preventDefault();
          handlers.onFocusSearch();
          return;

        // Function keys are safe to take anywhere: they type nothing, so
        // reaching for the camera or finishing the sale works with the cursor
        // still sitting in the search box.
        case SELL_SHORTCUT_SCAN:
          event.preventDefault();
          handlers.onScan();
          return;

        case SELL_SHORTCUT_CHECKOUT:
          event.preventDefault();
          handlers.onCheckout();
          return;

        // Not prevented: Escape has other owners on this screen (a native
        // search field clears itself with it), and this only adds the rest —
        // empty the box, drop out of the results, hand focus back.
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
