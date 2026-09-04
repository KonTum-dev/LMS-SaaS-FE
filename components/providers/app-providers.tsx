"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import viVN from "antd/locale/vi_VN";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { normalizeEffectiveAccess } from "@/lib/entitlements";
import { clearLmsSessionCache, createLmsQueryClient } from "@/lib/query-client";
import type { AuthResponse, CurrentUser, EffectiveAccess, Organization, WorkspaceSummary } from "@/lib/types";
import { tenantPrimaryColor } from "@/lib/workspace";

const SESSION_KEY = "novalms-session";
const AUTH_CHANNEL_NAME = "novalms-auth";

interface SessionState {
  token: string;
  user: CurrentUser | null;
  organization: Organization | null;
  effectiveAccess: EffectiveAccess | null;
  workspaces: WorkspaceSummary[];
}

interface AuthContextValue extends SessionState {
  captureAuthGeneration: () => number;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  switchWorkspace: (tenantId: string) => Promise<void>;
  consumeAuthResponse: (payload: AuthResponse, expectedGeneration: number) => Promise<void>;
  updateEffectiveAccess: (effectiveAccess: EffectiveAccess | null, tenantId: string) => void;
  updateOrganization: (organization: Organization) => void;
}

const emptySession: SessionState = { effectiveAccess: null, token: "", user: null, organization: null, workspaces: [] };
const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({
  children,
  queryClient,
  rotateQueryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
  rotateQueryClient: () => void;
}) {
  const [session, setSession] = useState<SessionState>(emptySession);
  const [loading, setLoading] = useState(true);
  const sessionTokenRef = useRef("");
  const authGenerationRef = useRef(0);
  const authChannelRef = useRef<BroadcastChannel | null>(null);
  const queryClientRef = useRef(queryClient);

  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  const replaceSession = useCallback(async (payload: AuthResponse, generation: number) => {
    if (generation !== authGenerationRef.current) return false;
    const next: SessionState = {
      effectiveAccess: normalizeEffectiveAccess(payload.effectiveAccess),
      organization: payload.organization,
      token: payload.accessToken,
      user: payload.user,
      workspaces: Array.isArray(payload.workspaces) ? payload.workspaces : [],
    };
    sessionTokenRef.current = next.token;
    const sessionQueryClient = queryClientRef.current;
    await sessionQueryClient.cancelQueries().catch(() => undefined);
    if (generation !== authGenerationRef.current) return false;
    clearLmsSessionCache(sessionQueryClient);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
    setSession(next);
    setLoading(false);
    rotateQueryClient();
    return true;
  }, [rotateQueryClient]);

  const clearSession = useCallback(() => {
    authGenerationRef.current += 1;
    sessionTokenRef.current = "";
    const sessionQueryClient = queryClientRef.current;
    void sessionQueryClient.cancelQueries().catch(() => undefined);
    clearLmsSessionCache(sessionQueryClient);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Session still clears in memory. */ }
    setSession(emptySession);
    setLoading(false);
    rotateQueryClient();
  }, [rotateQueryClient]);

  const logout = useCallback(() => {
    clearSession();
    try { authChannelRef.current?.postMessage({ type: "LOGOUT" }); } catch { /* Local logout is already complete. */ }
  }, [clearSession]);

  useEffect(() => {
    const restore = async () => {
      const generation = ++authGenerationRef.current;
      let raw: string | null = null;
      try { raw = localStorage.getItem(SESSION_KEY); } catch { /* Continue without persistence. */ }
      if (!raw) return setLoading(false);
      try {
        const stored = JSON.parse(raw) as Partial<SessionState>;
        if (!stored.token || typeof stored.token !== "string") throw new Error("Invalid stored session");
        sessionTokenRef.current = stored.token;
        const current = await apiFetch<Omit<AuthResponse, "accessToken"> & { workspaces?: WorkspaceSummary[] }>("/auth/me", { token: stored.token });
        if (generation !== authGenerationRef.current || sessionTokenRef.current !== stored.token) return;
        const fresh: SessionState = {
          effectiveAccess: normalizeEffectiveAccess(current.effectiveAccess),
          organization: current.organization,
          token: stored.token,
          user: current.user,
          workspaces: Array.isArray(current.workspaces)
            ? current.workspaces
            : Array.isArray(stored.workspaces) ? stored.workspaces : [],
        };
        setSession(fresh);
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(fresh)); } catch { /* Keep the live session in memory. */ }
      } catch {
        if (generation === authGenerationRef.current) logout();
      } finally {
        if (generation === authGenerationRef.current || !sessionTokenRef.current) {
          setLoading(false);
        }
      }
    };
    void restore();
  }, [logout]);

  useEffect(() => {
    const handleExpired = (event: Event) => {
      const expiredToken = event instanceof CustomEvent
        ? (event.detail as { token?: string } | undefined)?.token
        : undefined;
      if (expiredToken && expiredToken !== sessionTokenRef.current) return;
      logout();
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, [logout]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel | null = null;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        typeof event.data === "object"
        && event.data !== null
        && "type" in event.data
        && event.data.type === "LOGOUT"
      ) {
        clearSession();
      }
    };
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.addEventListener("message", handleMessage);
      authChannelRef.current = channel;
    } catch {
      try { channel?.close(); } catch { /* Storage events remain as the cross-tab fallback. */ }
      return;
    }
    const activeChannel = channel;
    return () => {
      if (authChannelRef.current === activeChannel) authChannelRef.current = null;
      activeChannel.removeEventListener("message", handleMessage);
      activeChannel.close();
    };
  }, [clearSession]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue === null) clearSession();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const generation = ++authGenerationRef.current;
    const previousToken = session.token;
    sessionTokenRef.current = "";
    try {
      const payload = await apiFetch<AuthResponse>("/auth/login", {
        body: JSON.stringify({ email, password }),
        method: "POST",
      });
      if (!await replaceSession(payload, generation)) {
        throw new Error("Phiên đăng nhập đã thay đổi, vui lòng thử lại");
      }
    } catch (error) {
      if (generation === authGenerationRef.current) {
        sessionTokenRef.current = previousToken;
      }
      throw error;
    }
  }, [replaceSession, session.token]);

  const refreshSession = useCallback(async () => {
    if (!session.token) return;
    const requestedToken = session.token;
    const generation = authGenerationRef.current;
    const current = await apiFetch<Omit<AuthResponse, "accessToken"> & { workspaces?: WorkspaceSummary[] }>("/auth/me", { token: requestedToken });
    if (generation !== authGenerationRef.current || sessionTokenRef.current !== requestedToken) return;
    const authorityChanged = Boolean(session.user && (
      session.user.sub !== current.user.sub
      || session.user.tenantId !== current.user.tenantId
      || session.user.membershipId !== current.user.membershipId
      || session.user.role !== current.user.role
    ));
    if (authorityChanged) {
      const sessionQueryClient = queryClientRef.current;
      await sessionQueryClient.cancelQueries().catch(() => undefined);
      if (generation !== authGenerationRef.current || sessionTokenRef.current !== requestedToken) return;
      clearLmsSessionCache(sessionQueryClient);
    }
    const next: SessionState = {
      effectiveAccess: normalizeEffectiveAccess(current.effectiveAccess),
      organization: current.organization,
      token: requestedToken,
      user: current.user,
      workspaces: Array.isArray(current.workspaces) ? current.workspaces : session.workspaces,
    };
    sessionTokenRef.current = next.token;
    setSession(next);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
    if (authorityChanged) rotateQueryClient();
  }, [rotateQueryClient, session.token, session.user, session.workspaces]);

  const switchWorkspace = useCallback(async (tenantId: string) => {
    if (!session.token || tenantId === session.user?.tenantId) return;
    const generation = ++authGenerationRef.current;
    const requestedToken = session.token;
    const payload = await apiFetch<AuthResponse>("/auth/switch-workspace", {
      body: JSON.stringify({ tenantId }),
      method: "POST",
      token: requestedToken,
    });
    if (!await replaceSession(payload, generation)) {
      throw new Error("Phiên đăng nhập đã thay đổi, vui lòng thử lại");
    }
  }, [replaceSession, session.token, session.user?.tenantId]);

  const captureAuthGeneration = useCallback(() => authGenerationRef.current, []);

  const consumeAuthResponse = useCallback(async (
    payload: AuthResponse,
    expectedGeneration: number,
  ) => {
    if (expectedGeneration !== authGenerationRef.current) {
      throw new Error("Phiên đăng nhập đã thay đổi, vui lòng thử lại");
    }
    const generation = ++authGenerationRef.current;
    if (!await replaceSession(payload, generation)) {
      throw new Error("Phiên đăng nhập đã thay đổi, vui lòng thử lại");
    }
  }, [replaceSession]);

  const updateEffectiveAccess = useCallback((effectiveAccess: EffectiveAccess | null, tenantId: string) => {
    setSession((previous) => {
      if (previous.user?.tenantId !== tenantId) return previous;
      const next = { ...previous, effectiveAccess: normalizeEffectiveAccess(effectiveAccess) };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
      return next;
    });
  }, []);

  const updateOrganization = useCallback((organization: Organization) => {
    setSession((previous) => {
      if (!previous.user) return previous;
      const next = {
        ...previous,
        organization: previous.user?.tenantId === organization._id
          ? organization
          : previous.organization,
        workspaces: previous.workspaces.map((workspace) => workspace.tenantId === organization._id
          ? {
              ...workspace,
              logoUrl: organization.logoUrl,
              name: organization.name,
              primaryColor: organization.primaryColor,
              slug: organization.slug,
            }
          : workspace),
      };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* Keep the live session in memory. */ }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      captureAuthGeneration,
      loading,
      login,
      logout,
      refreshSession,
      switchWorkspace,
      consumeAuthResponse,
      updateEffectiveAccess,
      updateOrganization,
    }),
    [session, captureAuthGeneration, loading, login, logout, refreshSession, switchWorkspace, consumeAuthResponse, updateEffectiveAccess, updateOrganization],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryState, setQueryState] = useState(() => ({
    client: createLmsQueryClient(),
    generation: 0,
  }));
  const rotateQueryClient = useCallback(() => {
    setQueryState((previous) => ({
      client: createLmsQueryClient(),
      generation: previous.generation + 1,
    }));
  }, []);

  return (
    <AuthProvider queryClient={queryState.client} rotateQueryClient={rotateQueryClient}>
      <QueryClientProvider client={queryState.client} key={queryState.generation}>
        <ThemedAntd>{children}</ThemedAntd>
      </QueryClientProvider>
    </AuthProvider>
  );
}

