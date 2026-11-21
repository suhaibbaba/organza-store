import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId, type JSX } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface SwitchProps extends TestIdProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hideLabel?: boolean | undefined;
  disabled?: boolean | undefined;
  "aria-disabled"?: boolean | undefined;
  id?: string | undefined;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  hideLabel = false,
  disabled = false,
  "aria-disabled": unavailable = false,
  id,
  "data-testid": testId,
}: SwitchProps): JSX.Element {
  const part = parts("switch", testId);
  const labelId = useId();

  const track = (
    <SwitchPrimitive.Root
      {...part()}
      id={id}
      checked={checked}
      onCheckedChange={(next) => {
        if (!unavailable) {
          onCheckedChange(next);
        }
      }}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      {...(hideLabel ? { "aria-label": label } : { "aria-labelledby": labelId })}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full",
        "transition-colors duration-150",
        "after:absolute after:inset-x-0 after:top-1/2 after:h-(--control-h) after:-translate-y-1/2",
        'after:content-[""] lg:after:hidden',
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        checked ? "bg-primary-600" : "bg-neutral-500",
      )}
    >
      <SwitchPrimitive.Thumb
        {...part("thumb")}
        className={cn(
          "block size-5 rounded-full bg-surface shadow-pill transition-transform",
          "absolute top-0.5 start-0.5",
          checked ? "rtl:-translate-x-5 ltr:translate-x-5" : "translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (hideLabel) {
    return track;
  }

  return (
    <span {...part("row")} className="inline-flex items-center gap-2.5">
      {track}
      <span
        id={labelId}
        {...part("label")}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          "select-none text-value text-ink",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
      >
        {label}
      </span>
    </span>
  );
}
