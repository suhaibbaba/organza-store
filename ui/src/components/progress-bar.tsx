import type { JSX } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type ProgressTone = "primary" | "success" | "warning" | "danger";

const TONES: Record<ProgressTone, string> = {
  primary: "bg-primary-600",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

export interface ProgressBarProps extends TestIdProps {
  readonly value: number;
  readonly total: number;
  readonly label: string;
  readonly tone?: ProgressTone | undefined;
  readonly className?: string | undefined;
}

export function ProgressBar({
  value,
  total,
  label,
  tone = "primary",
  className,
  "data-testid": testId,
}: ProgressBarProps): JSX.Element {
  const part = parts("progress-bar", testId);
  const safeTotal = Math.max(total, 0);
  const done = Math.min(Math.max(value, 0), safeTotal);
  const percent = safeTotal === 0 ? 0 : (done / safeTotal) * 100;

  return (
    <div
      {...part()}
      role="progressbar"
      aria-label={label}
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      className={cn("h-1.5 w-full overflow-hidden rounded-pill bg-inset", className)}
    >
      <div
        {...part("fill")}
        className={cn("h-full rounded-pill transition-[width] duration-500", TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
