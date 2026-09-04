// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { EffectiveAccess } from "@/lib/types";
import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({
  effectiveAccess: null as EffectiveAccess | null,
  push: vi.fn(),
  scopeMode: undefined as "GLOBAL" | "SCOPED" | undefined,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi
    .fn()
    .mockResolvedValue({ recentCourses: [], scope: "tenant", stats: [] }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: mocks.effectiveAccess,
    organization: {
      _id: "tenant-001",
      enabledModules: ["USERS", "COURSES", "ASSIGNMENTS"],
      logoUrl: null,
      name: "Bright Academy",
      primaryColor: "#176BFF",
      slug: "bright-academy",
      status: "ACTIVE",
    },
    token: "tenant-token",
    user: {
      email: "owner@bright.local",
      fullName: "Bright Owner",
      membershipId: "membership-001",
      orgUnitScopeMode: mocks.scopeMode,
      role: "TENANT_ADMIN",
      sub: "owner-001",
      tenantId: "tenant-001",
    },
  }),
}));
vi.mock(
  "antd",
  async () => (await import("@/test-utils/lightweight-antd")).lightweightAntd,
);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe("Dashboard subscription access", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.scopeMode = undefined;
    mocks.effectiveAccess = {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 25,
        maxUsers: 250,
      },
      modules: ["COURSES", "ASSIGNMENTS"],
      readOnly: true,
      state: "READ_ONLY",
    };
  });

  afterEach(cleanup);

  it("đổi CTA quản lý sang billing khi workspace chỉ đọc nhưng vẫn giữ quyền xem khóa học", async () => {
    renderPage();

    expect(screen.getByText("Chỉ đọc")).toBeTruthy();
    const billingButton = screen.getByRole("button", {
      name: "Quản lý thuê bao",
    });
    fireEvent.click(billingButton);
    expect(mocks.push).toHaveBeenCalledWith("/billing");
    expect(await screen.findByText("Khóa học gần đây")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Quản lý khóa học" }),
    ).toBeNull();
  });

  it("không đưa quản lý đơn vị tới billing toàn tổ chức", async () => {
    mocks.scopeMode = "SCOPED";
    renderPage();

    expect(screen.getByText("Quản lý đơn vị")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Quản lý thuê bao" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Chọn gói" })).toBeNull();
  });
});
