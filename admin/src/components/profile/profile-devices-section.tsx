"use client";

import { useLocale, useTranslations } from "next-intl";
import { Monitor, Smartphone, Tablet, MonitorSmartphone } from "lucide-react";
import { Alert, Badge, Button, Skeleton, Typography, useConfirm, useToast } from "@store/ui";
import type { ProfileSession } from "@store/shared/types/profile";
import { ProfileSection } from "@/components/profile/profile-section";
import { useProfileSessionsQuery, useRevokeOtherSessionsMutation, useRevokeSessionMutation } from "@/hooks/use-profile";
import { useTranslateError } from "@/hooks/use-translate-error";
import { describeUserAgent } from "@/lib/user-agent";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { DeviceKind } from "@/types/profile";
import { errorMessageKey } from "@/lib/error-message-key";

const DEVICE_ICONS: Record<DeviceKind, typeof Monitor> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  unknown: MonitorSmartphone,
};

function DeviceRow({ session, onSignOut }: { session: ProfileSession; onSignOut: (session: ProfileSession) => void }) {
  const t = useTranslations("profile.devices");
  const locale = useLocale();
  const device = describeUserAgent(session.userAgent);
  const DeviceIcon = DEVICE_ICONS[device.kind];
  const name =
    device.browser && device.system
      ? t("browserOn", { browser: device.browser, system: device.system })
      : (device.browser ?? device.system ?? t("unknownDevice"));

  return (
    <li
      data-test-selector={`profile-device-${session.id}`}
      className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-panel bg-sunken text-ink-muted">
        <DeviceIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Typography variant="body" weight="medium">
            {name}
          </Typography>
          {session.current && (
            <Badge tone="success" plain data-testid="profile-device-current">
              {t("thisDevice")}
            </Badge>
          )}
        </div>
        <Typography variant="caption" tone="muted">
          {t("lastActive", { when: formatDateTime(session.lastActiveAt, locale) })}
          {session.ipAddress && (
            <>
              {" · "}
              <span dir="ltr">{session.ipAddress}</span>
            </>
          )}
        </Typography>
      </div>
      {!session.current && (
        <Button
          type="button"
          variant="secondary"
          data-test-selector={`profile-device-sign-out-${session.id}`}
          onClick={() => onSignOut(session)}
        >
          {t("signOut")}
        </Button>
      )}
    </li>
  );
}

export function ProfileDevicesSection() {
  const t = useTranslations("profile.devices");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const translateError = useTranslateError();
  const { data: sessions, isLoading, isError, error, refetch } = useProfileSessionsQuery();
  const revokeOne = useRevokeSessionMutation();
  const revokeOthers = useRevokeOtherSessionsMutation();
  const { confirm, dialog } = useConfirm("profile-device-confirm");
  const others = (sessions ?? []).filter((session) => !session.current);

  function failed(cause: unknown) {
    toast.error(errorMessageKey(cause));
  }

  function signOutOne(session: ProfileSession) {
    confirm({
      title: "profile.devices.signOutTitle",
      consequences: [t("signOutConsequence")],
      confirmLabel: "profile.devices.signOut",
      tone: "primary",
      onConfirm: async () => {
        try {
          await revokeOne.mutateAsync(session.id);
          toast.success("profile.devices.signedOut");
        } catch (cause) {
          failed(cause);
        }
      },
    });
  }

  function signOutOthers() {
    confirm({
      title: "profile.devices.signOutOthersTitle",
      consequences: [t("signOutOthersConsequence")],
      confirmLabel: "profile.devices.signOutOthers",
      tone: "primary",
      onConfirm: async () => {
        try {
          await revokeOthers.mutateAsync();
          toast.success("profile.devices.signedOutOthers");
        } catch (cause) {
          failed(cause);
        }
      },
    });
  }

  return (
    <ProfileSection name="devices">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 rounded-panel" />
          <Skeleton className="h-12 rounded-panel" />
        </div>
      ) : isError || !sessions ? (
        <Alert
          tone="danger"
          data-testid="profile-devices-error"
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
          <ul data-test-selector="profile-devices" className="flex flex-col divide-y divide-line">
            {sessions.map((session) => (
              <DeviceRow key={session.id} session={session} onSignOut={signOutOne} />
            ))}
          </ul>
          {others.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              data-test-selector="profile-devices-sign-out-others"
              onClick={signOutOthers}
            >
              {t("signOutOthers")}
            </Button>
          ) : (
            <Typography variant="caption" tone="muted">
              {t("onlyThisDevice")}
            </Typography>
          )}
        </>
      )}
      {dialog}
    </ProfileSection>
  );
}
