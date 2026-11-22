"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, Spinner, Typography } from "@store/ui";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { usePermissionMatrix } from "@/components/providers/permissions-provider";
import { LockScreen } from "@/components/auth/lock-screen";
import { PasscodeSetupScreen } from "@/components/auth/passcode-setup-screen";
import { AutoLock } from "@/components/auth/auto-lock";
import { LOGIN_HREF } from "@/constants/auth";

// Verifies the session against the backend; proxy.ts only redirects optimistically from the cookie mirror.
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading: isSessionLoading, isError, refresh, hasDevice, needsPasscode } = useSession();
  // Held until the shop's own permission rules arrive, so the sell screen never redraws from shipped defaults.
  const { isLoading: arePermissionsLoading } = usePermissionMatrix();
  const isLoading = isSessionLoading || (Boolean(user) && arePermissionsLoading);
  const router = useRouter();
  const t = useTranslations("common");
  const tOffline = useTranslations("offline");

  useEffect(() => {
    // "Couldn't reach the server" is not "signed out": bouncing to /login would loop straight back here.
    if (!isLoading && !isError && !user && !hasDevice) {
      router.replace(LOGIN_HREF);
    }
  }, [isLoading, isError, user, hasDevice, router]);

  if (isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Typography variant="h2">{tOffline("title")}</Typography>
        <Typography variant="body" tone="muted" className="max-w-sm">
          {tOffline("message")}
        </Typography>
        <Button onClick={() => void refresh()}>{t("retry")}</Button>
      </div>
    );
  }

  if (!isLoading && !user && hasDevice) {
    return <LockScreen />;
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label={t("loading")} className="size-8" />
      </div>
    );
  }

  if (needsPasscode) {
    return <PasscodeSetupScreen />;
  }

  return (
    <>
      <AutoLock />
      {children}
    </>
  );
}
