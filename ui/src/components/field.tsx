import type { JSX, ReactNode } from "react";
import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface FieldState {
  readonly hasError?: boolean | undefined;
  readonly disabled?: boolean | undefined;
}

export function fieldShell({ hasError = false, disabled = false }: FieldState): string {
  return cn(
    "group flex w-full items-center gap-2 rounded-control border px-3.5",
    "h-(--control-h) transition-[border-color,box-shadow,background-color] duration-150",
    disabled && "cursor-not-allowed border-dashed border-line-strong bg-surface",
    !disabled && "bg-surface",
    !disabled && hasError && "border-danger-600 shadow-field-error",
    !disabled &&
      !hasError &&
      "border-line-strong hover:border-neutral-400 focus-within:border-primary-600",
  );
}

export function FieldDivider(): JSX.Element {
  return (
    <span data-part="field-divider" aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
  );
}

export const FIELD_TEXT = cn(
  "min-w-0 flex-1 self-stretch truncate border-none bg-transparent p-0 text-field text-ink outline-none",
  "[unicode-bidi:plaintext]",
  "placeholder:text-ink-subtle",
  "disabled:cursor-not-allowed disabled:text-ink-faint",
);

export const FIELD_TEXT_OVERLAID = "peer placeholder:text-transparent";

export function FieldText({
  placeholder,
  dir,
  children,
}: {
  readonly placeholder?: string | undefined;
  readonly dir?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <span data-part="field-text" className="relative flex min-w-0 flex-1 self-stretch">
      {children}
      {placeholder !== undefined && placeholder !== "" && (
        <span
          aria-hidden="true"
          data-part="field-placeholder"
          dir={dir}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 truncate",
            "page-rtl:text-right page-ltr:text-left text-field text-ink-subtle [unicode-bidi:plaintext]",
            "peer-placeholder-shown:block",
          )}
        >
          {placeholder}
        </span>
      )}
    </span>
  );
}

export interface FieldIconProps extends FieldState, TestIdProps {
  readonly name: IconName;
}

export function FieldIcon({
  name,
  hasError = false,
  disabled = false,
  "data-testid": testId,
}: FieldIconProps): JSX.Element {
  return (
    <Icon
      name={name}
      data-part="field-icon"
      {...testid(testId)}
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 transition-colors duration-150",
        hasError ? "text-danger-600" : "text-ink-faint",
        !disabled && !hasError && "group-focus-within:text-primary-600",
      )}
    />
  );
}

export const FIELD_BUTTON = cn(
  "inline-grid size-6 shrink-0 cursor-pointer place-items-center rounded-chip",
  "text-ink-faint transition-colors duration-150 hover:bg-inset hover:text-ink",
);

export function FieldLock({ "data-testid": testId }: TestIdProps = {}): JSX.Element {
  return (
    <Icon
      name="lock"
      data-part="field-lock"
      {...testid(testId)}
      aria-hidden="true"
      className="size-4 shrink-0 text-ink-faint"
    />
  );
}

export interface FieldClearProps extends TestIdProps {
  readonly label: string;
  readonly onClear: () => void;
}

export function FieldClear({
  label,
  onClear,
  "data-testid": testId,
}: FieldClearProps): JSX.Element {
  return (
    <button
      type="button"
      data-part="field-clear"
      {...testid(testId)}
      aria-label={label}
      onClick={onClear}
      className={cn(
        "inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-pill",
        "text-ink-faint transition-colors duration-150 hover:bg-inset hover:text-ink",
      )}
    >
      <Icon name="x" className="size-3.5" />
    </button>
  );
}
