import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, Spinner } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function ChangeRequestListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="change-requests-loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-card bg-inset" />
      ))}
    </div>
  );
}

export function ChangeRequestListEmpty({ status }: { status: string }) {
  const waiting = status === "PENDING";

  return (
    <EmptyState
      data-testid="change-requests-empty"
      icon="check"
      title={waiting ? "changeRequests.empty.noneWaitingTitle" : "changeRequests.empty.noneTitle"}
      hint={waiting ? "changeRequests.empty.noneWaitingDescription" : "changeRequests.empty.noneDescription"}
    />
  );
}

export function ChangeRequestListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert
      tone="danger"
      data-testid="change-requests-error"
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

export function ChangeRequestListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5" />
    </div>
  );
}
