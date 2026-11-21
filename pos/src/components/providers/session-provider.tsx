"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/constants/api";
import { fetchSession, signInWithEmail, signOut as signOutRequest } from "@/lib/auth/client";
import type { SessionUser } from "@/types/auth";

interface SessionContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  /** The check itself failed (server unreachable) — NOT the same as signed out. */
  isError: boolean;
  refresh: () => Promise<void>;
  // Returns the account so the caller can open it in that person's own language.
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
    // Only a dropped connection throws here (a rejected token is null), so one retry is enough.
    retry: 1,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await signInWithEmail(email, password);
      queryClient.setQueryData(SESSION_QUERY_KEY, session.user);
      return session.user;
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    await signOutRequest();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
  }, [queryClient]);

  return (
    <SessionContext.Provider value={{ user: user ?? null, isLoading, isError, refresh, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
