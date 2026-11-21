import { cleanTypedNumber } from "@ui/lib/support";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import {
  FIELD_TEXT,
  FIELD_TEXT_OVERLAID,
  FieldClear,
  FieldDivider,
  FieldIcon,
  FieldLock,
  FieldText,
  fieldShell,
} from "@ui/components/field";
import type { IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, TestIdProps {
  hasError?: boolean | undefined;
  adornment?: IconName | undefined;
  onClear?: (() => void) | undefined;
  clearLabel?: string | undefined;
  leading?: ReactNode | undefined;
  suffix?: ReactNode | undefined;
  "data-part"?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    hasError = false,
    adornment,
    onClear,
    clearLabel,
    leading,
    suffix,
    "data-part": part = "input",
    "data-testid": testId,
    onChange,
    ...props
  },
  ref,
) {
  const disabled = props.disabled === true;
  const clearable = onClear !== undefined && !disabled && String(props.value ?? "") !== "";

  return (
    <div
      data-part={part}
      {...testid(testId)}
      className={cn(fieldShell({ hasError, disabled }), className)}
    >
      {adornment !== undefined && (
        <FieldIcon
          name={adornment}
          hasError={hasError}
          disabled={disabled}
          {...testid(testId, "icon")}
        />
      )}
      {adornment !== undefined && <FieldDivider />}

      {leading}
      {leading !== undefined && <FieldDivider />}

      <FieldText placeholder={props.placeholder} dir={props.dir}>
        <input
          ref={ref}
          data-part="input-control"
          {...testid(testId, "control")}
          aria-invalid={hasError || undefined}
          className={cn(
            FIELD_TEXT,
            FIELD_TEXT_OVERLAID,
            "page-rtl:text-right page-ltr:text-left",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
            "[&::-webkit-calendar-picker-indicator]:opacity-60",
            "[&::-webkit-calendar-picker-indicator]:transition-opacity",
            "[&::-webkit-calendar-picker-indicator]:duration-150",
            "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          )}
          {...props}
          onChange={(event) => {
            const cleaned = cleanTypedNumber(event.target.value, props.inputMode);

            if (cleaned !== event.target.value) {
              event.target.value = cleaned;
            }

            onChange?.(event);
          }}
        />
      </FieldText>

      {clearable && clearLabel !== undefined && (
        <FieldClear label={clearLabel} onClear={onClear} {...testid(testId, "clear")} />
      )}

      {suffix !== undefined && <FieldDivider />}
      {suffix !== undefined && (
        <span
          data-part="input-suffix"
          {...testid(testId, "suffix")}
          className="shrink-0 text-value text-ink-muted"
        >
          {suffix}
        </span>
      )}

      {disabled && <FieldLock {...testid(testId, "lock")} />}
    </div>
  );
});
