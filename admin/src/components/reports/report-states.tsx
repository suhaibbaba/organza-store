"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function ReportLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
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

// Nothing sold in the picked range — said plainly, so nobody reads a screen
// of zeros as a broken page.
export function ReportEmpty() {
  const t = useTranslations("reports.empty");

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <TrendingUp className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium text-foreground">{t("title")}</p>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
    </div>
  );
}
