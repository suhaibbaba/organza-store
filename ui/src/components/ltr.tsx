import type { JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface LtrProps extends TestIdProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly "data-part"?: string | undefined;
  readonly as?: "span" | "dd" | "p" | "div" | "a" | undefined;
  readonly href?: string | undefined;
  readonly title?: string | undefined;
}

export function Ltr({
  children,
  className,
  as = "span",
  href,
  title,
  "data-part": part = "ltr",
  "data-testid": testId,
}: LtrProps): JSX.Element {
  const Tag = as;

  return (
    <Tag
      dir="ltr"
      data-part={part}
      {...testid(testId)}
      className={cn("inline-block w-fit max-w-full whitespace-nowrap", className)}
      {...(href !== undefined && { href })}
      {...(title !== undefined && { title })}
    >
      {children}
    </Tag>
  );
}
