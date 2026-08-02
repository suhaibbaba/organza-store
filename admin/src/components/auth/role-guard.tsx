"use client";

import { useEffect, type ReactNode } from "react";
import type { Role } from "@shared/types/role";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";

// Client-side convenience only — the real gate is the backend (CLAUDE.md
// rule 5). This just keeps a non-Admin from landing on a screen the nav
// already hides for them (e.g. a stale bookmark).
export function RoleGuard({ allow, children }: { allow: readonly Role[]; children: ReactNode }) {
  const { user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allow.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, allow, router]);

  if (!user || !allow.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
