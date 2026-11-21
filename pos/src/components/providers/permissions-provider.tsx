"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyPermissionMatrixPayload } from "@store/shared/lib/permissions";
import type { PermissionMatrixPayload } from "@store/shared/types/permission";
import { PERMISSIONS_QUERY_KEY } from "@/constants/api";
import { fetchPermissionMatrix } from "@/lib/api/permissions";
import { useSession } from "@/components/providers/session-provider";

// Published during render, not in an effect, so a Sell button never flashes in; the backend still decides (rule 5).

interface PermissionsContextValue {
  matrix: PermissionMatrixPayload | null;
  /** True while a signed-in cashier's rules are still on their way. */
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({ matrix: null, isLoading: false });

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: fetchPermissionMatrix,
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

export function usePermissionMatrix(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
