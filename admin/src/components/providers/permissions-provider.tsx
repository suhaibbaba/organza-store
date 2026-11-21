"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyPermissionMatrixPayload } from "@store/shared/lib/permissions";
import type { PermissionMatrixPayload } from "@store/shared/types/permission";
import { PERMISSIONS_QUERY_KEY } from "@/constants/api";
import { fetchPermissionMatrix } from "@/lib/api/permissions";
import { useSession } from "@/components/providers/session-provider";

// Hands can() the shop's rules during render, so no frame shows the shipped defaults; not a security boundary.

interface PermissionsContextValue {
  /** The whole matrix, for the screen that renders it. Null until it has loaded. */
  matrix: PermissionMatrixPayload | null;
  /** True while a signed-in user's rules are still on their way. */
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({ matrix: null, isLoading: false });

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: fetchPermissionMatrix,
    // Derived from the session query, not the stored token, so server and first client render agree.
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const matrix = useMemo(() => {
    if (data) {
      applyPermissionMatrixPayload(data);
    }
    return data ?? null;
  }, [data]);

  const value = useMemo(() => ({ matrix, isLoading }), [matrix, isLoading]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

/** The matrix a screen renders (the Permissions page) — never the gate itself, which is `can()`. */
export function usePermissionMatrix(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
