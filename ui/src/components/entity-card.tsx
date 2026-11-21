import type { JSX, ReactNode } from "react";
import { Badge, type BadgeTone } from "@ui/components/badge";
import { Icon, type IconName } from "@ui/components/icon";
import { ProgressBar, type ProgressTone } from "@ui/components/progress-bar";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface EntityCardMeta {
  readonly label: string;
  readonly value: ReactNode;
  readonly ltr?: boolean | undefined;
}

export interface EntityCardProps extends TestIdProps {
  readonly icon: IconName;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly status?: { readonly label: string; readonly tone: BadgeTone } | undefined;
  readonly progress?:
    | {
        readonly value: number;
        readonly total: number;
        readonly label: string;
        readonly caption?: string | undefined;
        readonly tone?: ProgressTone | undefined;
      }
    | undefined;
  readonly meta?: readonly EntityCardMeta[] | undefined;

  readonly action?:
    | {
        readonly label: string;
        readonly onClick: () => void;
        readonly disabled?: boolean | undefined;
      }
    | undefined;
  readonly menu?: ReactNode | undefined;
  readonly isSelected?: boolean | undefined;
  readonly level?: 2 | 3 | undefined;
  readonly className?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function EntityCard({
  icon,
  title,
  subtitle,
  status,
  progress,
  meta,
  action,
  menu,
  isSelected = false,
  level = 2,
  className,
  children,
  "data-testid": testId,
}: EntityCardProps): JSX.Element {
  const part = parts("entity-card", testId);
  const Heading = level === 3 ? "h3" : "h2";

  return (
    <article
      {...part()}
      data-entity-card
      className={cn(
        "flex flex-col border border-line rounded-card bg-surface p-4 shadow-card",
        "transition duration-[250ms] ease-in-out",
        action !== undefined && "hover:shadow-float",
        isSelected && "bg-selected outline outline-offset-[-1px] outline-selected-line",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          {...part("icon")}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-field bg-primary-100 text-primary-700"
        >
          <Icon name={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <Heading {...part("title")} className="break-words text-label font-semibold text-ink">
            {action === undefined ? (
              <bdi>{title}</bdi>
            ) : (
              <button
                type="button"
                {...part("action")}
                onClick={action.onClick}
                disabled={action.disabled === true}
                title={action.label}
                className="cursor-pointer text-start text-primary-700 hover:underline disabled:cursor-not-allowed disabled:text-ink disabled:no-underline"
              >
                <bdi>{title}</bdi>
              </button>
            )}
          </Heading>
          {subtitle !== undefined && (
            <p {...part("subtitle")} className="mt-0.5 break-words text-meta text-ink-muted">
              {subtitle}
            </p>
          )}
          {status !== undefined && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={status.tone} {...part("status")}>
                {status.label}
              </Badge>
            </div>
          )}
        </div>
        {menu}
      </div>
      {progress !== undefined && (
        <div className="mt-3">
          <ProgressBar
            value={progress.value}
            total={progress.total}
            label={progress.label}
            {...(progress.tone && { tone: progress.tone })}
          />
          {progress.caption !== undefined && (
            <p className="mt-2 text-meta text-ink-muted">{progress.caption}</p>
          )}
        </div>
      )}
      {children}
      {(meta ?? []).length > 0 && (
        <dl
          {...part("meta")}
          className="mt-3 grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] border-t border-line"
        >
          {(meta ?? []).map((entry, index) => (
            <div key={entry.label} className="contents">
              <dt
                className={cn(
                  "py-2 pe-4 text-label leading-value text-ink-muted",
                  index > 0 && "border-t border-line",
                )}
              >
                {entry.label}
              </dt>
              <dd
                className={cn(
                  "min-w-0 py-2 text-value font-medium break-words text-ink tabular-nums",
                  index > 0 && "border-t border-line",
                )}
              >
                <span {...(entry.ltr === true && { dir: "ltr" })} className="inline-block">
                  {entry.value}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function EntityGrid({
  children,
  "data-testid": testId,
}: { readonly children: ReactNode } & TestIdProps): JSX.Element {
  return (
    <div
      {...parts("entity-grid", testId)()}
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </div>
  );
}
