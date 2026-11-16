import { useTranslations } from "next-intl";
import { FolderTree } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function CategoryListLoading() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function CategoryListEmpty() {
  const t = useTranslations("categories.empty");

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center"
      data-test-selector="categories-empty"
    >
      <FolderTree className="size-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">{t("title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
    </div>
  );
}

export function CategoryListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const translateError = useTranslateError();
  const code = error instanceof ApiError ? error.code : undefined;

  return (
    <Alert variant="destructive" className="flex-col items-center gap-3 text-center" data-test-selector="categories-error">
      <p>{code ? translateError(code) : t("retry")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </Alert>
  );
}
