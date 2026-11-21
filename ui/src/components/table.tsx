import { foldDigits } from "@ui/lib/support";
import { useEffect, useState, type JSX, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon, type IconName } from "@ui/components/icon";
import { Ltr } from "@ui/components/ltr";
import { Select } from "@ui/components/select";
import {
  RefreshBar,
  SkeletonStatus,
  SkeletonTable,
  SkeletonTableCards,
} from "@ui/components/skeleton";
import { FIELD_TEXT, fieldShell } from "@ui/components/field";
import { cn } from "@ui/lib/cn";
import { useDelayedLoading } from "@ui/lib/use-delayed-loading";
import { useIsMobile } from "@ui/lib/use-media-query";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface Column<TRow> {
  readonly key: string;
  readonly header: string;
  readonly icon?: IconName | undefined;
  readonly render: (row: TRow) => ReactNode;
  readonly className?: string | undefined;
  readonly hideOnMobile?: boolean | undefined;
  readonly hideOnDesktop?: boolean | undefined;
  readonly primary?: boolean | undefined;
  readonly actions?: boolean | undefined;
  readonly besideTitleOnMobile?: boolean | undefined;
  readonly align?: "start" | "end" | "numeric" | undefined;
  readonly sortKey?: string | undefined;
}

export interface TableSort {
  readonly key: string | null;
  readonly dir: "asc" | "desc";
  readonly onChange: (key: string | null, dir: "asc" | "desc") => void;
}

export interface TableProps<TRow> extends TestIdProps {
  columns: readonly Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean | undefined;
  isRefreshing?: boolean | undefined;
  empty?: ReactNode | undefined;
  pagination?: PaginationProps | undefined;
  onRowClick?: ((row: TRow) => void) | undefined;
  rowLabel?: ((row: TRow) => string) | undefined;
  header?: ReactNode | undefined;
  density?: "default" | "compact" | undefined;
  sort?: TableSort | undefined;
}

export interface PaginationProps extends TestIdProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  perPage?: number | undefined;
  perPageOptions?: readonly number[] | undefined;
  onPerPageChange?: ((perPage: number) => void) | undefined;
  className?: string | undefined;
}

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export const DEFAULT_PER_PAGE = 10;

const alignClass = (align: Column<never>["align"]): string =>
  align === "numeric" ? "text-end tabular-nums" : align === "end" ? "text-end" : "text-start";

const cardAlignClass = (align: Column<never>["align"]): string =>
  align === "numeric" ? "text-start tabular-nums" : "text-start";

