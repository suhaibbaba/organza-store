"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { FormContainer } from "@/components/layout/form-container";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SettingsForm } from "@/components/settings/settings-form";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { LogoCard } from "@/components/settings/logo-card";
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

      <FormContainer className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
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
          <>
            {/* This device's notification permission first: it is the part done per device. */}
            <LogoCard />
            <NotificationsCard />
            <SettingsForm setting={setting} />
            <AppVersion className="w-auto items-center self-center" />
          </>
        )}
      </FormContainer>
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
