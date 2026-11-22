"use client";

import { forwardRef, type ChangeEvent, type JSX } from "react";
import { cn } from "@ui/lib/cn";

export interface PasscodeInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  // Fired once the last digit is typed, so the screen can check it without a submit button.
  readonly onComplete?: ((value: string) => void) | undefined;
  readonly length?: number | undefined;
  readonly label: string;
  readonly id?: string | undefined;
  readonly hasError?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
  readonly className?: string | undefined;
  readonly "data-testid"?: string | undefined;
}

const DEFAULT_LENGTH = 6;
const NON_DIGITS = /\D/g;

// One real input under a row of boxes: paste, the numeric keyboard and a screen reader all see a single field.
export const PasscodeInput = forwardRef<HTMLInputElement, PasscodeInputProps>(function PasscodeInput(
  {
    value,
    onChange,
    onComplete,
    length = DEFAULT_LENGTH,
    label,
    id,
    hasError = false,
    disabled = false,
    autoFocus = false,
    className,
    "data-testid": testId,
  },
  ref,
): JSX.Element {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(NON_DIGITS, "").slice(0, length);
    onChange(next);
    if (next.length === length && value.length !== length) {
      onComplete?.(next);
    }
  }

  return (
    <div
      dir="ltr"
      data-part="passcode-input"
      data-testid={testId}
      data-test-selector={testId}
      className={cn("group relative inline-flex gap-2", className)}
    >
      {Array.from({ length }, (_, index) => {
        const filled = index < value.length;
        const current = index === Math.min(value.length, length - 1);
        return (
          <span
            key={index}
            aria-hidden="true"
            data-part="passcode-box"
            className={cn(
              "flex size-11 items-center justify-center rounded-control border bg-surface transition-colors duration-150",
              disabled && "border-dashed border-line-strong",
              !disabled && hasError && "border-danger-600 shadow-field-error",
              !disabled && !hasError && "border-line-strong",
              !disabled && !hasError && current && "group-focus-within:border-primary-600",
            )}
          >
            {filled && <span className="size-2.5 rounded-pill bg-ink" />}
          </span>
        );
      })}
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={handleChange}
        aria-label={label}
        aria-invalid={hasError || undefined}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={length}
        disabled={disabled}
        autoFocus={autoFocus}
        data-testid={testId ? `${testId}-control` : undefined}
        data-test-selector={testId ? `${testId}-control` : undefined}
        className="absolute inset-0 size-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
});
