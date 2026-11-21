import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Spinner } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function UserListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="users-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-card bg-inset" />
      ))}
    </div>
  );
}

export function UserListEmpty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      data-testid="users-empty"
      icon="users"
      title={hasFilters ? "users.empty.noMatchesTitle" : "users.empty.noUsersTitle"}
      hint={hasFilters ? "users.empty.noMatchesDescription" : "users.empty.noUsersDescription"}
    />
  );
}

export function UserListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="users-error"
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

export function UserListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5" />
    </div>
  );
}
