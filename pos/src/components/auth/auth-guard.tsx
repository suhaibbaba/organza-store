"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { usePermissionMatrix } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// proxy.ts already redirects unauthenticated requests optimistically (based
// on the cookie mirror); this verifies the token against the backend and
// covers client-side navigations proxy doesn't re-run for.
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading: isSessionLoading, isError, refresh } = useSession();
  // ...and the shop's own permission rules, which arrive a moment after the
  // session does (spec.md "Editable role permissions"). Held here so the sell
  // screen never draws once with the shipped defaults and then rearranges
  // itself — on a till that is a mis-tap waiting to happen.
  const { isLoading: arePermissionsLoading } = usePermissionMatrix();
  const isLoading = isSessionLoading || arePermissionsLoading;
  const router = useRouter();
  const t = useTranslations("common");
  const tOffline = useTranslations("offline");

  useEffect(() => {
    // Only bounce to /login once we actually know there is no session.
    // "Couldn't reach the server" is not "signed out": the cookie proxy.ts
    // reads is still there, so it would send us straight back here and we'd
    // spin forever instead of telling anyone what went wrong.
    if (!isLoading && !isError && !user) {
      router.replace("/login");
    }
  }, [isLoading, isError, user, router]);

  if (isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold">{tOffline("title")}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{tOffline("message")}</p>
        <Button onClick={() => void refresh()}>{t("retry")}</Button>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  return <>{children}</>;
}
