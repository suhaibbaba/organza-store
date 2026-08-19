"use client";

import { useTranslations } from "next-intl";
import { Barcode } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function LabelListLoading() {
  return (
    <div className="flex flex-col gap-3" data-test-selector="labels-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function LabelListEmpty({ hasFilters }: { hasFilters: boolean }) {
  const t = useTranslations("labels.empty");

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center"
      data-test-selector="labels-empty"
    >
      <Barcode className="size-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">{hasFilters ? t("noMatchesTitle") : t("allPrintedTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters ? t("noMatchesDescription") : t("allPrintedDescription")}
        </p>
      </div>
    </div>
  );
}

export function LabelListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert variant="destructive" className="flex-col items-center gap-3 text-center" data-test-selector="labels-error">
      <p>{code ? translateError(code) : t("retry")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </Alert>
  );
}

export function LabelListSpinnerOverlay() {
  return (
    <div className="flex items-center justify-center py-3">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
