import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function CategoryListLoading() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-card bg-inset" />
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

export function CategoryListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
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
