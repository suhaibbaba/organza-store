"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyPermissionMatrixPayload } from "@organza/shared/lib/permissions";
import type { PermissionMatrixPayload } from "@organza/shared/types/permission";
import { PERMISSIONS_QUERY_KEY } from "@/constants/api";
import { fetchPermissionMatrix } from "@/lib/api/permissions";
import { useSession } from "@/components/providers/session-provider";

// Where the till's `can()` gets the shop's own rules.
//
// The same mechanism as the admin's provider of the same name, and for the
// same reason: half the permission table is configurable per shop and lives
// in the backend's database (spec.md "Editable role permissions"), while
// `can()` is synchronous and cannot fetch. The till reads those rules and
// never writes them — whether this account may ring up a sale at all
// (order.create) is one of them.
//
// Published DURING render rather than from an effect: an effect runs after
// the sell screen has already drawn, and one frame of a Sell button that then
// disappears is worse on a till than a moment's wait. The call is idempotent,
// so a memo is safe under StrictMode's double render.
//
// Not a security boundary — the backend refuses the sale whatever this
// believes (CLAUDE.md rule 5).

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
    // Derived from the session query rather than from the stored token, so
    // the server render and the first client render agree.
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const matrix = useMemo(() => {
    if (data) applyPermissionMatrixPayload(data);
    return data ?? null;
  }, [data]);

  const value = useMemo(() => ({ matrix, isLoading }), [matrix, isLoading]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissionMatrix(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
