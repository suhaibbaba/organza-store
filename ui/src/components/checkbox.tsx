import { useEffect, useRef, type JSX } from "react";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface CheckboxProps extends TestIdProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label: string;
  readonly hideLabel?: boolean | undefined;
  readonly indeterminate?: boolean | undefined;
  readonly id?: string | undefined;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  hideLabel = false,
  indeterminate = false,
  id,
  "data-testid": testId,
}: CheckboxProps): JSX.Element {
  const part = parts("checkbox", testId);
  const input = useRef<HTMLInputElement>(null);
  const marked = checked || indeterminate;

  useEffect(() => {
    if (input.current) {
      input.current.indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  return (
    <label
      {...part()}
      className="flex w-fit min-h-(--control-h-sm) cursor-pointer items-center gap-2.5 select-none"
    >
      <span className="relative grid size-5 shrink-0 place-items-center">
        <input
          ref={input}
          id={id}
          type="checkbox"
          {...part("input")}
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-chip"
        />
        <span
          aria-hidden="true"
          {...part("box")}
          className={cn(
            "pointer-events-none grid size-5 place-items-center rounded-chip border-[1.5px]",
            "transition-colors duration-150",
            marked
              ? "border-primary-600 bg-primary-600 text-ink-inverse"
              : "border-neutral-500 bg-surface",
          )}
        >
          {checked ? (
            <Icon name="check" className="size-3.5" />
          ) : (
            indeterminate && <span className="h-0.5 w-2.5 rounded-pill bg-current" />
          )}
        </span>
      </span>
      <span {...part("label")} className={cn("text-value text-ink", hideLabel && "sr-only")}>
        {label}
      </span>
    </label>
  );
}
