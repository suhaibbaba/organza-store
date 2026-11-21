import { useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { Alert, Button, Spinner } from "@store/ui";
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
  const t = useTranslations("orders.empty");

  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line py-16 text-center"
      data-test-selector="orders-empty"
    >
      <ReceiptText className="size-10 text-ink-muted" aria-hidden="true" />
      <div>
        <p className="font-medium text-ink">{hasFilters ? t("noMatchesTitle") : t("noOrdersTitle")}</p>
        <p className="mt-1 text-label text-ink-muted">
          {hasFilters ? t("noMatchesDescription") : t("noOrdersDescription")}
        </p>
      </div>
    </div>
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
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
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
