import type { JSX, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@ui/lib/i18n";
import { usePageActionSlot } from "@ui/lib/page-action-slot";
import { Badge } from "@ui/components/badge";
import { useDocumentTitle } from "@ui/lib/page-title";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface PageHeaderProps extends TestIdProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  primaryAction?: ReactNode | undefined;
  count?: ReactNode | undefined;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  primaryAction,
  count,
  "data-testid": testId,
}: PageHeaderProps): JSX.Element {
  const { t } = useTranslation();
  const slot = usePageActionSlot();
  const part = parts("page-header", testId);

  useDocumentTitle(t(title));

  const hosted = slot !== null && primaryAction !== undefined;
  const inRow = hosted ? undefined : primaryAction;

  return (
    <header {...part()} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      {hosted && createPortal(primaryAction, slot)}

      <div className="min-w-0">
        <h1 {...part("title")} className="text-title font-medium text-primary-900">
          {t(title)}
        </h1>
        {subtitle !== undefined && (
          <p {...part("subtitle")} className="mt-1 text-value text-ink-muted">
            {t(subtitle)}
          </p>
        )}
      </div>

      {(actions !== undefined || inRow !== undefined || count !== undefined) && (
        <div
          {...part("actions")}
          className="flex shrink-0 flex-col gap-2.5 sm:ms-auto sm:flex-row sm:items-center"
        >
          {(inRow !== undefined || actions !== undefined) && (
            <div className="flex flex-col gap-2.5 [&>*]:w-full sm:flex-row sm:items-center sm:[&>*]:w-auto">
              {inRow}
              {actions}
            </div>
          )}

          {count !== undefined && (
            <Badge tone="wash" plain className="shrink-0 self-start" {...part("count")}>
              {count}
            </Badge>
          )}
        </div>
      )}
    </header>
  );
}
