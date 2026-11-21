"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { can } from "@store/shared/lib/permissions";
import type { PermissionAction } from "@store/shared/types/permission";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { buttonClassName } from "@store/ui";
import { landingHref } from "@/lib/nav";

// "message" explains the refusal with a way back; "redirect" sends them to their own first screen (for landing routes like /dashboard). UI convenience only — the backend is the gate (rule 5).
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
  const target = landingHref(user);

  useEffect(() => {
    if (onDenied !== "redirect" || isLoading || !user || allowed) return;
    if (target) router.replace(target);
  }, [onDenied, isLoading, user, allowed, target, router]);

  if (!allowed) {
    // A role that opens no screen at all has nowhere to be sent, so it gets the message instead.
    return onDenied === "redirect" && target ? null : <ForbiddenScreen />;
  }

  return <>{children}</>;
}

// The same `error.forbidden` sentence the API answers a 403 with.
function ForbiddenScreen() {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");
  const { user } = useSession();
  const home = landingHref(user);

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center"
      data-test-selector="forbidden"
    >
      <span className="grid size-12 place-items-center rounded-pill bg-inset">
        <Lock className="size-6 text-ink-muted" aria-hidden="true" />
      </span>
      <p className="text-value font-medium text-ink">{t("forbidden")}</p>
      <p className="text-label text-ink-muted">{t("forbiddenHint")}</p>
      {home && (
        <Link href={home} className={buttonClassName({ variant: "secondary", className: "mt-1" })}>
          {tCommon("backToStart")}
        </Link>
      )}
    </div>
  );
}
