"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { DECIMAL_INPUT_PATTERN, INTEGER_INPUT_PATTERN } from "@/constants/numeric";

interface NumericInputProps extends Omit<React.ComponentProps<"input">, "type" | "inputMode" | "pattern"> {
  // Stock/quantities are integers (default); prices may keep a decimal point.
  allowDecimal?: boolean;
}

const INTEGER_DISALLOWED_CHARS = /[^0-9]/g;
const DECIMAL_DISALLOWED_CHARS = /[^0-9.]/g;

// Strips anything that isn't allowed for the field's mode: digits always,
// plus a single leading-most "." when decimals are allowed. Shared by the
// keystroke guard and the change/paste sanitizer so both agree exactly.
function sanitizeNumeric(value: string, allowDecimal: boolean): string {
  let sanitized = value.replace(allowDecimal ? DECIMAL_DISALLOWED_CHARS : INTEGER_DISALLOWED_CHARS, "");
  if (allowDecimal) {
    const firstDot = sanitized.indexOf(".");
    if (firstDot !== -1) {
      sanitized = sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  return sanitized;
}

// Native <input type="number"> doesn't reliably show a numeric keypad on
// mobile and can strand the field when the last digit is deleted on iOS.
// This renders type="text" with inputMode + pattern instead (so the phone
// still shows a numeric keypad), and keeps the value clean two ways:
//   1. beforeinput blocks a disallowed *typed* character outright, so in
//      integer mode a "." can never even appear for a frame — important on
//      mobile keyboards/IMEs where a change-time rewrite can be dropped
//      mid-composition and leave the stray "." on screen.
//   2. change sanitizes whatever lands (covers paste, autofill, drag-drop),
//      so a pasted "1.5" becomes "15" in integer mode.
function NumericInput({ allowDecimal = false, onChange, onBeforeInput, ...props }: NumericInputProps) {
  function handleBeforeInput(e: React.InputEvent<HTMLInputElement>) {
    onBeforeInput?.(e);
    if (e.defaultPrevented) return;
    const native = e.nativeEvent;
    // Only guard single insertions here; paste/replace still flows through
    // handleChange's sanitizer (blocking a whole paste would drop valid
    // digits along with the stray character). If the browser/React doesn't
    // expose inputType (older synthetic beforeinput), this is a no-op and
    // handleChange remains the safety net.
    if (native.inputType !== "insertText" && native.inputType !== "insertCompositionText") return;
    if (native.data == null) return;
    if (sanitizeNumeric(native.data, allowDecimal) === native.data) return;
    // A disallowed char (e.g. "." in integer mode, or a second ".") — reject.
    e.preventDefault();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeNumeric(e.target.value, allowDecimal);
    if (sanitized !== e.target.value) e.target.value = sanitized;
    onChange?.(e);
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? DECIMAL_INPUT_PATTERN : INTEGER_INPUT_PATTERN}
      onBeforeInput={handleBeforeInput}
      onChange={handleChange}
      {...props}
    />
  );
}

export { NumericInput };
