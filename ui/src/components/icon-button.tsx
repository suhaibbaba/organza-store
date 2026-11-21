import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type IconButtonTone = "neutral" | "danger";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">, TestIdProps {
  label: string;
  icon: ReactNode;
  tone?: IconButtonTone | undefined;
}

// A bare icon (no box, no padding) for row tools like delete; focus darkens the icon, never an outline.
const TONES: Record<IconButtonTone, string> = {
  neutral: "text-ink-muted hover:text-ink focus-visible:bg-neutral-200 focus-visible:text-ink",
  danger: "text-danger-600 hover:text-danger-700 focus-visible:bg-danger-100 focus-visible:text-danger-800",
};

export function IconButton({
  label,
  icon,
  tone = "neutral",
  type = "button",
  className,
  "data-testid": testId,
  ...props
}: IconButtonProps): JSX.Element {
  return (
    <button
      type={type}
      {...parts("icon-button", testId)()}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-chip transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
