import type { ButtonHTMLAttributes, JSX, ReactNode, Ref } from "react";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type PartAttrs, type TestIdProps } from "@ui/lib/testid";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, TestIdProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  isLoading?: boolean | undefined;
  icon?: ReactNode | undefined;
  iconPosition?: "start" | "end" | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 text-ink-inverse hover:bg-primary-700 active:bg-primary-800",
  secondary:
    "border border-line bg-surface text-ink hover:bg-inset hover:border-primary-600 hover:text-primary-700 active:bg-neutral-200",
  ghost: "bg-primary-100 text-primary-700 hover:bg-primary-200 active:bg-primary-300",
  quiet: "text-ink-muted hover:bg-inset hover:text-ink active:bg-neutral-200",
  danger: "bg-danger-600 text-ink-inverse hover:bg-danger-700 active:bg-danger-800",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-(--control-h) min-w-(--control-h) gap-2 px-3 text-label lg:h-(--control-h-sm) lg:min-h-0 lg:min-w-(--control-h-sm)",
  md: "h-(--control-h) min-w-(--control-h) gap-2 px-3.5 text-label",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  iconPosition = "start",
  className,
  disabled,
  children,
  type = "button",
  onClick,
  "data-testid": testId,
  "aria-disabled": unavailable,
  ...props
}: ButtonProps): JSX.Element {
  const part = parts("button", testId);
  const inert = disabled === true || isLoading;

  return (
    <button
      type={type}
      {...part()}
      className={cn(
        "pill-text inline-flex items-center cursor-pointer justify-center rounded-control font-medium",
        "whitespace-nowrap",
        "[transition:background-color_250ms_ease-in-out,border-color_250ms_ease-in-out,color_250ms_ease-in-out,scale_120ms_ease-out]",
        "active:scale-[0.98]",
        "aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-inset",
        "aria-disabled:text-ink-subtle aria-disabled:shadow-none",
        "aria-disabled:active:scale-100 aria-disabled:hover:bg-inset aria-disabled:hover:text-ink-subtle",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      aria-disabled={inert || unavailable === true || unavailable === "true" || undefined}
      aria-busy={isLoading || undefined}
      {...props}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onClick?.(event);
      }}
    >
      {isLoading && iconPosition === "start" && <Spinner {...part("spinner")} />}
      {!isLoading && iconPosition === "start" && icon}
      {children}
      {isLoading && iconPosition === "end" && <Spinner {...part("spinner")} />}
      {!isLoading && iconPosition === "end" && icon}
    </button>
  );
}

function Spinner(attrs: PartAttrs): JSX.Element {
  return <Icon {...attrs} name="spinner" className="animate-spin" />;
}
