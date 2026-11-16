"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyPermissionMatrixPayload } from "@organza/shared/lib/permissions";
import type { PermissionMatrixPayload } from "@organza/shared/types/permission";
import { PERMISSIONS_QUERY_KEY } from "@/constants/api";
import { fetchPermissionMatrix } from "@/lib/api/permissions";
import { useSession } from "@/components/providers/session-provider";

// Where this app's `can()` gets the shop's own rules.
//
// Half the permission table is configurable per shop and lives in the
// backend's database (spec.md "Editable role permissions"). `can()` is
// synchronous — it is an `if` in a hundred components — so it cannot fetch;
// something has to hand it the answer. This is that something.
//
// Two things here are deliberate:
//
//   * The rules are published DURING render, not from an effect. An effect
//     runs after the children have already drawn, which would paint one frame
//     of the shipped defaults — a button the shop switched off, appearing and
//     then vanishing. `applyPermissionMatrixPayload` is idempotent, so doing
//     it inside a memo is safe under StrictMode's double render.
//   * Nothing is gated here. AuthGuard already holds the app behind a spinner
//     until it knows who is signed in, and it waits for this too (see
//     `usePermissionsLoading` there) — so the wait is expressed once, in the
//     component whose job it is, rather than by wrapping the boot splash in a
//     second spinner.
//
// None of this is a security boundary. The backend refuses the request
// whatever the browser believes (CLAUDE.md rule 5); this is only about
// showing somebody the app their shop actually gave them.

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
    // Nothing to ask for while nobody is signed in — and `enabled` is derived
    // from the session query rather than from the stored token, so the server
    // render and the first client render agree.
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

/** The matrix a screen renders (the Permissions page) — never the gate itself, which is `can()`. */
export function usePermissionMatrix(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
