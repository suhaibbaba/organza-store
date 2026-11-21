import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Skeleton, Spinner } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function ProductListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="products-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-card" />
      ))}
    </div>
  );
}

export function ProductListEmpty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      data-testid="products-empty"
      icon="search"
      title={hasFilters ? "products.empty.noMatchesTitle" : "products.empty.noProductsTitle"}
      hint={hasFilters ? "products.empty.noMatchesDescription" : "products.empty.noProductsDescription"}
    />
  );
}

export function ProductListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="products-error"
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    >
      {code ? translateError(code) : t("retry")}
    </Alert>
  );
}

export function ProductListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5" />
    </div>
  );
}
