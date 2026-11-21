"use client";

import { useTranslations } from "next-intl";
import { BellRing, BellOff } from "lucide-react";
import { Alert, Button, Skeleton, Typography } from "@store/ui";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { SettingsSection } from "@/components/settings/settings-section";

// Whether THIS phone receives sale notifications (a browser permission, applied at once); whether the shop sends them is a Setting.
export function NotificationsCard() {
  const t = useTranslations("settings.notifications");
  const { isReady, permission, isSubscribed, blockedReason, action, enable, disable } = usePushNotifications();

  const isPending = action === "pending";

  return (
    <SettingsSection name="device">
      {!isReady ? (
        <Skeleton className="h-11 rounded-control" />
      ) : blockedReason ? (
        <Alert tone="danger" data-testid="alert-destructive">
          {t(`blocked.${blockedReason}`)}
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <Alert tone={isSubscribed ? "success" : "neutral"} data-testid={isSubscribed ? "alert-success" : "alert-default"}>
            {t(isSubscribed ? "state.on" : "state.off")}
          </Alert>
          <Button
            type="button"
            variant={isSubscribed ? "secondary" : "primary"}
            onClick={() => void (isSubscribed ? disable() : enable())}
            isLoading={isPending}
            className="self-start"
            icon={isSubscribed ? <BellOff className="size-4" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
          >
            {t(isSubscribed ? "turnOff" : "turnOn")}
          </Button>
        </div>
      )}

      {action === "error" && (
        <Alert tone="danger" data-testid="alert-destructive">
          {t("failed")}
        </Alert>
      )}

      <div className="flex flex-col gap-1">
        {isReady && permission && (
          <Typography variant="caption" tone="muted">
            {t("permissionLabel")}: {t(`permission.${permission}`)}
          </Typography>
        )}
        {/* Shown to everyone: shop phones are handed around. */}
        <Typography variant="caption" tone="muted">
          {t("iosHint")}
        </Typography>
      </div>
    </SettingsSection>
  );
}
