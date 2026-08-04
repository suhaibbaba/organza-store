"use client";

import { useEffect, type ReactNode } from "react";
import { can } from "@shared/lib/permissions";
import type { PermissionAction } from "@shared/types/permission";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { landingHref } from "@/lib/nav";

// Client-side convenience only — the real gate is the backend (CLAUDE.md
// rule 5). This just keeps a role from landing on a screen the nav already
// hides for them (e.g. a stale bookmark).
export function RoleGuard({ action, children }: { action: PermissionAction; children: ReactNode }) {
  const { user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user || can(user, action)) return;
    // Their own first allowed screen, not a fixed one: the dashboard is no
    // longer visible to every role, so redirecting there unconditionally
    // would send an Employee to another screen they'd be bounced off again.
    const target = landingHref(user);
    if (target) router.replace(target);
  }, [isLoading, user, action, router]);

  if (!user || !can(user, action)) {
    return null;
  }

  return <>{children}</>;
}
