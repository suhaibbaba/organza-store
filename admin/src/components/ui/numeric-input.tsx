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

// Native <input type="number"> doesn't reliably show a numeric keypad on
// mobile and can strand the field when the last digit is deleted on iOS.
// This renders type="text" with inputMode + pattern instead (so the phone
// still shows a numeric keypad), and sanitizes keystrokes to digits — plus
// a single "." when allowDecimal — as the user types.
function NumericInput({ allowDecimal = false, onChange, ...props }: NumericInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let sanitized = e.target.value.replace(allowDecimal ? DECIMAL_DISALLOWED_CHARS : INTEGER_DISALLOWED_CHARS, "");
    if (allowDecimal) {
      const firstDot = sanitized.indexOf(".");
      if (firstDot !== -1) {
        sanitized = sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, "");
      }
    }
    if (sanitized !== e.target.value) e.target.value = sanitized;
    onChange?.(e);
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? DECIMAL_INPUT_PATTERN : INTEGER_INPUT_PATTERN}
      onChange={handleChange}
      {...props}
    />
  );
}

export { NumericInput };
