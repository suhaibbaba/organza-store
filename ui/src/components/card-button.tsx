import type { ButtonHTMLAttributes, JSX } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface CardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, TestIdProps {
  selected?: boolean | undefined;
}

// A whole card as one tap target (a product tile, a variant to pick); focus darkens the edge, never an outline.
export function CardButton({
  selected = false,
  type = "button",
  className,
  "data-testid": testId,
  ...props
}: CardButtonProps): JSX.Element {
  return (
    <button
      type={type}
      {...parts("card-button", testId)()}
      aria-pressed={selected || undefined}
      className={cn(
        "group flex w-full cursor-pointer rounded-panel border bg-surface text-start transition-colors",
        selected
          ? "border-selected-line bg-selected"
          : "border-line not-disabled:hover:border-primary-300 not-disabled:hover:bg-row-hover",
        "focus-visible:border-primary-600 focus-visible:bg-inset",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
