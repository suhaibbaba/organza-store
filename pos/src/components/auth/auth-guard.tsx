"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { Spinner } from "@/components/ui/spinner";

// proxy.ts already redirects unauthenticated requests optimistically (based
// on the cookie mirror); this verifies the token against the backend and
// covers client-side navigations proxy doesn't re-run for.
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const t = useTranslations("common");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

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
