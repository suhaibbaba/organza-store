"use client";

import { useEffect, useRef } from "react";
import {
  HARDWARE_SCAN_MAX_KEY_GAP_MS,
  HARDWARE_SCAN_MIN_LENGTH,
  HARDWARE_SCAN_TERMINATOR_CODES,
} from "@/constants/pos";
import { isModifierKey, physicalKeyChar } from "@store/shared/lib/keyboard";

interface UseHardwareScannerOptions {
  enabled: boolean;
  onScan: (code: string) => void;
}

// The counter's plug-in scanner types into nothing focused; bursts too fast for a person are claimed as scans.
export function useHardwareScanner({ enabled, onScan }: UseHardwareScannerOptions) {
  // Read at scan time so the listener attaches once; re-attaching would drop a burst mid-flight.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let buffer = "";
    let lastKeyAt = 0;

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
      // Shortcuts, IME composition and held keys are never a scanner and would corrupt a burst.
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) {
        buffer = "";
        return;
      }

      if (isTypingInto(event.target)) {
        buffer = "";
        return;
      }

      // Shift alone precedes every capital in a SKU: keep the buffer and wait for its letter.
      if (isModifierKey(event)) {
        return;
      }

      // The event's own clock, so a busy main thread can't stretch a keystroke into a person.
      const gap = event.timeStamp - lastKeyAt;

      if (HARDWARE_SCAN_TERMINATOR_CODES.includes(event.code)) {
        const code = buffer;
        buffer = "";
        if (code.length < HARDWARE_SCAN_MIN_LENGTH || gap > HARDWARE_SCAN_MAX_KEY_GAP_MS) {
          return;
        }
        // Claimed outright: Tab in particular would move focus somewhere nobody asked.
        event.preventDefault();
        event.stopPropagation();
        onScanRef.current(code);
        return;
      }

      const char = physicalKeyChar(event);
      if (char === null) {
        buffer = "";
        return;
      }

      // A slow key starts a fresh burst, so a person's stray keypresses never add up to a code.
      buffer = gap > HARDWARE_SCAN_MAX_KEY_GAP_MS ? char : buffer + char;
      lastKeyAt = event.timeStamp;
    }

    // Capture, so the burst's Enter is claimed before a form or open sheet acts on it.
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled]);
}
