"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import viVN from "antd/locale/vi_VN";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { clearLmsSessionCache, createLmsQueryClient } from "@/lib/query-client";
import type { AuthResponse, CurrentUser, Organization } from "@/lib/types";
import { tenantPrimaryColor } from "@/lib/workspace";

const SESSION_KEY = "novalms-session";

interface SessionState {
  token: string;
  user: CurrentUser | null;
  organization: Organization | null;
}

interface AuthContextValue extends SessionState {
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateOrganization: (organization: Organization) => void;
}

const emptySession: SessionState = { token: "", user: null, organization: null };
const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>(emptySession);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearLmsSessionCache(queryClient);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Session still clears in memory. */ }
    setSession(emptySession);
  }, [queryClient]);

  useEffect(() => {
    const restore = async () => {
      let raw: string | null = null;
      try { raw = localStorage.getItem(SESSION_KEY); } catch { /* Continue without persistence. */ }
      if (!raw) return setLoading(false);
      try {
        const stored = JSON.parse(raw) as SessionState;
        const current = await apiFetch<Omit<AuthResponse, "accessToken">>("/auth/me", { token: stored.token });
        const fresh = { token: stored.token, ...current };
        setSession(fresh);
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(fresh)); } catch { /* Keep the live session in memory. */ }
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    void restore();
  }, [logout]);

  useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await apiFetch<AuthResponse>("/auth/login", {
      body: JSON.stringify({ email, password }),
      method: "POST",
    });
    const next = { token: payload.accessToken, user: payload.user, organization: payload.organization };
    clearLmsSessionCache(queryClient);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
    setSession(next);
  }, [queryClient]);

  const updateOrganization = useCallback((organization: Organization) => {
    setSession((previous) => {
      const next = { ...previous, organization };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...session, loading, login, logout, updateOrganization }), [session, loading, login, logout, updateOrganization]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createLmsQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProviders>{children}</ThemeProviders>
    </QueryClientProvider>
  );
}

function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemedAntd>{children}</ThemedAntd>
    </AuthProvider>
  );
}

function ThemedAntd({ children }: { children: React.ReactNode }) {
  const { organization } = useAuth();
  const primary = tenantPrimaryColor(organization);
  return (
    <ConfigProvider locale={viVN} theme={{ token: { borderRadius: 10, colorPrimary: primary, colorText: "#061A35", fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" } }}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong AppProviders");
  return context;
}
