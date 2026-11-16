import {
  type Capability,
  type LoginInput,
  type LoginResponse,
  type SessionUser,
} from '@organza/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { queryClient } from '@web/app/query-client';
import { api, refreshSession, setRefreshListener } from '@web/shared/lib/api-client';
import { authTokens } from '@web/shared/lib/auth-tokens';
import { tokenStore } from '@web/shared/lib/token-store';
import { setLanguage } from '@web/i18n';

type Status = 'restoring' | 'signed-in' | 'signed-out' | 'unreachable';

interface SessionValue {
  status: Status;
  user: SessionUser | null;
  can: (capability: Capability) => boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [attempt, setAttempt] = useState(0);

  const accept = useCallback((response: LoginResponse) => {
    authTokens.set(response.accessToken);
    setUser(response.user);
    setStatus('signed-in');
  }, []);

  useEffect(() => {
    setRefreshListener((response) => setUser(response.user));
    const off = authTokens.onSessionEnded(() => {
      setUser(null);
      setStatus('signed-out');
      queryClient.clear();
    });
    return () => {
      setRefreshListener(null);
      off();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then(async (outcome) => {
      if (cancelled) return;
      if (outcome !== 'refreshed') {
        setStatus(outcome === 'unreachable' ? 'unreachable' : 'signed-out');
        return;
      }
      const me = await api.get<SessionUser>('/auth/me');
      if (!cancelled) {
        setUser(me);
        setStatus('signed-in');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const store = tokenStore.get();
      const response = await api.post<LoginResponse>('/auth/login', {
        ...input,
        client: store.kind === 'secure-store' ? 'desktop' : 'web',
      });
      if (response.refreshToken) await store.save(response.refreshToken);
      await setLanguage(response.user.language);
      accept(response);
    },
    [accept],
  );

  const signOut = useCallback(async () => {
    const store = tokenStore.get();
    const stored = store.kind === 'secure-store' ? await store.load() : null;
    await api.post('/auth/logout', stored ? { refreshToken: stored } : {}).catch(() => undefined);
    await store.clear();
    authTokens.notifySessionEnded();
  }, []);

  const value = useMemo<SessionValue>(() => {
    const granted = new Set(user?.capabilities ?? []);
    return {
      status,
      user,
      can: (capability) => user?.role === 'ADMIN' || granted.has(capability),
      signIn,
      signOut,
      retry: () => {
        setStatus('restoring');
        setAttempt((n) => n + 1);
      },
    };
  }, [status, user, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
