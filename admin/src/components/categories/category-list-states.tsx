import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import type { CategoryListErrorProps } from "@/types/category";

const SKELETON_ROWS = 6;

export function CategoryListLoading() {
  return (
    <div
      data-test-selector="categories-loading"
      className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-3">
          <div className="h-4 w-40 animate-pulse rounded-chip bg-inset" />
          <div className="ms-auto h-4 w-12 animate-pulse rounded-chip bg-inset" />
        </div>
      ))}
    </div>
  );
}

export function CategoryListEmpty() {
  return (
    <EmptyState
      data-testid="categories-empty"
      icon="list"
      title="categories.empty.title"
      hint="categories.empty.description"
    />
  );
}

export function CategoryListNoMatch() {
  return (
    <EmptyState
      data-testid="categories-no-match"
      icon="search"
      title="categories.noMatch.title"
      hint="categories.noMatch.description"
    />
  );
}

export function CategoryListError({ error, onRetry }: CategoryListErrorProps) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="categories-error"
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
