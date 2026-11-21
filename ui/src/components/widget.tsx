import type { JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface WidgetProps extends TestIdProps {
  readonly title?: ReactNode | undefined;
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
  readonly level?: 2 | 3 | undefined;
  readonly children: ReactNode;
}

export function Widget({
  title,
  action,
  className,
  level = 2,
  children,
  "data-testid": testId,
}: WidgetProps): JSX.Element {
  const part = parts("widget", testId);
  const Heading = level === 3 ? "h3" : "h2";

  return (
    <div
      {...part()}
      className={cn(
        "rounded-card border border-line bg-surface px-[18px] py-4 shadow-card",
        className,
      )}
    >
      {title !== undefined && (
        <div className="flex items-center justify-between gap-2 text-label font-semibold">
          <Heading {...part("title")} className="flex items-center gap-2">
            {title}
          </Heading>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
