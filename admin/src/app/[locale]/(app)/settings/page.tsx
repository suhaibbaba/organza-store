"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SettingsForm } from "@/components/settings/settings-form";
import { Alert, Button, Skeleton } from "@store/ui";
import { ApiError } from "@/lib/api/errors";
import { AppVersion } from "@/components/pwa/app-version";

function SettingsPageContent() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { data: setting, isLoading, isError, error, refetch } = useSettingsQuery();

  return (
    <PageContainer>
      <PageHeader name="settings" title={t("title")} description={t("subtitle")} />

      {isLoading ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : isError || !setting ? (
        <Alert
          tone="danger"
          data-testid="alert-destructive"
          action={
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              {tCommon("retry")}
            </Button>
          }
        >
          {translateError(error instanceof ApiError ? error.code : "error.internal")}
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          <SettingsForm setting={setting} />
          <AppVersion className="w-auto items-center self-center" />
        </div>
      )}
    </PageContainer>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard action="settings.manage">
      <SettingsPageContent />
    </RoleGuard>
  );
}