export function Table<TRow>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  isRefreshing = false,
  empty,
  pagination,
  onRowClick,
  rowLabel,
  header,
  density = "default",
  sort,
  "data-testid": testId,
}: TableProps<TRow>): JSX.Element {
  const { t } = useTranslation();
  const compact = density === "compact";
  const isMobile = useIsMobile() && !compact;
  const showSkeleton = useDelayedLoading(isLoading);
  const showRows = !isLoading && !showSkeleton;

  const rowId = (row: TRow): string | undefined =>
    testId === undefined ? undefined : `${testId}-row-${rowKey(row)}`;

  if (!isLoading && rows.length === 0 && empty !== undefined) {
    return (
      <>
        {header !== undefined && <PanelHead {...testid(testId, "header")}>{header}</PanelHead>}
        {empty}
      </>
    );
  }

  const wideColumns = columns.filter((column) => column.hideOnDesktop !== true);
  const mobileColumns = columns.filter((column) => column.hideOnMobile !== true);
  const primary = mobileColumns.find((column) => column.primary === true);
  const actions = mobileColumns.find((column) => column.actions === true);
  const detail = mobileColumns.filter(
    (column) => column.primary !== true && column.actions !== true,
  );

  if (isMobile) {
    return (
      <>
        {header !== undefined && <PanelHead {...testid(testId, "header")}>{header}</PanelHead>}

        <div data-part="table-cards" {...testid(testId)} className="relative flex flex-col gap-3">
          <RefreshBar active={isRefreshing} overlay />

          {showSkeleton && (
            <>
              <SkeletonStatus />
              <SkeletonTableCards columns={mobileColumns} />
            </>
          )}

          {showRows &&
            rows.map((row) => {
              const rowActions = actions?.render(row) ?? null;

              const shown = detail.filter((column) => {
                const value = column.render(row);
                return value !== null && value !== undefined && value !== false && value !== "";
              });

              const actionsInTitle = actions?.besideTitleOnMobile === true && primary !== undefined;

              const body = (
                <>
                  {primary && (
                    <div className={cn("flex items-center justify-between gap-3", shown.length > 0 && "mb-3")}>
                      <div
                        data-part="table-card-title"
                        {...testid(rowId(row), "title")}
                        className="min-w-0 flex-1 text-value font-medium text-ink"
                      >
                        {primary.render(row)}
                      </div>
                      {actionsInTitle && rowActions !== null && (
                        <div
                          data-part="table-row-actions"
                          {...testid(rowId(row), "actions")}
                          className="relative z-10 shrink-0"
                        >
                          {rowActions}
                        </div>
                      )}
                    </div>
                  )}

                  <dl
                    data-part="table-card-meta"
                    {...testid(rowId(row), "meta")}
                    className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)]"
                  >
                    {shown.map((column, index) => (
                      <div key={column.key} className="contents">
                        <dt
                          data-part="table-card-label"
                          {...testid(rowId(row), `${column.key}-label`)}
                          className={cn(
                            "py-2.5 pe-4 text-start text-label text-ink-muted",
                            "leading-value",
                            index > 0 && "border-t border-line",
                          )}
                        >
                          {column.icon === undefined ? (
                            t(column.header)
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Icon name={column.icon} className="size-4 shrink-0" />
                              {t(column.header)}
                            </span>
                          )}
                        </dt>
                        <dd
                          data-part="table-card-value"
                          {...testid(rowId(row), column.key)}
                          className={cn(
                            "min-w-0 py-2.5 text-value text-ink",
                            cardAlignClass(column.align),
                            index > 0 && "border-t border-line",
                          )}
                        >
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {rowActions !== null && !actionsInTitle && (
                    <div
                      data-part="table-row-actions"
                      {...testid(rowId(row), "actions")}
                      className={cn(
                        "relative z-10 mt-3 flex flex-wrap items-center justify-end gap-2",
                        "border-t border-line pt-3",
                      )}
                    >
                      {rowActions}
                    </div>
                  )}
                </>
              );

              const cardClass =
                "border border-line rounded-card bg-surface p-4 text-start shadow-card transition duration-[250ms] ease-in-out";

              return onRowClick === undefined ? (
                <div
                  key={rowKey(row)}
                  data-row
                  data-part="table-card"
                  {...testid(rowId(row))}
                  className={cardClass}
                >
                  {body}
                </div>
              ) : (
                <div
                  key={rowKey(row)}
                  data-row
                  data-part="table-card"
                  {...testid(rowId(row))}
                  className={cn(cardClass, "relative")}
                >
                  <button
                    type="button"
                    data-part="table-card-overlay"
                    {...testid(rowId(row), "open")}
                    onClick={() => onRowClick(row)}
                    {...(rowLabel && { "aria-label": rowLabel(row) })}
                    className="absolute inset-0 z-0 cursor-pointer rounded-card"
                  />
                  {body}
                </div>
              );
            })}
        </div>

        {pagination !== undefined && (
          <div
            data-part="table-pagination"
            {...testid(testId, "pagination")}
            className="mt-3 overflow-hidden border border-line rounded-card bg-surface shadow-card"
          >
            <Pagination
              {...pagination}
              className="border-t-0"
              {...testid(testId, "pagination-nav")}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <div
      data-part="table"
      data-density={density}
      {...testid(testId)}
      className={cn(
        "relative overflow-hidden bg-surface",
        !compact && "border border-line rounded-card shadow-card",
      )}
    >
      {header !== undefined && (
        <div
          data-part="table-header"
          {...testid(testId, "header")}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]"
        >
          {header}
        </div>
      )}

      {showSkeleton && <SkeletonStatus />}
      <RefreshBar active={isRefreshing} overlay />

      <div data-part="table-scroll" {...testid(testId, "scroll")} className="overflow-x-auto">
        <table className="w-full border-collapse text-value">
          <thead>
            <tr>
              {wideColumns.map((column) => (
                <th
                  key={column.key}
                  data-part="table-head-cell"
                  {...testid(testId, `head-${column.key}`)}
                  scope="col"
                  {...(column.sortKey !== undefined &&
                    sort !== undefined && {
                      "aria-sort":
                        sort.key === column.sortKey
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none",
                    })}
                  className={cn(
                    "whitespace-nowrap border-b border-line bg-table-head",
                    compact ? "sticky top-0 h-(--control-h-sm) px-3" : "px-[18px] py-[13px]",
                    "text-micro font-medium text-ink-muted",
                    alignClass(column.align),
                    column.className,
                  )}
                >
                  {column.sortKey !== undefined && sort !== undefined ? (
                    <SortButton
                      label={t(column.header)}
                      columnKey={column.sortKey}
                      sort={sort}
                      {...testid(testId, `sort-${column.key}`)}
                    />
                  ) : (
                    t(column.header)
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {showSkeleton && <SkeletonTable columns={wideColumns} />}

            {showRows &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  data-row
                  data-part="table-body-row"
                  {...testid(rowId(row))}
                  {...(onRowClick && {
                    tabIndex: 0,
                    ...(rowLabel && { "aria-label": rowLabel(row) }),
                    onClick: () => onRowClick(row),
                    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    },
                    className: "cursor-pointer transition-colors duration-150 hover:bg-row-hover",
                  })}
                  {...(!onRowClick && {
                    className: "transition-colors duration-150 hover:bg-row-hover",
                  })}
                >
                  {wideColumns.map((column) => (
                    <td
                      key={column.key}
                      data-part="table-body-cell"
                      {...testid(rowId(row), column.key)}
                      {...(column.actions === true &&
                        onRowClick && { onClick: (event) => event.stopPropagation() })}
                      className={cn(
                        compact
                          ? "h-(--control-h-sm) px-3 py-1 align-middle"
                          : "px-[18px] py-[13px] align-middle",
                        alignClass(column.align),
                        column.className,
                      )}
                    >
                      <div
                        data-part="table-cell-content"
                        className={cn(
                          "max-w-(--cell-max)",
                          column.align === "end" || column.align === "numeric" ? "ms-auto" : "",
                          compact ? "truncate" : "[overflow-wrap:anywhere]",
                        )}
                      >
                        {column.render(row)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination !== undefined && <Pagination {...pagination} {...testid(testId, "pagination")} />}
    </div>
  );
}

function SortButton({
  label,
  columnKey,
  sort,
  "data-testid": testId,
}: {
  readonly label: string;
  readonly columnKey: string;
  readonly sort: TableSort;
} & TestIdProps): JSX.Element {
  const active = sort.key === columnKey;

  const next = (): void => {
    if (!active) {
      sort.onChange(columnKey, "desc");
    } else if (sort.dir === "desc") {
      sort.onChange(columnKey, "asc");
    } else {
      sort.onChange(null, "desc");
    }
  };

  return (
    <button
      type="button"
      data-part="table-sort"
      {...testid(testId)}
      onClick={next}
      className={cn(
        "group inline-flex cursor-pointer items-center gap-1 rounded-control",
        "transition-colors duration-150 hover:text-ink",
        active && "text-ink",
      )}
    >
      {label}
      <Icon
        name={active ? (sort.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down"}
        className={cn(
          "size-3.5 transition-opacity duration-150",
          active ? "opacity-100" : "opacity-50 group-hover:opacity-80",
        )}
      />
    </button>
  );
}

function PanelHead({
  children,
  "data-testid": testId,
}: { readonly children: ReactNode } & TestIdProps): JSX.Element {
  return (
    <div
      data-part="table-header"
      {...testid(testId)}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {children}
    </div>
  );
}

const sizes = (perPage: number, options: readonly number[]): number[] =>
  options.includes(perPage) ? [...options] : [...options, perPage].sort((a, b) => a - b);

export function Pagination({
  page,
  totalPages,
  onPageChange,
  perPage,
  perPageOptions = PER_PAGE_OPTIONS,
  onPerPageChange,
  className,
  "data-testid": testId,
}: PaginationProps): JSX.Element {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const pages = pageWindow(page, totalPages);

  const previous = (
    <PageButton
      label={t("ui.pagination.previous")}
      disabled={page <= 1}
      onClick={() => onPageChange(page - 1)}
      {...testid(testId, "previous")}
    >
      <Icon name="chevron-start" className="size-3.5" />
    </PageButton>
  );

  const next = (
    <PageButton
      label={t("ui.pagination.next")}
      disabled={page >= totalPages}
      onClick={() => onPageChange(page + 1)}
      {...testid(testId, "next")}
    >
      <Icon name="chevron-end" className="size-3.5" />
    </PageButton>
  );

  return (
    <nav
      data-part="pagination"
      {...testid(testId)}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-line bg-table-head py-3",
        isMobile ? "px-3" : "px-[18px]",
        className,
      )}
      aria-label={t("ui.pagination.label")}
    >
      {perPage !== undefined && onPerPageChange !== undefined && (
        <label
          className={cn(
            "flex items-center gap-2 text-meta text-ink-muted",
            isMobile && "order-last",
          )}
        >
          <span className={cn(isMobile && "sr-only")}>{t("ui.pagination.perPage")}</span>
          <Select
            className="w-[5.5rem]"
            {...testid(testId, "per-page")}
            value={String(perPage)}
            onChange={(event) => onPerPageChange(Number(event.target.value))}
            options={sizes(perPage, perPageOptions).map((size) => ({
              value: String(size),
              label: String(size),
            }))}
          />
        </label>
      )}

      <div
        data-part="pagination-pages"
        {...testid(testId, "pages")}
        className="flex items-center gap-1.5"
      >
        {previous}

        {isMobile ? (
          <PageField
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            {...testid(testId, "page-field")}
          />
        ) : (
          pages.map((entry, index) =>
            entry === null ? (
              <span
                key={`gap-${String(index)}`}
                data-part="pagination-gap"
                {...testid(testId, "gap")}
                aria-hidden="true"
                className="px-1 text-ink-subtle"
              >
                …
              </span>
            ) : (
              <PageButton
                key={entry}
                label={t("ui.pagination.goToPage", { page: entry })}
                current={entry === page}
                onClick={() => onPageChange(entry)}
                {...testid(testId, `page-${String(entry)}`)}
              >
                <Ltr>{entry}</Ltr>
              </PageButton>
            ),
          )
        )}

        {next}
      </div>
    </nav>
  );
}

function PageField({
  page,
  totalPages,
  onPageChange,
  "data-testid": testId,
}: {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
} & TestIdProps): JSX.Element {
  const { t } = useTranslation();
  const last = Math.max(totalPages, 1);
  const [draft, setDraft] = useState(String(page));

  useEffect(() => setDraft(String(page)), [page]);

  const commit = (): void => {
    const target = Number(draft);

    if (draft !== "" && target >= 1 && target <= last && target !== page) {
      onPageChange(target);
    } else {
      setDraft(String(page));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div
      data-part="pagination-field"
      {...testid(testId)}
      className="flex items-center gap-1.5 px-1"
    >
      <div className={cn(fieldShell({}), "w-14 px-2")}>
        <input
          {...testid(testId, "input")}
          type="text"
          inputMode="numeric"
          enterKeyHint="go"
          aria-label={t("ui.pagination.pageOf", { totalPages: last })}
          value={draft}
          onChange={(event) => setDraft(foldDigits(event.target.value).replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={onKeyDown}
          onFocus={(event) => event.target.select()}
          className={cn(FIELD_TEXT, "text-center tabular-nums")}
        />
      </div>
      <span aria-hidden="true" className="text-ink-faint">
        /
      </span>
      <span
        data-part="pagination-count"
        {...testid(testId, "count")}
        aria-hidden="true"
        className="min-w-6 text-center text-label tabular-nums text-ink-muted"
      >
        <Ltr>{last}</Ltr>
      </span>
    </div>
  );
}

function PageButton({
  label,
  current = false,
  disabled = false,
  onClick,
  children,
  "data-testid": testId,
}: {
  readonly label: string;
  readonly current?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
} & TestIdProps): JSX.Element {
  return (
    <button
      type="button"
      data-part="pagination-page"
      {...testid(testId)}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "pill-text inline-flex items-center size-(--control-h) cursor-pointer justify-center lg:size-(--control-h-sm)",
        "rounded-chip border text-label tabular-nums transition-colors duration-[250ms] ease-in-out",
        current
          ? "border-primary-600 bg-primary-600 font-medium text-ink-inverse"
          : "border-line bg-surface text-ink-muted hover:bg-inset hover:border-primary-600 hover:text-primary-700",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line",
      )}
    >
      {children}
    </button>
  );
}

function pageWindow(page: number, totalPages: number): readonly (number | null)[] {
  const last = Math.max(totalPages, 1);

  if (last <= 7) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  const around = [page - 1, page, page + 1].filter((entry) => entry > 1 && entry < last);
  const shown = [1, ...around, last];

  return shown.flatMap((entry, index) =>
    index > 0 && entry - shown[index - 1]! > 1 ? [null, entry] : [entry],
  );
}
