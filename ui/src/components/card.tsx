import type { HTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type CardTone = "default" | "selected";

export interface CardProps extends HTMLAttributes<HTMLDivElement>, TestIdProps {
  readonly tone?: CardTone | undefined;
  readonly flush?: boolean | undefined;
  readonly interactive?: boolean | undefined;
  readonly children: ReactNode;
}

export function Card({
  tone = "default",
  flush = false,
  interactive = false,
  className,
  children,
  "data-testid": testId,
  ...props
}: CardProps): JSX.Element {
  return (
    <div
      {...parts("card", testId)()}
      className={cn(
        "rounded-card border border-line bg-surface shadow-card",
        "transition duration-[250ms] ease-in-out",
        !flush && "p-[18px_20px]",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover",
        tone === "selected" && "bg-selected outline outline-offset-[-1px] outline-selected-line",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
