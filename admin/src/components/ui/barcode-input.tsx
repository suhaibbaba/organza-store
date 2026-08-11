"use client";

import * as React from "react";
import { BARCODE_MAX_LENGTH } from "@organza/shared/constants/barcode";
import { normalizeBarcode } from "@organza/shared/lib/barcode";
import { isModifierKey, physicalKeyChar } from "@organza/shared/lib/keyboard";
import { BARCODE_TERMINATOR_CODES } from "@/constants/barcode";
import { Input } from "@/components/ui/input";

interface BarcodeInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "onKeyDown"> {
  value: string;
  onChange: (value: string) => void;
  // The scanner has finished sending a code (it pressed Enter). Optional —
  // the value is already in the field either way; this is for a screen that
  // wants to react, e.g. close the camera sheet.
  onScanComplete?: (value: string) => void;
}

// A field a barcode can be typed OR scanned into.
//
// Scanned means the counter's wedge scanner, which is a keyboard: it types
// the code very fast and presses Enter. Two things have to be true for that to
// land cleanly, and neither is true of a plain <input>:
//
//   1. the characters have to come from the key's PHYSICAL position, not from
//      `event.key`. Under the shop's Arabic layout a plain input fills with
//      ٥٩٠١ and ش — a code nothing in the catalogue matches. Every character
//      is therefore claimed here and re-derived (@organza/shared/lib/keyboard), which
//      also means a person typing on that same Arabic keyboard gets ASCII;
//   2. the terminating Enter must NOT submit the form. A wedge scanner ends
//      every code with it, and on a product form that would file the product
//      the moment a barcode was scanned. It is swallowed here instead.
//
// Only this field is touched: the keys are read from its own keydown, never
// from the document, so nothing about it can hijack typing elsewhere. (In the
// POS it is the reverse — the screen listens document-wide and steps aside for
// whatever has focus — so a barcode being deliberately edited is never taken
// out from under the person editing it.)
//
// The camera path needs none of this: it hands over a decoded string, which
// goes through `onChange` like anything else.
export function BarcodeInput({ value, onChange, onScanComplete, ...props }: BarcodeInputProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // A shortcut (Ctrl+V, Cmd+A) or an IME mid-composition. Left to the
    // browser: paste and composition both come back through onChange, which
    // normalizes whatever lands.
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;

    // Shift on its own, which a scanner presses before every capital letter.
    // Not a character, and not the end of the code either.
    if (isModifierKey(event.nativeEvent)) return;

    if (BARCODE_TERMINATOR_CODES.includes(event.code)) {
      // Claimed outright, so the form is not submitted by a scanner's Enter.
      event.preventDefault();
      onScanComplete?.(value);
      return;
    }

    const char = physicalKeyChar(event.nativeEvent);
    // Backspace, arrows, Delete, Home/End, F-keys: not characters, and every
    // one of them does the right thing natively.
    if (char === null) return;

    // A space is never part of a barcode (see normalizeBarcode) — swallowed
    // rather than inserted and stripped a moment later, so the field never
    // flickers.
    if (char.trim() === "") {
      event.preventDefault();
      return;
    }

    const input = event.currentTarget;
    if (input.value.length >= BARCODE_MAX_LENGTH && input.selectionStart === input.selectionEnd) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    // setRangeText rather than string surgery: it replaces whatever is
    // selected and leaves the caret after the insertion, so typing into the
    // middle of a code works normally. React then finds the DOM value already
    // equal to the new state and leaves the caret alone.
    input.setRangeText(char, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, "end");
    onChange(normalizeBarcode(input.value));
  }

  return (
    <Input
      {...props}
      type="text"
      value={value}
      // Covers every path that isn't a keystroke: paste, autofill, the phone's
      // own keyboard (whose Arabic digit row sends ٤), and the camera.
      onChange={(event) => onChange(normalizeBarcode(event.target.value))}
      onKeyDown={handleKeyDown}
      maxLength={BARCODE_MAX_LENGTH}
      // A code is read left-to-right even in an Arabic UI, and never
      // capitalized or autocorrected on the way in.
      dir="ltr"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      // The phone keyboard's Enter says "done" rather than "go", because this
      // field never submits anything.
      enterKeyHint="done"
    />
  );
}
