"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, Spinner } from "@store/ui";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { usePermissionMatrix } from "@/components/providers/permissions-provider";

// Verifies the session against the backend (proxy.ts only checks the cookie) and holds the app until the shop's permissions load.
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading: isSessionLoading, isError, refresh } = useSession();
  const { isLoading: arePermissionsLoading } = usePermissionMatrix();
  const isLoading = isSessionLoading || arePermissionsLoading;
  const router = useRouter();
  const t = useTranslations("common");
  const tOffline = useTranslations("offline");

  useEffect(() => {
    // "Couldn't reach the server" is not "signed out": bouncing to /login then would loop forever.
    if (!isLoading && !isError && !user) {
      router.replace("/login");
    }
  }, [isLoading, isError, user, router]);

  if (isError) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center"
        data-test-selector="auth-offline"
      >
        <p className="text-section font-semibold text-ink">{tOffline("title")}</p>
        <p className="max-w-sm text-label leading-relaxed text-ink-muted">{tOffline("message")}</p>
        <Button onClick={() => void refresh()}>{t("retry")}</Button>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <Spinner label={t("loading")} className="size-8" />
      </div>
    );
  }

  return <>{children}</>;
}
