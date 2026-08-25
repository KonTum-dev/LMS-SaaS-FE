"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
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

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>(emptySession);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Session still clears in memory. */ }
    setSession(emptySession);
  }, []);

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
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
    setSession(next);
  }, []);

  const updateOrganization = useCallback((organization: Organization) => {
    setSession((previous) => {
      const next = { ...previous, organization };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...session, loading, login, logout, updateOrganization }), [session, loading, login, logout, updateOrganization]);
  const primary = tenantPrimaryColor(session.organization);

  return (
    <ConfigProvider locale={viVN} theme={{ token: { borderRadius: 10, colorPrimary: primary, colorText: "#172033", fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" } }}>
      <AntdApp>
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      </AntdApp>
    </ConfigProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong AppProviders");
  return context;
}
