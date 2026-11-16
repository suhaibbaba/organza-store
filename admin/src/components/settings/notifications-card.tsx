"use client";

import { useTranslations } from "next-intl";
import { BellRing, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

// Turning sale notifications on for THIS phone.
//
// Two things are deliberately kept apart on the settings screen: whether the
// shop sends notifications at all (a Setting, in the form below this card)
// and whether this particular phone receives them (here). The first is the
// shop's policy; the second is a browser permission that only its owner can
// grant, on the device in their hand.
export function NotificationsCard() {
  const t = useTranslations("settings.notifications");
  const { isReady, permission, isSubscribed, blockedReason, action, enable, disable } = usePushNotifications();

  const isPending = action === "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>

        {!isReady ? (
          <div className="h-11 animate-pulse rounded-xl bg-muted" />
        ) : blockedReason ? (
          // Every blocked case says what to do about it, in plain words —
          // an iPhone in particular is not broken, it just has to be added
          // to the Home Screen first.
          <Alert variant="destructive">{t(`blocked.${blockedReason}`)}</Alert>
        ) : isSubscribed ? (
          <>
            <Alert variant="success">{t("state.on")}</Alert>
            <Button type="button" variant="outline" onClick={() => void disable()} disabled={isPending} className="w-full sm:w-auto sm:self-start">
              {isPending ? <Spinner /> : <BellOff aria-hidden />}
              {t("turnOff")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("state.off")}</p>
            <Button type="button" onClick={() => void enable()} disabled={isPending} className="w-full sm:w-auto sm:self-start">
              {isPending ? <Spinner /> : <BellRing aria-hidden />}
              {t("turnOn")}
            </Button>
          </>
        )}

        {/* The permission the browser actually holds, not what we last asked
            for — an untrained user needs to see why nothing is arriving. */}
        {isReady && permission && (
          <p className="text-sm text-muted-foreground">
            {t("permissionLabel")}: {t(`permission.${permission}`)}
          </p>
        )}

        {action === "error" && <Alert variant="destructive">{t("failed")}</Alert>}

        {/* Shown to everyone, not just to iPhones: the shop's phones are
            handed around, and the person setting this up is often not the
            person who will carry it. */}
        <p className="text-sm text-muted-foreground">{t("iosHint")}</p>
      </CardContent>
    </Card>
  );
}
