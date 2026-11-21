"use client";

import * as React from "react";
import { BARCODE_MAX_LENGTH } from "@store/shared/constants/barcode";
import { normalizeBarcode } from "@store/shared/lib/barcode";
import { isModifierKey, physicalKeyChar } from "@store/shared/lib/keyboard";
import { BARCODE_TERMINATOR_CODES } from "@/constants/barcode";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { Input } from "@store/ui";

interface BarcodeInputProps extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "onKeyDown"> {
  value: string;
  onChange: (value: string) => void;
  // The scanner pressed Enter; the value is already in the field either way.
  onScanComplete?: (value: string) => void;
}

// Keys are read by PHYSICAL position (an Arabic layout would type ٥٩٠١) and the scanner's terminating Enter never submits the form.
export function BarcodeInput({ value, onChange, onScanComplete, ...props }: BarcodeInputProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Shortcuts and IME composition come back through onChange, which normalizes.
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) {
      return;
    }

    // Shift alone: a scanner presses it before every capital.
    if (isModifierKey(event.nativeEvent)) {
      return;
    }

    if (BARCODE_TERMINATOR_CODES.includes(event.code)) {
      // Claimed outright, so the form is not submitted by a scanner's Enter.
      event.preventDefault();
      onScanComplete?.(value);
      return;
    }

    const char = physicalKeyChar(event.nativeEvent);
    // Non-character keys do the right thing natively.
    if (char === null) {
      return;
    }

    // A space is never part of a barcode; swallowed so the field never flickers.
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
    // setRangeText keeps the caret after the insertion, so typing mid-code works.
    input.setRangeText(
      char,
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
      "end",
    );
    onChange(normalizeBarcode(input.value));
  }

  return (
    <Input
      data-test-selector={fieldTestSelector(props.id)}
      hasError={props["aria-invalid"] === true || props["aria-invalid"] === "true"}
      {...props}
      type="text"
      value={value}
      // Paste, autofill, the phone keyboard (Arabic digits) and the camera.
      onChange={(event) => onChange(normalizeBarcode(event.target.value))}
      onKeyDown={handleKeyDown}
      maxLength={BARCODE_MAX_LENGTH}
      // A code reads LTR even in an Arabic UI.
      dir="ltr"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      // This field never submits anything.
      enterKeyHint="done"
    />
  );
}
