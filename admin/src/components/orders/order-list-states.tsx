import { useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function OrderListLoading() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function OrderListEmpty({ hasFilters }: { hasFilters: boolean }) {
  const t = useTranslations("orders.empty");

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <ReceiptText className="size-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">{hasFilters ? t("noMatchesTitle") : t("noOrdersTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters ? t("noMatchesDescription") : t("noOrdersDescription")}
        </p>
      </div>
    </div>
  );
}

// Every failure is shown as plain language mapped from the backend's
// `error.*` key (CLAUDE.md rule 12), with the way out right next to it.
export function OrderListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert variant="destructive" className="flex-col items-center gap-3 text-center">
      <p>{code ? translateError(code) : t("retry")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </Alert>
  );
}

export function OrderListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
