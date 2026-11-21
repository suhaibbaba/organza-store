"use client";

import { useTranslations } from "next-intl";
import { BellRing, BellOff } from "lucide-react";
import { Alert, Button, Card } from "@store/ui";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// Whether THIS phone receives sale notifications (a browser permission); whether the shop sends them is a Setting below.
export function NotificationsCard() {
  const t = useTranslations("settings.notifications");
  const { isReady, permission, isSubscribed, blockedReason, action, enable, disable } = usePushNotifications();

  const isPending = action === "pending";

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-section font-semibold text-ink">{t("title")}</h2>
      <p className="text-label text-ink-muted">{t("intro")}</p>

      {!isReady ? (
        <div className="h-11 animate-pulse rounded-control bg-inset" />
      ) : blockedReason ? (
        <Alert tone="danger" data-testid="alert-destructive">
          {t(`blocked.${blockedReason}`)}
        </Alert>
      ) : isSubscribed ? (
        <>
          <Alert tone="success" data-testid="alert-success">
            {t("state.on")}
          </Alert>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void disable()}
            isLoading={isPending}
            icon={<BellOff className="size-4" aria-hidden />}
            className="w-full sm:w-auto sm:self-start"
          >
            {t("turnOff")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-label text-ink-muted">{t("state.off")}</p>
          <Button
            type="button"
            onClick={() => void enable()}
            isLoading={isPending}
            icon={<BellRing className="size-4" aria-hidden />}
            className="w-full sm:w-auto sm:self-start"
          >
            {t("turnOn")}
          </Button>
        </>
      )}

      {/* The permission the browser actually holds, so staff can see why nothing arrives. */}
      {isReady && permission && (
        <p className="text-label text-ink-muted">
          {t("permissionLabel")}: {t(`permission.${permission}`)}
        </p>
      )}

      {action === "error" && (
        <Alert tone="danger" data-testid="alert-destructive">
          {t("failed")}
        </Alert>
      )}

      {/* Shown to everyone: shop phones are handed around. */}
      <p className="text-label text-ink-muted">{t("iosHint")}</p>
    </Card>
  );
}
