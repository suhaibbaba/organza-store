import type { JSX } from "react";
import { cn } from "@ui/lib/cn";
import { rovingKeyDown, rovingStop } from "@ui/lib/roving-focus";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface RadioOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly description?: string | undefined;
}

export interface RadioGroupProps<TValue extends string> extends TestIdProps {
  readonly options: readonly RadioOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly label: string;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function RadioGroup<TValue extends string>({
  options,
  value,
  onChange,
  label,
  id,
  className,
  "data-testid": testId,
}: RadioGroupProps<TValue>): JSX.Element {
  const values = options.map((option) => option.value);
  const stop = rovingStop(values, value);

  return (
    <div
      id={id}
      data-part="radio-group"
      {...testid(testId)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => rovingKeyDown(event, values, value, onChange)}
      className={cn("flex flex-col gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            data-part="radio"
            {...testid(testId, option.value)}
            role="radio"
            aria-checked={isSelected}
            tabIndex={option.value === stop ? 0 : -1}
            data-roving
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-(--control-h) cursor-pointer items-center gap-3 rounded-panel border px-3 py-2 text-start",
              "transition-[background-color,border-color] duration-[250ms] ease-in-out",
              isSelected
                ? "border-primary-600 bg-selected"
                : "border-line bg-surface hover:border-line-strong hover:bg-inset",
            )}
          >
            <span
              data-part="radio-mark"
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                isSelected ? "border-primary-600" : "border-neutral-500",
              )}
            >
              {isSelected && <span className="size-2 rounded-full bg-primary-600" />}
            </span>
            <span className="flex flex-col">
              <span className="text-label font-medium text-ink">{option.label}</span>
              {option.description && (
                <span className="text-meta text-ink-muted">{option.description}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
