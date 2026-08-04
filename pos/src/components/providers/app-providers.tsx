"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>{children}</SessionProvider>
    </QueryProvider>
  );
}
