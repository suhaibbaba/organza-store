import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { StatRow } from "@ui/components/stat-card";
import type { Column } from "@ui/components/table";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export function Skeleton({
  className,
  "data-testid": testId,
}: { readonly className?: string } & TestIdProps): JSX.Element {
  return (
    <span
      {...parts("skeleton", testId)()}
      aria-hidden="true"
      className={cn("skeleton block rounded-pill", className)}
    />
  );
}

export function SkeletonStatus(): JSX.Element {
  const { t } = useTranslation();

  return (
    <span role="status" className="sr-only">
      {t("ui.common.loading")}
    </span>
  );
}

export function RefreshBar({
  active,
  overlay = false,
}: {
  readonly active: boolean;
  readonly overlay?: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();

  if (!active) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={overlay ? "pointer-events-none absolute inset-x-0 top-0 z-10" : "px-4 pt-3"}
    >
      <span className="sr-only">{t("ui.common.updating")}</span>
      <Skeleton className="h-0.5 w-full rounded-none" />
    </div>
  );
}

const CELL_WIDTHS = ["w-28", "w-20", "w-32", "w-24"] as const;

const cellWidth = (index: number): string => CELL_WIDTHS[index % CELL_WIDTHS.length] ?? "w-24";

const endAligned = (align: Column<never>["align"]): boolean => align === "numeric" || align === "end";

export function SkeletonTable<TRow>({
  columns,
  rows = 5,
}: {
  readonly columns: readonly Column<TRow>[];
  readonly rows?: number;
}): JSX.Element {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {columns.map((column, index) => (
            <td key={column.key} className={cn("px-4 py-3 align-middle", column.className)}>
              <Skeleton className={cn("h-3", cellWidth(index + row), endAligned(column.align) && "ms-auto")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonTableCards<TRow>({
  columns,
  cards = 3,
}: {
  readonly columns: readonly Column<TRow>[];
  readonly cards?: number;
}): JSX.Element {
  const hasPrimary = columns.some((column) => column.primary === true);
  const details = columns.filter((column) => column.primary !== true && column.actions !== true).length;

  return (
    <>
      {Array.from({ length: cards }, (_, card) => (
        <div key={card} aria-hidden="true" className="border border-line rounded-card bg-surface p-4 shadow-card">
          {hasPrimary && <Skeleton className="mb-3 h-4 w-1/2" />}

          <div className="flex flex-col gap-3">
            {Array.from({ length: Math.max(details, 3) }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className={cn("h-3", cellWidth(row + card))} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function SkeletonCard({ count = 3 }: { readonly count?: number }): JSX.Element {
  return (
    <>
      {Array.from({ length: count }, (_, card) => (
        <div
          key={card}
          aria-hidden="true"
          className="flex flex-col border border-line rounded-card bg-surface p-4 shadow-card"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-field" />

            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-1/4" />
              <Skeleton className="mt-2 h-5 w-16" />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </>
  );
}

export function SkeletonKpi({ count = 3 }: { readonly count?: number }): JSX.Element {
  return (
    <StatRow cards={count}>
      <SkeletonStatus />

      {Array.from({ length: count }, (_, card) => (
        <div
          key={card}
          aria-hidden="true"
          className="rounded-card border border-line bg-surface p-[18px_20px] shadow-card"
        >
          <Skeleton className="h-(--control-h-sm) w-28 rounded-field" />
          <Skeleton className="mt-2 h-8 w-1/2" />
          <Skeleton className="mt-[7px] h-[18px] w-3/5" />
        </div>
      ))}
    </StatRow>
  );
}

export function SkeletonForm({ fields = 4 }: { readonly fields?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus />

      {Array.from({ length: fields }, (_, field) => (
        <div key={field} aria-hidden="true" className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-(--control-h) w-full rounded-control" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTimeline({ entries = 4 }: { readonly entries?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonStatus />

      {Array.from({ length: entries }, (_, entry) => (
        <div
          key={entry}
          aria-hidden="true"
          className="flex items-start gap-3 border border-line rounded-card bg-surface p-4 shadow-card"
        >
          <Skeleton className="size-9 shrink-0 rounded-field" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-20 shrink-0" />
            </div>
            <Skeleton className="mt-2 h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

const LINE_COUNTS = [4, 3, 5, 2, 4, 3, 5] as const;

const lineCount = (index: number): number => LINE_COUNTS[index % LINE_COUNTS.length] ?? 3;

function SkeletonLines({ count, tall = false }: { readonly count: number; readonly tall?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, line) => (
        <Skeleton key={line} className={cn("w-full rounded-panel", tall ? "h-(--control-h)" : "h-(--control-h-sm)")} />
      ))}
    </>
  );
}

export function SkeletonWeekRows({ days, rows = 2 }: { readonly days: number; readonly rows?: number }): JSX.Element {
  const columns = { gridTemplateColumns: `11rem repeat(${days}, minmax(10rem, 1fr))` };

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <SkeletonStatus />
      <div aria-hidden="true" className="grid" style={columns}>
        <span className="border-b border-line" />
        {Array.from({ length: days }, (_, day) => (
          <span key={day} className="flex flex-col gap-2 border-s border-b border-line px-3 py-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-24" />
          </span>
        ))}

        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="contents">
            <span className="flex flex-col gap-2 border-b border-line px-3 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-12" />
            </span>
            {Array.from({ length: days }, (_, day) => (
              <span key={day} className="flex flex-col gap-1.5 border-s border-b border-line p-2">
                <SkeletonLines count={lineCount(row + day)} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDayColumns({ columns = 2 }: { readonly columns?: number }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <SkeletonStatus />
      <div aria-hidden="true" className="flex min-w-max">
        {Array.from({ length: columns }, (_, column) => (
          <div key={column} className="flex min-w-60 flex-1 flex-col border-s border-line first:border-s-0">
            <span className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <Skeleton className="size-[26px]" />
              <Skeleton className="h-3.5 w-24" />
            </span>
            <span className="flex flex-col gap-1.5 p-2">
              <SkeletonLines count={lineCount(column) + 3} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonGroupedList({ groups = 2 }: { readonly groups?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus />
      {Array.from({ length: groups }, (_, group) => (
        <div
          key={group}
          aria-hidden="true"
          className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
        >
          <span className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Skeleton className="size-[26px]" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="ms-auto h-3 w-10" />
          </span>
          <span className="flex flex-col gap-1.5 p-2">
            <SkeletonLines count={lineCount(group)} tall />
          </span>
        </div>
      ))}
    </div>
  );
}
