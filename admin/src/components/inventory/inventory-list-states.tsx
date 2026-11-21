import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function InventoryListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="inventory-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-card bg-inset" />
      ))}
    </div>
  );
}

export function InventoryListEmpty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      data-testid="inventory-empty"
      icon="package"
      title={hasFilters ? "inventory.empty.noMatchesTitle" : "inventory.empty.noItemsTitle"}
      hint={hasFilters ? "inventory.empty.noMatchesDescription" : "inventory.empty.noItemsDescription"}
    />
  );
}

export function InventoryListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="inventory-error"
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
