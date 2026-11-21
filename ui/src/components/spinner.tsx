import type { JSX } from "react";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface SpinnerProps extends TestIdProps {
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

export function Spinner({ label, className, "data-testid": testId }: SpinnerProps): JSX.Element {
  const part = parts("spinner", testId);

  return (
    <span {...part()} role={label === undefined ? undefined : "status"} className="inline-flex">
      <Icon name="spinner" className={cn("size-4 animate-spin text-ink-muted", className)} />
      {label !== undefined && <span className="sr-only">{label}</span>}
    </span>
  );
}
