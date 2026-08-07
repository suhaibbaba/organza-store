"use client";

import { useEffect, useRef } from "react";
import {
  HARDWARE_SCAN_MAX_KEY_GAP_MS,
  HARDWARE_SCAN_MIN_LENGTH,
  HARDWARE_SCAN_TERMINATOR_CODES,
} from "@/constants/pos";
import { isModifierKey, physicalKeyChar } from "@/lib/keyboard";

interface UseHardwareScannerOptions {
  // Off while the screen is asking about something other than what is being
  // scanned — see the call site for which sheets those are.
  enabled: boolean;
  onScan: (code: string) => void;
}

// The plug-in barcode scanner on the shop counter.
//
// It is a keyboard: it types the code and presses Enter, into whatever the
// browser happens to be focusing — which on this screen is deliberately
// nothing, because autofocusing the search box would throw a phone keyboard
// open (see SearchBar). So the keys are read off the document instead, and
// scanning works with the cashier's hands nowhere near the laptop.
//
// Which keys it pressed is read off `event.code` — the key's place on the
// keyboard — and turned into characters here, rather than trusting the
// `event.key` the operating system produced. The shop's keyboard layout is
// Arabic, all day, and under it `event.key` reports `٥` for the `5` key and
// `ش` for `A`: every scan used to fail until the cashier switched the layout
// to English and back. See constants/keyboard.ts.
//
// Telling the scanner apart from a person is the whole job here, and it is
// done on timing alone: characters arriving a few milliseconds apart are a
// machine, characters arriving at human speed are not. Nothing is guessed
// from what the characters are, so a code that happens to look like a word
// still scans.
//
// Typing is never taken. Two separate things guarantee it:
//
//   - anything with focus owns its own keystrokes outright. Somebody typing
//     into the search box is typing, however fast, and a wedge scanner aimed
//     at a focused field already works the way it always has — the box takes
//     the characters and its Enter submits them as a code (SearchBar);
//   - with nothing focused, a burst still has to arrive at machine speed and
//     be long enough to be a code before its Enter is claimed.
export function useHardwareScanner({ enabled, onScan }: UseHardwareScannerOptions) {
  // Read at scan time rather than captured, so the listener is attached once
  // for the life of the screen. Re-attaching it on every render would drop
  // the characters of any burst that happened to be mid-flight.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    // Both live for the length of one burst. Refs would outlive the listener
    // for no reason: nothing renders from them, and a burst never spans a
    // remount.
    let buffer = "";
    let lastKeyAt = 0;

    // Whatever has focus is being typed into — a search box, a discount, a
    // phone number — and its keys are its own.
    function isTypingInto(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    function handleKeyDown(event: KeyboardEvent) {
      // A shortcut, an IME mid-composition, or a key being held down. None
      // of them is a scanner, and each would corrupt a burst in progress.
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) {
        buffer = "";
        return;
      }

      if (isTypingInto(event.target)) {
        buffer = "";
        return;
      }

      // Shift on its own, which a scanner presses before every capital in a
      // SKU. Neither a character nor the end of the burst — leave the buffer
      // exactly as it is and wait for the letter it belongs to.
      if (isModifierKey(event)) return;

      // The event's own clock, so every gap is measured against the same one
      // and a busy main thread cannot stretch one keystroke into a "person".
      const gap = event.timeStamp - lastKeyAt;

      if (HARDWARE_SCAN_TERMINATOR_CODES.includes(event.code)) {
        const code = buffer;
        buffer = "";
        // Too short to be a code, or the trigger came in long after the last
        // character: not a scan, and the key goes on to whatever wanted it.
        if (code.length < HARDWARE_SCAN_MIN_LENGTH || gap > HARDWARE_SCAN_MAX_KEY_GAP_MS) return;
        // Claimed outright: nothing else on the screen should also treat this
        // as an Enter — Tab in particular would move focus somewhere the
        // cashier never asked to be.
        event.preventDefault();
        event.stopPropagation();
        onScanRef.current(code);
        return;
      }

      // Anything that isn't a character (arrows, Escape, F-keys) is not part
      // of a code, and ends whatever was being collected.
      const char = physicalKeyChar(event);
      if (char === null) {
        buffer = "";
        return;
      }

      // A slow key starts a fresh burst rather than extending the last one,
      // which is what keeps a person's stray keypresses from ever adding up
      // to something long enough to be claimed.
      buffer = gap > HARDWARE_SCAN_MAX_KEY_GAP_MS ? char : buffer + char;
      lastKeyAt = event.timeStamp;
    }

    // Capture, so the burst's Enter is claimed before a form or an open sheet
    // can act on it.
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled]);
}
