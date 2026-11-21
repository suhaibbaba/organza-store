"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trackTillActivity } from "@/lib/activity";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Once per tab via useState, so separate requests never share a client.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            // Restated defaults the stock freshness relies on; don't turn them off.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  useEffect(() => trackTillActivity(), []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
