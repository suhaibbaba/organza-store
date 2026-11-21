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
  readonly size?: "sm" | "md" | undefined;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  hideLabel = false,
  indeterminate = false,
  id,
  size = "md",
  "data-testid": testId,
}: CheckboxProps): JSX.Element {
  const part = parts("checkbox", testId);
  const input = useRef<HTMLInputElement>(null);
  const marked = checked || indeterminate;
  const small = size === "sm";

  useEffect(() => {
    if (input.current) {
      input.current.indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  return (
    <label
      {...part()}
      className={cn("flex w-fit cursor-pointer items-center select-none", small ? "gap-1.5" : "min-h-(--control-h-sm) gap-2.5")}
    >
      <span className={cn("relative grid shrink-0 place-items-center", small ? "size-4" : "size-5")}>
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
            "pointer-events-none grid place-items-center rounded-chip border-[1.5px]",
            small ? "size-4" : "size-5",
            "transition-colors duration-150",
            marked
              ? "border-primary-600 bg-primary-600 text-ink-inverse peer-focus-visible:border-primary-900 peer-focus-visible:bg-primary-900"
              : "border-neutral-500 bg-surface peer-focus-visible:border-primary-800 peer-focus-visible:bg-neutral-200",
          )}
        >
          {checked ? (
            <Icon name="check" className={small ? "size-3" : "size-3.5"} />
          ) : (
            indeterminate && <span className={cn("h-0.5 rounded-pill bg-current", small ? "w-2" : "w-2.5")} />
          )}
        </span>
      </span>
      <span {...part("label")} className={cn(small ? "text-label" : "text-value", "text-ink", hideLabel && "sr-only")}>
        {label}
      </span>
    </label>
  );
}
