"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Skeleton, SkeletonStatus } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function ReportLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <SkeletonStatus />
      <Skeleton className="h-40 rounded-card" />
      <Skeleton className="h-56 rounded-card" />
      <Skeleton className="h-56 rounded-card" />
    </div>
  );
}

export function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="reports-error"
      action={
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
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
