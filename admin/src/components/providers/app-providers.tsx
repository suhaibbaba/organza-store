"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { SessionProvider } from "@/components/providers/session-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {/* Inside SessionProvider: the rules are per shop, not per person, but
          there is nothing to load for somebody who is not signed in. */}
      <SessionProvider>
        <PermissionsProvider>{children}</PermissionsProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
