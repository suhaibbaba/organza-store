"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SettingsForm } from "@/components/settings/settings-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";

function SettingsPageContent() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { data: setting, isLoading, isError, error, refetch } = useSettingsQuery();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError || !setting ? (
        <Alert variant="destructive" className="flex-col items-center gap-3 text-center">
          <p>{translateError(error instanceof ApiError ? error.code : "error.internal")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {tCommon("retry")}
          </Button>
        </Alert>
      ) : (
        <SettingsForm setting={setting} />
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard action="settings.manage">
      <SettingsPageContent />
    </RoleGuard>
  );
}
