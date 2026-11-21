import { Children, type JSX, type ReactNode } from "react";
import { Badge } from "@ui/components/badge";
import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { Ltr } from "@ui/components/ltr";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type StatTone = "primary" | "success" | "warning" | "danger" | "neutral";
export type DeltaDirection = "up" | "down";

const FIGURES: Record<StatTone, string> = {
  primary: "text-ink",
  success: "text-success-900",
  warning: "text-warning-700",
  danger: "text-danger-600",
  neutral: "text-ink",
};

export interface StatCardProps extends TestIdProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly icon?: IconName | undefined;
  readonly tone?: StatTone | undefined;
  readonly caption?: string | undefined;
  readonly delta?:
    | {
        readonly text: string;
        readonly direction: DeltaDirection;
        readonly isGood: boolean;
      }
    | undefined;
  readonly className?: string | undefined;
}

export function StatCard({
  label,
  value,
  icon,
  tone = "primary",
  caption,
  delta,
  className,
  "data-testid": testId,
}: StatCardProps): JSX.Element {
  const part = parts("stat-card", testId);

  return (
    <div
      {...part()}
      className={cn(
        "h-full min-w-0 rounded-card border border-line bg-surface p-[18px_20px] shadow-card",
        "transition duration-[250ms] ease-in-out hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <div className="flex min-h-[26px] items-center justify-between gap-2">
        <Badge tone="wash" icon={icon} lines={2} className="text-micro" {...part("label")}>
          {label}
        </Badge>
      </div>

      <Ltr
        as="p"
        {...part("figure")}
        className={cn("mt-2 whitespace-normal break-words text-title font-medium", FIGURES[tone])}
      >
        {value}
      </Ltr>

      {(caption !== undefined || delta !== undefined) && (
        <div className="mt-[7px] flex flex-wrap items-center gap-x-2">
          {delta !== undefined && (
            <span
              {...part("delta")}
              className={cn(
                "pill-text inline-flex items-center gap-1 text-meta font-medium",
                delta.isGood ? "text-success-700" : "text-danger-700",
              )}
            >
              <Icon
                name={delta.direction === "up" ? "trend-up" : "trend-down"}
                className="size-3.5"
              />
              {delta.text}
            </span>
          )}
          {caption !== undefined && (
            <span {...part("caption")} className="min-w-0 line-clamp-2 text-meta text-ink-subtle">
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const WIDE_COLUMNS: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
};

export function StatRow({
  children,
  cards,
  "data-testid": testId,
}: {
  readonly children: ReactNode;
  readonly cards?: number | undefined;
} & TestIdProps): JSX.Element {
  const count = cards ?? Children.count(children);

  return (
    <div
      {...parts("stat-row", testId)()}
      className={cn("mb-5 grid grid-cols-2 gap-3", WIDE_COLUMNS[count] ?? "xl:grid-cols-4")}
    >
      {children}
    </div>
  );
}