function ThemedAntd({ children }: { children: React.ReactNode }) {
  const { organization } = useAuth();
  const primary = tenantPrimaryColor(organization);
  const selectedBackground = useMemo(() => colorWithAlpha(primary, 0.09), [primary]);
  const theme = useMemo(() => ({
    cssVar: { prefix: "dx" },
    token: {
      borderRadius: 10,
      borderRadiusLG: 16,
      boxShadow: "0 8px 24px rgba(16, 35, 63, 0.06)",
      boxShadowSecondary: "0 12px 32px rgba(16, 35, 63, 0.07)",
      boxShadowTertiary: "0 4px 14px rgba(16, 35, 63, 0.05)",
      colorBgContainer: "#FFFFFF",
      colorBgElevated: "#FFFFFF",
      colorBgLayout: "#F6F8FB",
      colorBorder: "#DDE4EC",
      colorBorderSecondary: "#E8EDF3",
      colorFillAlter: "#F7F9FC",
      colorLink: primary,
      colorPrimary: primary,
      colorText: "#10233F",
      colorTextDescription: "#64748B",
      colorTextHeading: "#10233F",
      colorTextLabel: "#46566D",
      colorTextSecondary: "#64748B",
      controlHeight: 40,
      controlHeightLG: 44,
      fontFamily: '"Be Vietnam Pro", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 14,
      fontWeightStrong: 600,
      lineHeight: 1.55,
    },
    components: {
      Button: {
        dangerShadow: "none",
        defaultShadow: "none",
        fontWeight: 500,
        primaryShadow: "none",
      },
      Card: {
        bodyPadding: 22,
        headerBg: "#FFFFFF",
        headerFontSize: 15,
        headerFontSizeSM: 14,
        headerHeight: 54,
        headerPadding: 22,
      },
      Form: {
        itemMarginBottom: 20,
        labelColor: "#33465F",
        labelFontSize: 13,
      },
      Input: {
        activeShadow: `0 0 0 3px ${colorWithAlpha(primary, 0.11)}`,
        paddingInline: 13,
      },
      Layout: {
        bodyBg: "#F6F8FB",
        headerBg: "#FFFFFF",
        headerHeight: 64,
        headerPadding: "0 28px",
        lightSiderBg: "#FFFFFF",
        siderBg: "#FFFFFF",
      },
      Menu: {
        activeBarBorderWidth: 0,
        itemBg: "transparent",
        itemBorderRadius: 10,
        itemColor: "#46566D",
        itemHeight: 42,
        itemHoverBg: "#F3F6F9",
        itemHoverColor: "#10233F",
        itemMarginBlock: 4,
        itemMarginInline: 10,
        itemSelectedBg: selectedBackground,
        itemSelectedColor: primary,
      },
      Modal: {
        contentBg: "#FFFFFF",
        footerBg: "#FFFFFF",
        headerBg: "#FFFFFF",
        titleColor: "#10233F",
        titleFontSize: 16,
      },
      Statistic: {
        contentFontSize: 28,
        titleFontSize: 13,
      },
      Table: {
        borderColor: "#E8EDF3",
        cellFontSize: 14,
        cellPaddingBlock: 14,
        cellPaddingInline: 18,
        headerBg: "#F7F9FC",
        headerBorderRadius: 0,
        headerColor: "#526177",
        rowHoverBg: "#F8FAFC",
      },
      Tabs: {
        horizontalItemGutter: 28,
        inkBarColor: primary,
        titleFontSize: 14,
      },
      Tag: {
        defaultBg: "#F1F5F9",
        defaultColor: "#526177",
      },
    },
  }), [primary, selectedBackground]);

  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim().replace(/^#/, "");
  const hex = normalized.length === 3
    ? normalized.split("").map((character) => character.repeat(2)).join("")
    : normalized;
  if (!/^[\da-f]{6}$/i.test(hex)) return `rgba(23, 107, 255, ${alpha})`;
  const value = Number.parseInt(hex, 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong AppProviders");
  return context;
}
