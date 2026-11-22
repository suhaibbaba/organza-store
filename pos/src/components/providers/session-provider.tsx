"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POS_ENROLLMENT_QUERY_KEY,
  POS_MEMBERS_QUERY_KEY,
  SESSION_QUERY_KEY,
  SHARED_QUERY_ROOTS,
} from "@/constants/api";
import { fetchSession, signInWithEmail, signOut as signOutRequest } from "@/lib/auth/client";
import { setStoredToken } from "@/lib/auth/session-storage";
import {
  getDeviceCredentials,
  hasStoredDevice,
  setDeviceCredentials,
  subscribeToDevice,
} from "@/lib/auth/device-storage";
import { enrollDevice, leaveDevice, unlockDevice } from "@/lib/api/pos-device";
import { dropCart } from "@/lib/cart-stash";
import type { SessionUser } from "@/types/auth";

interface SessionContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  /** The check itself failed (server unreachable) — NOT the same as signed out. */
  isError: boolean;
  // This tablet has a lock screen: somebody signed in on it with their password before.
  hasDevice: boolean;
  // Signed in, but no passcode yet: the till asks for one before anything else.
  needsPasscode: boolean;
  // The passcode works here, so locking and switching person are offered.
  canLock: boolean;
  refresh: () => Promise<void>;
  // Returns the account so the caller can open it in that person's own language.
  login: (email: string, password: string) => Promise<SessionUser>;
  unlock: (userId: string, passcode: string) => Promise<SessionUser | null>;
  passcodeSaved: () => void;
  lock: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasDevice = useSyncExternalStore(subscribeToDevice, hasStoredDevice, () => false);

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

  // Every signed-in person joins this tablet, so tomorrow the passcode works here.
  const { data: enrollment } = useQuery({
    queryKey: [...POS_ENROLLMENT_QUERY_KEY, user?.id],
    enabled: Boolean(user),
    staleTime: Infinity,
    queryFn: async () => {
      const result = await enrollDevice(getDeviceCredentials());
      if (result.deviceSecret) {
        setDeviceCredentials({ deviceId: result.deviceId, deviceSecret: result.deviceSecret });
      }
      return result;
    },
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Only what belongs to the person who was signed in goes; the shop's settings and logo stay for the lock screen.
  const forgetPersonalData = useCallback(() => {
    // The session entry is set, not removed: removing it would leave the screen holding the old person.
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] !== SESSION_QUERY_KEY[0] && !SHARED_QUERY_ROOTS.includes(String(query.queryKey[0])),
    });
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await signInWithEmail(email, password);
      queryClient.setQueryData(SESSION_QUERY_KEY, session.user);
      return session.user;
    },
    [queryClient],
  );

  const unlock = useCallback(
    async (userId: string, passcode: string) => {
      const credentials = getDeviceCredentials();
      if (!credentials) {
        return null;
      }
      const { token } = await unlockDevice(credentials, userId, passcode);
      setStoredToken(token);
      const { data } = await refetch();
      return data ?? null;
    },
    [refetch],
  );

  const passcodeSaved = useCallback(() => {
    queryClient.setQueryData([...POS_ENROLLMENT_QUERY_KEY, user?.id], (current: typeof enrollment) =>
      current ? { ...current, hasPasscode: true } : current,
    );
  }, [queryClient, user?.id]);

  // The session ends on the server; the tablet keeps its identity and this person's open sale.
  const lock = useCallback(async () => {
    await signOutRequest();
    await queryClient.invalidateQueries({ queryKey: POS_MEMBERS_QUERY_KEY });
    forgetPersonalData();
  }, [forgetPersonalData, queryClient]);

  // Signing out also takes this person off the tablet, so their passcode stops working here.
  const logout = useCallback(async () => {
    const credentials = getDeviceCredentials();
    if (credentials) {
      await leaveDevice(credentials).catch(() => undefined);
    }
    if (user) {
      dropCart(user.id);
    }
    await signOutRequest();
    forgetPersonalData();
  }, [forgetPersonalData, user]);

  const needsPasscode = enrollment?.hasPasscode === false;

  return (
    <SessionContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isError,
        hasDevice,
        needsPasscode,
        canLock: enrollment?.hasPasscode === true,
        refresh,
        login,
        unlock,
        passcodeSaved,
        lock,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
