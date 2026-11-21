import type { JSX, ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { useSearchParams } from "@ui/lib/search-params";
import { PILL_BASE } from "@ui/components/badge";
import { cn } from "@ui/lib/cn";
import { Ltr } from "@ui/components/ltr";
import { rovingKeyDown, rovingStop } from "@ui/lib/roving-focus";
import { parts, testid, type TestIdProps } from "@ui/lib/testid";

export interface TabDefinition<TId extends string> {
  readonly id: TId;
  readonly label: string;
  readonly count?: number | undefined;
}

export interface TabsProps<TId extends string> extends TestIdProps {
  readonly tabs: readonly TabDefinition<TId>[];
  readonly value: TId;
  readonly onChange: (id: TId) => void;
  readonly label: string;
  readonly className?: string | undefined;
}

export function Tabs<TId extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
  "data-testid": testId,
}: TabsProps<TId>): JSX.Element {
  const { t } = useTranslation();
  const ids = tabs.map((tab) => tab.id);
  const stop = rovingStop(ids, value);

  return (
    <div
      data-part="tabs"
      {...testid(testId)}
      role="tablist"
      aria-label={t(label)}
      onKeyDown={(event) => rovingKeyDown(event, ids, value, onChange)}
      className={cn(
        "flex items-center gap-2",
        "max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "pb-2 sm:pb-0",
        "sm:inline-flex sm:flex-wrap sm:self-start sm:overflow-visible",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            data-part="tab"
            {...testid(testId, tab.id)}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === stop ? 0 : -1}
            data-roving
            onClick={() => onChange(tab.id)}
            className={cn(
              PILL_BASE,
              "min-h-(--control-h) shrink-0 cursor-pointer border-[1.5px] lg:h-(--control-h-sm) lg:min-h-0",
              "[transition:background-color_250ms_ease-in-out,border-color_250ms_ease-in-out,color_250ms_ease-in-out,scale_120ms_ease-out]",
              "active:scale-95",
              selected
                ? "border-primary-600 bg-primary-600 text-ink-inverse focus-visible:border-primary-900 focus-visible:bg-primary-900"
                : "border-line-strong bg-surface text-ink-muted hover:bg-inset hover:border-neutral-400 hover:text-ink focus-visible:border-primary-800 focus-visible:bg-neutral-200 focus-visible:text-primary-900",
            )}
          >
            {t(tab.label)}
            {tab.count !== undefined && tab.count > 0 && (
              <Ltr
                data-part="tab-count"
                {...testid(testId, `${tab.id}-count`)}
                className={cn(
                  "pill-text inline-flex items-center h-4 min-w-4 justify-center rounded-pill px-1.5 text-micro font-medium",
                  "tabular-nums",
                  selected ? "bg-primary-900/25 text-ink-inverse" : "bg-inset text-ink-subtle",
                )}
              >
                {tab.count}
              </Ltr>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps extends TestIdProps {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function TabPanel({ id, children, className, "data-testid": testId }: TabPanelProps): JSX.Element {
  return (
    <div
      {...parts("tab-panel", testId ?? `panel-${id}`)()}
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn("min-w-0", className)}
    >
      {children}
    </div>
  );
}

export function useTabParam<TId extends string>(
  param: string,
  ids: readonly TId[],
  fallback: TId,
  clears: readonly string[] = [],
): readonly [TId, (id: TId) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const active = ids.find((id) => id === raw) ?? fallback;

  const setActive = (id: TId): void => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (id === fallback) {
          next.delete(param);
        } else {
          next.set(param, id);
        }

        for (const stale of clears) {
          next.delete(stale);
        }

        return next;
      },
      { replace: true },
    );
  };

  return [active, setActive];
}
