import type { JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type SummaryEmphasis = "item" | "subtotal" | "total";

export interface SummaryRow {
  readonly key: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly emphasis?: SummaryEmphasis | undefined;
  readonly deduct?: boolean | undefined;
  readonly aside?: ReactNode | undefined;
}

export interface SummaryProps extends TestIdProps {
  readonly rows: readonly SummaryRow[];
  readonly divided?: boolean | undefined;
  readonly className?: string | undefined;
}

const ROW: Record<SummaryEmphasis, string> = {
  item: "py-1.5 text-label",
  subtotal: "mt-1 border-t border-line pt-2.5 pb-1.5 text-label font-semibold",
  total:
    "mt-2 rounded-panel border border-primary-100 bg-selected px-3 py-2.5 text-value font-semibold text-primary-800",
};

const LABEL: Record<SummaryEmphasis, string> = {
  item: "text-ink-muted",
  subtotal: "text-ink",
  total: "",
};

const VALUE: Record<SummaryEmphasis, string> = {
  item: "text-ink",
  subtotal: "text-ink",
  total: "text-heading",
};

export function Summary({
  rows,
  divided = false,
  className,
  "data-testid": testId,
}: SummaryProps): JSX.Element {
  const part = parts("summary", testId);

  return (
    <dl {...part()} className={cn("flex flex-col", divided && "divide-y divide-line", className)}>
      {rows.map((row) => {
        const emphasis = row.emphasis ?? "item";

        return (
          <div
            key={row.key}
            {...part(`row-${row.key}`)}
            data-emphasis={emphasis}
            className={cn(
              "flex items-baseline justify-between gap-3",
              ROW[emphasis],
              emphasis === "total" && rows.length > 1 && "-mx-3",
            )}
          >
            <dt className={cn("flex min-w-0 items-baseline gap-2", LABEL[emphasis])}>
              {row.label}
              {row.aside}
            </dt>
            <dd className={cn("min-w-0 text-end tabular-nums", VALUE[emphasis])}>
              {row.deduct && (
                <span aria-hidden className="me-1 text-ink-muted">
                  −
                </span>
              )}
              {row.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
