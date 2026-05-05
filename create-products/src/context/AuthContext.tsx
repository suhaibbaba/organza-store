"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { sdk, clearToken } from "@/lib/sdk";

interface AuthUser {
  id: string;
  email: string;
  metadata?: Record<string, unknown>;
}

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  logout: (locale: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const logout = useCallback(async (locale: string) => {
    try { await sdk.auth.logout(); } catch {}
    clearToken();
    window.location.href = `/${locale}/login`;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
