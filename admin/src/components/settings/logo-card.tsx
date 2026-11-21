"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2 } from "lucide-react";
import { Alert, Button, Card } from "@store/ui";
import { ShopLogo } from "@/components/brand/shop-logo";
import { useLogoMutations, useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export function LogoCard() {
  const t = useTranslations("settings.logo");
  const tApp = useTranslations("app");
  const translateError = useTranslateError();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLogo = Boolean(useSettingsQuery().data?.logoUrl);
  const { upload, remove } = useLogoMutations();
  const error = upload.error ?? remove.error;

  return (
    <Card className="flex flex-col gap-4" data-testid="settings-logo">
      <h2 className="text-section font-semibold text-ink">{t("title")}</h2>
      <p className="text-label text-ink-muted">{t("hint")}</p>

      <div className="flex h-24 items-center justify-center rounded-panel border border-line bg-inset p-3">
        <ShopLogo alt={tApp("name")} className="h-full max-w-full" />
      </div>

      {error && (
        <Alert tone="danger" data-testid="alert-destructive">
          {translateError(error instanceof ApiError ? error.code : "error.internal")}
        </Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-test-selector="settings-logo-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload.mutate(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          isLoading={upload.isPending}
          icon={<ImageUp className="size-4" aria-hidden />}
          data-test-selector="settings-logo-upload"
        >
          {hasLogo ? t("replace") : t("upload")}
        </Button>
        {hasLogo && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => remove.mutate()}
            isLoading={remove.isPending}
            icon={<Trash2 className="size-4" aria-hidden />}
            data-test-selector="settings-logo-remove"
          >
            {t("remove")}
          </Button>
        )}
      </div>
    </Card>
  );
}
