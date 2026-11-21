import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";
import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export type BadgeVariant = BadgeTone | "wash";

const TONES: Record<BadgeVariant, string> = {
  neutral: "bg-sunken text-ink-muted",
  success: "bg-success-100 text-success-900",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-600",
  info: "bg-primary-100 text-primary-600",
  wash: "tag-wash text-primary-900",
};

const PILL_BOX = cn(
  "inline-flex items-center h-(--control-h-sm) gap-2 whitespace-nowrap rounded-pill px-3",
  "text-label font-normal",
);

export const PILL_BASE = cn("pill-text", PILL_BOX);

export interface BadgeProps extends TestIdProps {
  readonly tone?: BadgeVariant | undefined;
  readonly plain?: boolean | undefined;
  readonly icon?: IconName | undefined;
  readonly lines?: 1 | 2 | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Badge({
  tone = "neutral",
  plain = false,
  icon,
  lines = 1,
  className,
  children,
  "data-testid": testId,
}: BadgeProps): JSX.Element {
  const part = parts("badge", testId);
  const wraps = lines === 2;

  return (
    <span
      {...part()}
      className={cn(
        wraps ? PILL_BOX : PILL_BASE,
        "min-w-0",
        wraps &&
          "h-auto min-h-(--control-h-sm) whitespace-normal py-1 rounded-[calc(var(--control-h-sm)/2)]",
        TONES[tone],
        className,
      )}
    >
      {icon !== undefined && <Icon name={icon} className="size-3.5 shrink-0" />}
      {!plain && icon === undefined && (
        <span
          {...part("dot")}
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-pill bg-current"
        />
      )}
      <span {...part("label")} className={cn("min-w-0", wraps ? "line-clamp-2" : "truncate")}>
        {children}
      </span>
    </span>
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement>, TestIdProps {
  readonly selected?: boolean | undefined;
  readonly children: ReactNode;
}

export function Chip({
  selected = false,
  className,
  children,
  type = "button",
  "data-testid": testId,
  ...props
}: ChipProps): JSX.Element {
  const disabled = props.disabled === true;

  return (
    <button
      type={type}
      {...parts("chip", testId)()}
      aria-pressed={selected}
      className={cn(
        PILL_BASE,
        "h-(--control-h) shrink-0 cursor-pointer border-[1.5px]",
        "transition-[background-color,border-color,color] duration-[250ms] ease-in-out",
        disabled && "cursor-not-allowed border-transparent bg-inset text-ink-faint",
        !disabled &&
          (selected
            ? "border-primary-600 bg-primary-100 text-primary-700"
            : "border-line-strong bg-surface text-ink-muted hover:bg-inset hover:border-neutral-400 hover:text-ink"),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
