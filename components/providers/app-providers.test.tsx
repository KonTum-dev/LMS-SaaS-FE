// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { AppProviders, useAuth } from "./app-providers";

const user = {
  sub: "teacher-1",
  email: "teacher@nova.test",
  fullName: "Cô Mai",
  role: "INSTRUCTOR" as const,
  tenantId: "tenant-1",
};
const organization = {
  _id: "tenant-1",
  name: "Nova Academy",
  slug: "nova",
  status: "ACTIVE" as const,
  primaryColor: "#5B5BD6",
  logoUrl: null,
  enabledModules: ["COURSES" as const],
};

function Probe() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [cacheSize, setCacheSize] = useState(() => queryClient.getQueryCache().getAll().length);

  useEffect(() => {
    if (auth.user) queryClient.setQueryData(["private", auth.user.sub], { secret: true });
  }, [auth.user, queryClient]);
  useEffect(() => queryClient.getQueryCache().subscribe(() => {
    setCacheSize(queryClient.getQueryCache().getAll().length);
  }), [queryClient]);

  return <>
    <span>{auth.user?.email ?? "signed-out"}</span>
    <span>cache:{cacheSize}</span>
    <button onClick={auth.logout} type="button">Đăng xuất</button>
  </>;
}

function renderRestoredSession() {
  localStorage.setItem("novalms-session", JSON.stringify({ token: "token-1", user, organization }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ user, organization }),
    { headers: { "Content-Type": "application/json" }, status: 200 },
  )));
  render(<AppProviders><Probe /></AppProviders>);
}

beforeEach(() => {
  const store = new Map<string, string>();
  const storage: Storage = {
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
    removeItem: (key) => { store.delete(key); },
    setItem: (key, value) => { store.set(key, String(value)); },
  };
  vi.stubGlobal("localStorage", storage);
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(), addListener: vi.fn(), matches: false,
      removeEventListener: vi.fn(), removeListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppProviders auth lifecycle", () => {
  it.each([
    ["auth:expired", () => window.dispatchEvent(new Event("auth:expired"))],
    ["logout", () => fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }))],
  ])("%s clear session storage và toàn bộ query cache", async (_name, expire) => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    await waitFor(() => expect(screen.getByText("cache:1")).toBeTruthy());

    expire();

    await screen.findByText("signed-out");
    await waitFor(() => expect(screen.getByText("cache:0")).toBeTruthy());
    expect(localStorage.getItem("novalms-session")).toBeNull();
  });
});
