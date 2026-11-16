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
// keystroke guard, the paste/drop guard and the change sanitizer, so all
// three agree exactly on what a "." is worth in an integer field: nothing.
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

// Writes a value into the DOM input the way a keystroke would, so React sees
// it. Assigning `input.value` directly is invisible to React (its own value
// tracker thinks nothing changed and swallows the event that follows), which
// is why the prototype setter is called explicitly before the input event is
// dispatched. This is what lets the paste/drop guard rewrite the text without
// the component having to be controlled.
function writeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// Native <input type="number"> doesn't reliably show a numeric keypad on
// mobile, accepts "e", "+", "-" and ".", and can strand the field when the
// last digit is deleted on iOS. This renders type="text" with inputMode +
// pattern instead (so the phone still shows a numeric keypad), and keeps the
// value clean at all three doors text can come through:
//   1. TYPING — beforeinput rejects a disallowed character outright, so in
//      integer mode a "." can never appear even for a frame. Important on
//      mobile keyboards/IMEs, where a change-time rewrite can be dropped
//      mid-composition and leave the stray character on screen.
//   2. PASTE and DROP — the incoming text is stripped to digits and inserted
//      over the selection ourselves, so pasting "1.5" into a quantity box
//      puts "15" there rather than briefly showing "1.5". Prevented rather
//      than blocked outright: a paste carrying one bad character should not
//      throw away the good digits with it.
//   3. ANYTHING ELSE — change sanitizes whatever lands (autofill, a browser
//      that doesn't report inputType, a synthetic event in a test), so the
//      value React is handed is always clean even if the guards above were
//      never reached.
function NumericInput({
  allowDecimal = false,
  onChange,
  onBeforeInput,
  onPaste,
  onDrop,
  ...props
}: NumericInputProps) {
  function handleBeforeInput(e: React.InputEvent<HTMLInputElement>) {
    onBeforeInput?.(e);
    if (e.defaultPrevented) return;
    const native = e.nativeEvent;
    // Only guard single insertions here; paste and drop have their own
    // handlers below, and everything else falls through to handleChange.
    if (native.inputType !== "insertText" && native.inputType !== "insertCompositionText") return;
    if (native.data == null) return;
    if (sanitizeNumeric(native.data, allowDecimal) === native.data) return;
    // A disallowed char (e.g. "." in integer mode, or a second ".") — reject.
    e.preventDefault();
  }

  // Replaces the current selection with `text`, stripped. Keeps the caret
  // just after what was inserted, so a paste in the middle of a number
  // doesn't send the cursor to the end.
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
    if (e.defaultPrevented) return;
    e.preventDefault();
    insertSanitized(e.currentTarget, e.clipboardData.getData("text"));
  }

  function handleDrop(e: React.DragEvent<HTMLInputElement>) {
    onDrop?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    // Inserted at the caret rather than under the pointer: the browser's own
    // drop caret isn't readable the same way in every engine, and landing a
    // dropped "12" at the caret is a far smaller surprise than letting
    // "1.5 kg" into a field that counts pieces.
    insertSanitized(e.currentTarget, e.dataTransfer.getData("text"));
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
      onPaste={handlePaste}
      onDrop={handleDrop}
      onChange={handleChange}
      {...props}
    />
  );
}

export { NumericInput };
