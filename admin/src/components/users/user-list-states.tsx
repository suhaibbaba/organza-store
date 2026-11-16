import { useTranslations } from "next-intl";
import { UsersRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function UserListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="users-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function UserListEmpty({ hasFilters }: { hasFilters: boolean }) {
  const t = useTranslations("users.empty");

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center"
      data-test-selector="users-empty"
    >
      <UsersRound className="size-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">{hasFilters ? t("noMatchesTitle") : t("noUsersTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters ? t("noMatchesDescription") : t("noUsersDescription")}
        </p>
      </div>
    </div>
  );
}

export function UserListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert variant="destructive" className="flex-col items-center gap-3 text-center" data-test-selector="users-error">
      <p>{code ? translateError(code) : t("retry")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </Alert>
  );
}

export function UserListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
