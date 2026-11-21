"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Skeleton, SkeletonStatus } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function LabelListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="labels-loading">
      <SkeletonStatus />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-card" />
      ))}
    </div>
  );
}

export function LabelListEmpty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      data-testid="labels-empty"
      icon="print"
      title={hasFilters ? "labels.empty.noMatchesTitle" : "labels.empty.allPrintedTitle"}
      hint={hasFilters ? "labels.empty.noMatchesDescription" : "labels.empty.allPrintedDescription"}
    />
  );
}

export function LabelListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="labels-error"
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
