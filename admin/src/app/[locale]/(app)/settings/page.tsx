"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SettingsForm } from "@/components/settings/settings-form";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { AppVersion } from "@/components/pwa/app-version";

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
        <>
          {/* This phone's own notification permission sits above the shop-wide
              settings: it is the part the Admin has to do on each device. */}
          <NotificationsCard />
          <SettingsForm setting={setting} />
          {/* Which build this device is running, at the foot of the page it
              is most likely to be looked for on. The same line lives in the
              account menu and the mobile "More" sheet, which is where every
              other role finds it. */}
          <AppVersion className="w-auto items-center self-center" />
        </>
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
