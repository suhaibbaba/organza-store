import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Spinner } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function OrderListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="orders-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-card bg-inset" />
      ))}
    </div>
  );
}

export function OrderListEmpty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      data-testid="orders-empty"
      icon="receipt"
      title={hasFilters ? "orders.empty.noMatchesTitle" : "orders.empty.noOrdersTitle"}
      hint={hasFilters ? "orders.empty.noMatchesDescription" : "orders.empty.noOrdersDescription"}
    />
  );
}

export function OrderListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="orders-error"
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

export function OrderListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5" />
    </div>
  );
}
