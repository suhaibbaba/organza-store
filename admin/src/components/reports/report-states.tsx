"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Skeleton, SkeletonStatus } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import type { ReportErrorProps } from "@/types/report";

export function ReportLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <SkeletonStatus />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}

export function ReportError({ error, onRetry }: ReportErrorProps) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="reports-error"
      action={
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    >
      {code ? translateError(code) : t("retry")}
    </Alert>
  );
}

// Nothing sold in the range — said plainly so a screen of zeros never reads as broken.
export function ReportEmpty() {
  return (
    <EmptyState
      data-testid="reports-empty"
      icon="trend-up"
      title="reports.empty.title"
      hint="reports.empty.description"
    />
  );
}
