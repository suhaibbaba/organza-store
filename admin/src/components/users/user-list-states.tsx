import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

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
