"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import type { PermissionAction } from "@organza/shared/types/permission";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { landingHref } from "@/lib/nav";

// What happens to somebody who reaches a screen they may not see:
//
//   "message" (default) — say so. A bookmark, a shared link or a typed URL
//     gets a plain sentence and a way back, never a blank screen: an untrained
//     user cannot tell "you're not allowed here" from "this app is broken"
//     (CLAUDE.md "Clear feedback always"), and a silent redirect teaches them
//     the tap did nothing.
//   "redirect" — bounce to their own first screen instead. For the screens
//     others are sent TO rather than screens someone chose: /dashboard is
//     where the root path, the proxy and the login form all land, and none of
//     them can know the role beforehand, so an Employee arriving there was
//     never asking for it.
//
// Either way this is client-side convenience only — the real gate is the
// backend (CLAUDE.md rule 5), which 403s the data whatever the UI does.
export function RoleGuard({
  action,
  onDenied = "message",
  children,
}: {
  action: PermissionAction;
  onDenied?: "message" | "redirect";
  children: ReactNode;
}) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const allowed = Boolean(user) && can(user, action);

  useEffect(() => {
    if (onDenied !== "redirect" || isLoading || !user || allowed) return;
    // Their own first allowed screen, not a fixed one: the dashboard is no
    // longer visible to every role, so redirecting there unconditionally
    // would send an Employee to another screen they'd be bounced off again.
    const target = landingHref(user);
    if (target) router.replace(target);
  }, [onDenied, isLoading, user, allowed, router]);

  if (!allowed) {
    return onDenied === "redirect" ? null : <ForbiddenScreen />;
  }

  return <>{children}</>;
}

// The `error.forbidden` message the backend would answer with, in the reader's
// own language — the same sentence whether they hit the wall in the UI or the
// API answered 403 first.
function ForbiddenScreen() {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");
  const { user } = useSession();
  const home = landingHref(user);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <Lock className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium text-foreground">{t("forbidden")}</p>
      <p className="text-sm text-muted-foreground">{t("forbiddenHint")}</p>
      {home && (
        <Button asChild variant="outline" className="mt-1">
          <Link href={home}>{tCommon("backToStart")}</Link>
        </Button>
      )}
    </div>
  );
}
