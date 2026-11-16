"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trackTillActivity } from "@/lib/activity";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created once per browser tab via useState (not module scope), so
  // separate requests never share a client — see the React Query + Next.js
  // App Router setup guide.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            // Both are react-query defaults, restated because the stock
            // queries lean on them: coming back to the till, or coming back
            // onto the network, re-reads anything stale before the cashier
            // has looked at it. Leaving them implicit would make a future
            // "let's set some sensible defaults" pass able to turn the
            // freshness guarantee off without anyone noticing.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      })
  );

  // Teaches react-query what "this till is in use" means before deciding to
  // poll anything — see lib/activity.ts. Installed here rather than at module
  // scope so it is torn down with the provider and survives a hot reload.
  useEffect(() => trackTillActivity(), []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
