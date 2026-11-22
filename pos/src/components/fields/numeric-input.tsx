"use client";

import * as React from "react";
import { Input } from "@store/ui";
import { DECIMAL_INPUT_PATTERN, INTEGER_INPUT_PATTERN } from "@/constants/numeric";

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "inputMode" | "pattern"> {
  // Stock/quantities are integers (default); prices may keep a decimal point.
  allowDecimal?: boolean;
}

const INTEGER_DISALLOWED_CHARS = /[^0-9]/g;
const DECIMAL_DISALLOWED_CHARS = /[^0-9.]/g;

// Shared by the keystroke, paste/drop and change guards so all three agree on what is allowed.
export function sanitizeNumeric(value: string, allowDecimal: boolean): string {
  let sanitized = value.replace(allowDecimal ? DECIMAL_DISALLOWED_CHARS : INTEGER_DISALLOWED_CHARS, "");
  if (allowDecimal) {
    const firstDot = sanitized.indexOf(".");
    if (firstDot !== -1) {
      sanitized = sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  return sanitized;
}

// Setting input.value directly is invisible to React, so the prototype setter is called before dispatching.
function writeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// type=text + inputMode: number inputs accept e/+/- and misbehave on iOS; typing, paste/drop and change are all guarded.
function NumericInput({ allowDecimal = false, onChange, onBeforeInput, onPaste, onDrop, ...props }: NumericInputProps) {
  function handleBeforeInput(e: React.InputEvent<HTMLInputElement>) {
    onBeforeInput?.(e);
    if (e.defaultPrevented) {
      return;
    }
    const native = e.nativeEvent;
    if (native.inputType !== "insertText" && native.inputType !== "insertCompositionText") {
      return;
    }
    if (native.data == null) {
      return;
    }
    if (sanitizeNumeric(native.data, allowDecimal) === native.data) {
      return;
    }
    // A disallowed char (e.g. "." in integer mode, or a second ".") — reject.
    e.preventDefault();
  }

  function insertSanitized(input: HTMLInputElement, text: string) {
    const clean = sanitizeNumeric(text, allowDecimal);
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = sanitizeNumeric(input.value.slice(0, start) + clean + input.value.slice(end), allowDecimal);
    writeValue(input, next);
    const caret = Math.min(start + clean.length, next.length);
    input.setSelectionRange(caret, caret);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    onPaste?.(e);
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    insertSanitized(e.currentTarget, e.clipboardData.getData("text"));
  }

  function handleDrop(e: React.DragEvent<HTMLInputElement>) {
    onDrop?.(e);
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    // Inserted at the caret: the drop caret is not readable the same way in every engine.
    insertSanitized(e.currentTarget, e.dataTransfer.getData("text"));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeNumeric(e.target.value, allowDecimal);
    if (sanitized !== e.target.value) {
      e.target.value = sanitized;
    }
    onChange?.(e);
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? DECIMAL_INPUT_PATTERN : INTEGER_INPUT_PATTERN}
      onBeforeInput={handleBeforeInput}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onChange={handleChange}
      {...props}
    />
  );
}

export { NumericInput };
